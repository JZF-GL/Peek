const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { TextDecoder } = require('util');

let mainWindow;
const isDev = !app.isPackaged;

// 终端会话管理
const terminalSessions = new Map();
const TERMINAL_BUFFER_MAX = 20000; // 缓存输出的最大字符数，供切回 tab 时恢复

function getShellCommand() {
  if (process.platform === 'win32') {
    // /Q 静默启动；/K chcp 65001 把控制台代码页切换为 UTF-8，避免中文输出乱码
    return { cmd: process.env.ComSpec || 'cmd.exe', args: ['/Q', '/K', 'chcp 65001 >nul'] };
  }
  return { cmd: process.env.SHELL || '/bin/bash', args: ['-i'] };
}

function sendOutputToRenderer(id, data) {
  sendToRenderer('terminal-output', { id, data });
}

function pushSessionBuffer(session, data) {
  session.buffer += data;
  if (session.buffer.length > TERMINAL_BUFFER_MAX) {
    session.buffer = session.buffer.slice(session.buffer.length - TERMINAL_BUFFER_MAX);
  }
}

// 递归终止进程树：Windows 用 taskkill /T /F，Unix 用进程组信号
function killProcessTree(proc) {
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F']);
    } catch (e) {
      console.warn('[Main] taskkill failed, fallback to kill:', e);
      proc.kill();
    }
  } else {
    try {
      process.kill(-proc.pid, 'SIGTERM');
    } catch (e) {
      proc.kill();
    }
  }
}

// 停止终端会话，等待进程真正退出后再 resolve（避免端口未释放就重启）
function stopTerminalSession(id) {
  return new Promise((resolve) => {
    const session = terminalSessions.get(id);
    if (!session) {
      resolve();
      return;
    }
    terminalSessions.delete(id);
    if (session.exited) {
      resolve();
      return;
    }
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve();
      }
    };
    // 最多等待 3 秒，防止进程无法退出时一直阻塞
    const timer = setTimeout(done, 3000);
    session.proc.once('exit', done);
    try {
      killProcessTree(session.proc);
    } catch (e) {
      console.warn('[Main] Error killing terminal process:', e);
      done();
    }
  });
}

// 启动终端会话：command 为空时启动交互式 shell，否则运行指定命令
ipcMain.handle('terminal:start', (event, { id, cwd, command }) => {
  const existing = terminalSessions.get(id);
  if (existing && !existing.exited) {
    // 会话正在运行（切换 tab 回来），补发缓存的输出
    if (existing.buffer) {
      sendOutputToRenderer(id, existing.buffer);
    }
    return { started: false, existed: true };
  }
  if (existing) {
    // 旧进程已退出，清理后重新创建
    terminalSessions.delete(id);
  }

  let proc;
  try {
    // Unix 下使用独立进程组（detached），便于整体终止
    const baseOpts = process.platform === 'win32' ? { cwd } : { cwd, detached: true };
    if (command && command.trim()) {
      // 运行指定命令（如 npm run build），shell 模式下支持 npm/yarn 等 .cmd 包装
      let cmdLine = command.trim();
      if (process.platform === 'win32') {
        cmdLine = 'chcp 65001 >nul && ' + cmdLine;
      }
      proc = spawn(cmdLine, { ...baseOpts, shell: true });
    } else {
      const { cmd, args } = getShellCommand();
      proc = spawn(cmd, args, baseOpts);
    }
  } catch (err) {
    sendOutputToRenderer(id, `\r\n[错误] 无法启动终端: ${err.message}\r\n`);
    return { started: false, existed: false };
  }

  const session = {
    proc,
    cwd,
    command: command || '',
    buffer: '',
    exited: false,
    // 流式 UTF-8 解码：避免多字节字符在数据块边界被切断导致乱码；
    // stdout/stderr 各自独立解码器，防止两流交错破坏多字节序列
    stdoutDecoder: new TextDecoder('utf-8'),
    stderrDecoder: new TextDecoder('utf-8'),
  };
  terminalSessions.set(id, session);

  const onData = (decoder) => (data) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
    const text = decoder.decode(buf, { stream: true });
    pushSessionBuffer(session, text);
    sendOutputToRenderer(id, text);
  };

  if (proc.stdout) proc.stdout.on('data', onData(session.stdoutDecoder));
  if (proc.stderr) proc.stderr.on('data', onData(session.stderrDecoder));

  proc.on('error', (err) => {
    const text = `\r\n[错误] 无法启动进程: ${err.message}\r\n`;
    pushSessionBuffer(session, text);
    sendOutputToRenderer(id, text);
    session.exited = true;
  });

  proc.on('exit', (code) => {
    session.exited = true;
    if (!session.exitedNotified) {
      session.exitedNotified = true;
      sendToRenderer('terminal-exit', { id, code });
    }
  });

  return { started: true, existed: false };
});

