const { contextBridge, ipcRenderer, webUtils } = require('electron');

// 在渲染进程中暴露安全的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制 API
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    unmaximize: () => ipcRenderer.invoke('window:unmaximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // 对话框 API
  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
  },

  // 文件系统 API
  fs: {
    readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
    buildTree: (dirPath) => ipcRenderer.invoke('fs:buildTree', dirPath),
    readTextFile: (filePath) => ipcRenderer.invoke('fs:readTextFile', filePath),
    readBinaryFile: (filePath) => ipcRenderer.invoke('fs:readBinaryFile', filePath),
    writeTextFile: (filePath, content) => ipcRenderer.invoke('fs:writeTextFile', filePath, content),
    getFileInfo: (filePath) => ipcRenderer.invoke('fs:getFileInfo', filePath),
  },

  // Shell API
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  },

  // App API
  app: {
    getLaunchFiles: () => ipcRenderer.invoke('app:getLaunchFiles'),
    onOpenFiles: (callback) => {
      ipcRenderer.on('open-files', (event, filePaths) => {
        callback(filePaths);
      });
    },
    // 监听拖拽的文件（由 preload 处理后发送过来）
    onDropFiles: (callback) => {
      ipcRenderer.on('drop-files', (event, filePaths) => {
        callback(filePaths);
      });
    },
  },

  // 环境信息
  getPlatform: () => process.platform,
  isElectron: true,
});

// 在 preload 中直接监听 drop 事件并处理
// 这样可以直接访问 File 对象，不需要通过 contextBridge 传递
function setupDropHandler() {
  console.log('[Preload] Setting up drop handler...');

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const filePaths = [];
    
    // webUtils.getPathForFile 在 preload 中可以直接使用
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // 在 preload 上下文中直接调用
        const path = webUtils.getPathForFile(file);
        if (path) {
          filePaths.push(path);
        }
      } catch (err) {
        console.error('[Preload] getPathForFile error:', err);
      }
    }

    console.log('[Preload] Dropped files:', filePaths);

    // 通过 IPC 发送给主进程
    if (filePaths.length > 0) {
      ipcRenderer.send('drop-files', filePaths);
    }
  };

  // 监听 dragover 以允许 drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  window.addEventListener('drop', handleDrop);
  window.addEventListener('dragover', handleDragOver);

  console.log('[Preload] Drop handler set up');
}

setupDropHandler();
