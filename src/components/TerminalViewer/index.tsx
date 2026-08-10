import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, Square, RotateCw, FolderOpen } from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewerProps {
  sessionId: string;
  cwd: string;
  command?: string;
}

// 获取 preload 暴露的终端 API
const getTerminalApi = () => {
  const api = (window as any).electronAPI?.terminal;
  return api as
    | {
        start: (id: string, cwd: string, command?: string) => Promise<unknown>;
        write: (id: string, data: string) => void;
        stop: (id: string) => Promise<boolean>;
        resize: (id: string, cols: number, rows: number) => void;
        onOutput: (cb: (payload: { id: string; data: string }) => void) => () => void;
        onExit: (cb: (payload: { id: string; code: number }) => void) => () => void;
      }
    | undefined;
};

const TerminalViewer: React.FC<TerminalViewerProps> = ({ sessionId, cwd, command }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [exited, setExited] = useState(false);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      cols: 80,
      // 将 \n 规范为 \r\n，减少个别程序输出换行异常
      convertEol: true,
      theme: {
        background: '#1a1a2e',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
        selectionBackground: '#264f78',
      },
      scrollback: 5000,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    if (containerRef.current) {
      term.open(containerRef.current);
      // 打开后立即聚焦，确保键盘输入直接进入终端
      term.focus();
    }

    const api = getTerminalApi();
    if (!api) return;

    const offOutput = api.onOutput(({ id, data }) => {
      if (id === sessionId) {
        term.write(data);
      }
    });
    const offExit = api.onExit(({ id, code }) => {
      if (id === sessionId) {
        setExited(true);
        term.write(`\r\n\x1b[90m[进程已退出，退出码 ${code}]\x1b[0m\r\n`);
      }
    });

    // 启动终端会话（会话已存在时会恢复之前的输出）
    api.start(sessionId, cwd, command).catch((err) => {
      console.error('Terminal start failed:', err);
    });

    // 用户输入转发到主进程
    const onData = (data: string) => {
      api.write(sessionId, data);
      // 交互式 shell（无固定命令）下，cmd 管道模式不回显输入，
      // 本地回显让用户能看到自己输入的内容
      if (!command) {
        term.write(data.replace(/\r/g, '\r\n').replace(/\x7f/g, '\x08'));
      }
    };
    term.onData(onData);

    // 固定 80 列：CLI 工具（vite/rollup/npm 等）在非 TTY 下默认按 80 列输出
    // 控制序列（\r 重绘、清行、定位）。固定列宽保证与工具假设一致，避免
    // 单词被硬切、行重叠错乱；行数随容器高度自适应。
    const applySize = () => {
      if (!termRef.current || !containerRef.current) return;
      const height = containerRef.current.clientHeight || 400;
      const rows = Math.max(5, Math.floor(height / 16));
      termRef.current.resize(80, rows);
      api.resize(sessionId, 80, rows);
    };

    // 延迟到容器布局完成后设置一次尺寸
    setTimeout(applySize, 50);

    const ro = new ResizeObserver(applySize);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', applySize);

    return () => {
      offOutput();
      offExit();
      ro.disconnect();
      window.removeEventListener('resize', applySize);
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      // 不停止进程：切换 tab 后会话保留，回来时继续显示
    };
  }, [sessionId, cwd, command]);

  const handleStop = async () => {
    const api = getTerminalApi();
    if (!api) return;
    await api.stop(sessionId);
    if (termRef.current) {
      termRef.current.write('\r\n\x1b[90m[进程已终止]\x1b[0m\r\n');
    }
    setExited(true);
  };

  const handleRestart = async () => {
    const api = getTerminalApi();
    if (!api) return;
    await api.stop(sessionId);
    if (termRef.current) {
      termRef.current.reset();
      termRef.current.write('\r\n\x1b[90m[重新启动终端]\x1b[0m\r\n');
    }
    setExited(false);
    try {
      await api.start(sessionId, cwd, command);
    } catch (err) {
      console.error('Terminal restart failed:', err);
    }
  };

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      <div className="flex items-center justify-between px-4 py-1.5 bg-dark-surface border-b border-dark-border">
        <div className="flex items-center gap-2 text-sm text-gray-400 truncate min-w-0">
          <TerminalIcon size={14} className="text-green-400 flex-shrink-0" />
          <FolderOpen size={12} className="flex-shrink-0" />
          <span className="truncate" title={cwd}>
            {cwd}
          </span>
          {command && <span className="text-accent truncate">› {command}</span>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <button
            onClick={handleStop}
            className="p-1 rounded hover:bg-dark-border text-gray-500 hover:text-red-400 transition-colors"
            title="终止进程"
          >
            <Square size={12} />
          </button>
          <button
            onClick={handleRestart}
            className="p-1 rounded hover:bg-dark-border text-gray-500 hover:text-gray-300 transition-colors"
            title="重新启动"
          >
            <RotateCw size={12} />
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        onClick={() => termRef.current?.focus()}
      />
    </div>
  );
};

export default TerminalViewer;