// 向终端写入输入
ipcMain.on('terminal:input', (event, { id, data }) => {
  const session = terminalSessions.get(id);
  if (session && !session.exited && session.proc.stdin) {
    try {
      // Windows 管道模式下 cmd 只识别 CRLF 回车：统一规范行结束符
      const input =
        process.platform === 'win32'
          ? data.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n')
          : data;
      session.proc.stdin.write(input);
    } catch (e) {
      console.warn('[Main] Error writing to terminal:', e);
    }
  }
});

// 停止终端会话
ipcMain.handle('terminal:stop', async (event, id) => {
  await stopTerminalSession(id);
  return true;
});

// 调整终端大小（无 pty，仅记录，供扩展）
ipcMain.on('terminal:resize', (event, { id, cols, rows }) => {
  const session = terminalSessions.get(id);
  if (session) {
    session.cols = cols;
    session.rows = rows;
  }
});

// 文件/目录监听器管理
const watchers = new Map();

// 防抖定时器
const debounceTimers = new Map();

function sendToRenderer(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

function debouncedEmit(key, channel, ...args) {
  if (debounceTimers.has(key)) {
    clearTimeout(debounceTimers.get(key));
  }
  const timer = setTimeout(() => {
    debounceTimers.delete(key);
    sendToRenderer(channel, ...args);
  }, 300);
  debounceTimers.set(key, timer);
}

function stopWatching(targetPath) {
  if (watchers.has(targetPath)) {
    try {
      watchers.get(targetPath).close();
    } catch (e) {
      console.warn('[Main] Error closing watcher:', e);
    }
    watchers.delete(targetPath);
  }
  if (debounceTimers.has(targetPath)) {
    clearTimeout(debounceTimers.get(targetPath));
    debounceTimers.delete(targetPath);
  }
}

function startWatchingFolder(dirPath) {
  if (watchers.has(dirPath)) return;
  try {
    const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
      console.log('[Main] Folder changed:', dirPath, eventType, filename);
      debouncedEmit(dirPath, 'folder-changed', dirPath);
    });
    watchers.set(dirPath, watcher);
  } catch (error) {
    console.error('[Main] Failed to watch folder:', dirPath, error);
  }
}

function startWatchingFile(filePath) {
  if (watchers.has(filePath)) return;
  try {
    const watcher = fs.watch(filePath, (eventType, filename) => {
      console.log('[Main] File changed:', filePath, eventType, filename);
      sendToRenderer('file-changed', filePath);
    });
    watchers.set(filePath, watcher);
  } catch (error) {
    console.error('[Main] Failed to watch file:', filePath, error);
  }
}

// 获取启动时传入的文件路径（通过命令行参数或文件关联）
function getLaunchFilePaths() {
  const args = process.argv.slice(1);
  const filePaths = [];
  
  for (const arg of args) {
    // 跳过 Electron 应用路径和其他非文件参数
    if (arg.endsWith('.exe') || arg.startsWith('--') || arg.startsWith('.')) {
      continue;
    }
    
    // 检查是否是有效的文件路径
    try {
      const stats = fs.statSync(arg);
      if (stats.isFile()) {
        filePaths.push(arg);
      }
    } catch {
      // 忽略无效路径
    }
  }
  
  return filePaths;
}

// 处理 macOS 的 open-file 事件
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow) {
    mainWindow.webContents.send('open-files', [filePath]);
  } else {
    // 延迟处理
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.webContents.send('open-files', [filePath]);
      }
    }, 1000);
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1a1a2e',
    title: 'Peek - 文件查看器',
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#16213e',
      symbolColor: '#9ca3af',
      height: 32
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      webviewTag: false
    }
  });

  // 在窗口加载之前设置事件监听
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // 现在加载内容
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 窗口加载完成后，发送启动文件路径
  mainWindow.webContents.on('did-finish-load', () => {
    const launchFiles = getLaunchFilePaths();
    if (launchFiles.length > 0) {
      mainWindow.webContents.send('open-files', launchFiles);
    }
  });

  // 监听开发者工具快捷键
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F12' || 
          (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        mainWindow.webContents.toggleDevTools();
      }
      if (input.control && input.key.toLowerCase() === 'r') {
        mainWindow.webContents.reload();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 错误处理
app.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

app.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 窗口控制 IPC
ipcMain.handle('window:minimize', async () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window:maximize', async () => {
  if (mainWindow) {
    mainWindow.maximize();
  }
});

