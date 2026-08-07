import React, { useState } from 'react';
import { Minus, Square, X, Terminal } from 'lucide-react';

// 扩展Window类型
declare global {
  interface Window {
    electronAPI?: {
      window?: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        unmaximize: () => Promise<void>;
        close: () => Promise<void>;
      };
    };
  }
}

interface TitleBarProps {
  title?: string;
}

const TitleBar: React.FC<TitleBarProps> = ({ title = 'Peek - 文件查看器' }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMinimize = () => {
    window.electronAPI?.window?.minimize();
  };

  const handleMaximize = () => {
    if (isMaximized) {
      window.electronAPI?.window?.unmaximize();
    } else {
      window.electronAPI?.window?.maximize();
    }
    setIsMaximized(!isMaximized);
  };

  const handleClose = () => {
    window.electronAPI?.window?.close();
  };

  return (
    <div className="h-8 bg-dark-surface border-b border-dark-border flex items-center justify-between select-none title-bar-drag">
      {/* 左侧 - Logo 和标题 */}
      <div className="flex items-center gap-2 px-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <Terminal size={14} className="text-accent ml-2" />
        <span className="text-sm text-gray-400">{title}</span>
      </div>

      {/* 右侧 - 窗口控制按钮 */}
      <div className="flex items-center h-full title-bar-no-drag">
        <button
          onClick={handleMinimize}
          className="h-8 w-12 flex items-center justify-center hover:bg-dark-hover text-gray-400 hover:text-white transition-colors"
          title="最小化"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-8 w-12 flex items-center justify-center hover:bg-dark-hover text-gray-400 hover:text-white transition-colors"
          title={isMaximized ? '还原' : '最大化'}
        >
          <Square size={14} className={isMaximized ? 'border border-current' : ''} />
        </button>
        <button
          onClick={handleClose}
          className="h-8 w-12 flex items-center justify-center hover:bg-red-500 text-gray-400 hover:text-white transition-colors"
          title="关闭"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