ipcMain.handle('window:unmaximize', async () => {
  if (mainWindow) {
    mainWindow.unmaximize();
  }
});

ipcMain.handle('window:close', async () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// 对话框 IPC
ipcMain.handle('dialog:openDirectory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  } catch (error) {
    console.error('Error in dialog:openDirectory:', error);
    throw error;
  }
});

ipcMain.handle('dialog:openFile', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }

    return result.filePaths;
  } catch (error) {
    console.error('Error in dialog:openFile:', error);
    throw error;
  }
});

// 文件系统 IPC
ipcMain.handle('fs:readDir', async (event, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const result = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const stats = fs.statSync(fullPath);

      result.push({
        name: entry.name,
        path: fullPath,
        type: entry.isDirectory() ? 'directory' : 'file',
        isDirectory: entry.isDirectory(),
        size: stats.size,
        mtime: stats.mtimeMs,
      });
    }

    return result;
  } catch (error) {
    console.error('Error reading directory:', error);
    throw error;
  }
});

ipcMain.handle('fs:buildTree', async (event, dirPath) => {
  try {
    return await buildFileTree(dirPath);
  } catch (error) {
    console.error('Error building file tree:', error);
    throw error;
  }
});

async function buildFileTree(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const nodes = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const stats = fs.statSync(fullPath);

    const node = {
      name: entry.name,
      path: fullPath,
      type: entry.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      mtime: stats.mtimeMs,
    };

    if (entry.isDirectory()) {
      try {
        node.children = await buildFileTree(fullPath);
      } catch {
        node.children = [];
      }
    }

    nodes.push(node);
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

ipcMain.handle('fs:readTextFile', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { content };
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
});

ipcMain.handle('fs:readBinaryFile', async (event, filePath) => {
  try {
    const base64Content = fs.readFileSync(filePath).toString('base64');
    return { content: base64Content };
  } catch (error) {
    console.error('Error reading binary file:', error);
    throw error;
  }
});

ipcMain.handle('fs:writeTextFile', async (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
});

ipcMain.handle('fs:getFileInfo', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      path: filePath,
      exists: true,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      size: stats.size,
      mtime: stats.mtimeMs,
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { path: filePath, exists: false };
    }
    console.error('Error getting file info:', error);
    throw error;
  }
});

// 创建文件
ipcMain.handle('fs:createFile', async (event, filePath) => {
  try {
    fs.writeFileSync(filePath, '', 'utf-8');
    return true;
  } catch (error) {
    console.error('Error creating file:', error);
    throw error;
  }
});

// 创建文件夹
ipcMain.handle('fs:createFolder', async (event, dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error('Error creating folder:', error);
    throw error;
  }
});

// 复制文件/文件夹
ipcMain.handle('fs:copy', async (event, sourcePath, targetPath) => {
  try {
    const stats = fs.statSync(sourcePath);
    if (stats.isDirectory()) {
      fs.cpSync(sourcePath, targetPath, { recursive: true, force: true });
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
    return true;
  } catch (error) {
    console.error('Error copying:', error);
    throw error;
  }
});

// 删除文件/文件夹
ipcMain.handle('fs:delete', async (event, targetPath) => {
  try {
    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return true;
    }
    console.error('Error deleting:', error);
    throw error;
  }
});

// Shell IPC
ipcMain.handle('shell:openExternal', async (event, url) => {
  await shell.openExternal(url);
  return true;
});

// 获取启动时传入的文件
ipcMain.handle('app:getLaunchFiles', async () => {
  return getLaunchFilePaths();
});

// 接收 preload 发来的拖拽文件路径，转发给渲染进程
ipcMain.on('drop-files', (event, filePaths) => {
  console.log('[Main] Received drop-files:', filePaths);
  if (mainWindow) {
    mainWindow.webContents.send('drop-files', filePaths);
  }
});

// 文件夹/文件监听 IPC
ipcMain.handle('fs:watchFolder', (event, dirPath) => {
  startWatchingFolder(dirPath);
  return true;
});

ipcMain.handle('fs:unwatchFolder', (event, dirPath) => {
  stopWatching(dirPath);
  return true;
});

ipcMain.handle('fs:watchFile', (event, filePath) => {
  startWatchingFile(filePath);
  return true;
});

ipcMain.handle('fs:unwatchFile', (event, filePath) => {
  stopWatching(filePath);
  return true;
});

// 窗口关闭时清理所有监听器
app.on('before-quit', () => {
  for (const [targetPath] of watchers) {
    stopWatching(targetPath);
  }
  // 清理所有终端进程
  for (const [id] of terminalSessions) {
    stopTerminalSession(id);
  }
});
