import React, { useEffect, useState, useCallback, useRef } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import TabBar from './components/Tabs/TabBar';
import FileViewer from './components/FileViewer';
import ErrorBoundary from './components/ErrorBoundary';
import { useFileStore } from './store/useFileStore';
import { readFileContent, generateTabId, buildFileTree } from './utils/fileUtils';
import { AlertCircle, FileUp } from 'lucide-react';
import type { FileInfo, Tab } from './types';
import type { ElectronAPI } from './types/electron';

// 文件查看器的错误边界包装
const FileViewerWithErrorBoundary: React.FC = () => {
  return (
    <ErrorBoundary fallback={
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto mb-4 text-yellow-500" />
          <h3 className="text-lg text-gray-300 mb-2">文件加载失败</h3>
          <p className="text-gray-500 text-sm">该文件可能已损坏或格式不支持</p>
        </div>
      </div>
    }>
      <FileViewer />
    </ErrorBoundary>
  );
};

// 侧边栏的错误边界包装
const SidebarWithErrorBoundary: React.FC = () => {
  return (
    <ErrorBoundary fallback={
      <div className="h-full flex items-center justify-center bg-dark-surface">
        <div className="text-center p-4">
          <AlertCircle size={32} className="mx-auto mb-3 text-yellow-500" />
          <h3 className="text-sm text-gray-300 mb-1">侧边栏加载失败</h3>
          <p className="text-gray-500 text-xs">请尝试重启应用</p>
        </div>
      </div>
    }>
      <Sidebar />
    </ErrorBoundary>
  );
};

const App: React.FC = () => {
  const { folders, openTabs, activeTabId, addTab, setActiveTab, setCurrentFile, refreshFolder } = useFileStore();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const watchedFoldersRef = useRef<Set<string>>(new Set());
  const watchedFilesRef = useRef<Set<string>>(new Set());
  const unwatchFileRef = useRef<(() => void) | null>(null);
  const unwatchFolderRef = useRef<(() => void) | null>(null);

  // 打开文件的统一方法
  const openFile = useCallback(async (filePath: string) => {
    try {
      // 检查是否已打开
      const existingTab = openTabs.find(tab => tab.path === filePath);
      if (existingTab) {
        setActiveTab(existingTab.id);
        return;
      }

      // 读取文件内容
      const fileInfo: FileInfo | null = await readFileContent(filePath);
      if (!fileInfo) {
        console.error('Failed to read file:', filePath);
        return;
      }

      // 创建新 tab
      const newTab: Tab = {
        id: generateTabId(),
        path: fileInfo.path,
        name: fileInfo.name,
        type: fileInfo.type,
        content: fileInfo.content || '',
        language: fileInfo.language,
        isDirty: false,
      };

      addTab(newTab);
      setCurrentFile(fileInfo);
    } catch (error) {
      console.error('Error opening file:', error);
      setGlobalError('打开文件失败');
    }
  }, [openTabs, addTab, setActiveTab, setCurrentFile]);

  // 处理多个文件
  const openFiles = useCallback(async (filePaths: string[]) => {
    for (const filePath of filePaths) {
      await openFile(filePath);
    }
  }, [openFile]);

  // 初始化应用
  useEffect(() => {
    const initApp = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          const electronAPI = (window as any).electronAPI as ElectronAPI;
          document.title = 'Peek - 文件查看器';

          // 获取启动时的文件
          if (electronAPI.app) {
            const launchFiles = await electronAPI.app.getLaunchFiles();
            if (launchFiles.length > 0) {
              await openFiles(launchFiles);
            }

            // 监听新打开的文件
            electronAPI.app.onOpenFiles(async (filePaths: string[]) => {
              await openFiles(filePaths);
            });

            // 监听拖拽的文件（由 preload 处理）
            electronAPI.app.onDropFiles(async (filePaths: string[]) => {
              console.log('Received dropped files from preload:', filePaths);
              if (filePaths.length > 0) {
                await openFiles(filePaths);
              }
            });
          }
        }
      } catch (error) {
        console.log('环境设置:', error);
      }
    };

    initApp();
  }, [openFiles]);

  // 注册文件夹/文件监听
  useEffect(() => {
    const electronAPI = (window as any).electronAPI as ElectronAPI | undefined;
    if (!electronAPI?.fs) return;

    const fs = electronAPI.fs;

    // 监听文件夹变化，刷新对应的文件树
    unwatchFolderRef.current = fs.onFolderChanged(async (dirPath) => {
      try {
        const tree = await buildFileTree(dirPath);
        refreshFolder(dirPath, tree);
      } catch (err) {
        console.error('刷新文件夹失败:', err);
      }
    });

    // 监听文件变化，通过自定义事件通知 FileViewer 处理
    unwatchFileRef.current = fs.onFileChanged((filePath) => {
      window.dispatchEvent(new CustomEvent('external-file-changed', { detail: filePath }));
    });

    return () => {
      unwatchFolderRef.current?.();
      unwatchFolderRef.current = null;
      unwatchFileRef.current?.();
      unwatchFileRef.current = null;
    };
  }, [refreshFolder]);

  // 根据 folders 变化注册/注销目录监听
  useEffect(() => {
    const electronAPI = (window as any).electronAPI as ElectronAPI | undefined;
    if (!electronAPI?.fs) return;

    const fs = electronAPI.fs;
    const currentFolderPaths = new Set(folders.map((f) => f.path));

    // 新增
    for (const folder of folders) {
      if (!watchedFoldersRef.current.has(folder.path)) {
        fs.watchFolder(folder.path).catch((err) => console.error('监听文件夹失败:', err));
        watchedFoldersRef.current.add(folder.path);
      }
    }

    // 移除
    for (const watchedPath of Array.from(watchedFoldersRef.current)) {
      if (!currentFolderPaths.has(watchedPath)) {
        fs.unwatchFolder(watchedPath).catch((err) => console.error('取消监听文件夹失败:', err));
        watchedFoldersRef.current.delete(watchedPath);
      }
    }
  }, [folders]);

  // 根据当前激活 tab 变化注册/注销文件监听
  useEffect(() => {
    const electronAPI = (window as any).electronAPI as ElectronAPI | undefined;
    if (!electronAPI?.fs) return;

    const fs = electronAPI.fs;
    const activeTab = openTabs.find((tab) => tab.id === activeTabId);
    const activeFilePath = activeTab?.path;

    // 清理不再监听的文件
    for (const watchedPath of Array.from(watchedFilesRef.current)) {
      if (watchedPath !== activeFilePath) {
        fs.unwatchFile(watchedPath).catch((err) => console.error('取消监听文件失败:', err));
        watchedFilesRef.current.delete(watchedPath);
      }
    }

    // 监听当前文件
    if (activeFilePath && !watchedFilesRef.current.has(activeFilePath)) {
      fs.watchFile(activeFilePath).catch((err) => console.error('监听文件失败:', err));
      watchedFilesRef.current.add(activeFilePath);
    }
  }, [openTabs, activeTabId]);

  // 键盘快捷键（Ctrl+S 的保存逻辑由各可编辑组件自行处理，这里只阻止浏览器默认保存行为）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 拖拽状态管理（用于显示UI提示）
  useEffect(() => {
    // 深度计数器：进入蒙层子元素时也会触发父元素 dragleave，
    // 用计数器配对抵消，只有真正离开窗口时才关闭蒙层
    let dragDepth = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragDepth += 1;
      setIsDragging(true);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      // 不在这里 setState，避免频繁触发渲染
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragDepth -= 1;
      if (dragDepth <= 0) {
        dragDepth = 0;
        setIsDragging(false);
      }
    };

    // 文件实际打开由 preload.js 处理，这里只负责关闭蒙层
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth = 0;
      setIsDragging(false);
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // 全局错误处理
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      setGlobalError(event.message || '发生未知错误');
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // 全局错误提示（3秒后自动消失）
  useEffect(() => {
    if (globalError) {
      const timer = setTimeout(() => setGlobalError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [globalError]);

  return (
    <ErrorBoundary>
      <div className="h-screen w-screen flex flex-col bg-dark-bg overflow-hidden">
        {/* 拖拽遮罩 */}
        {isDragging && (
          <div className="fixed inset-0 z-50 bg-blue-500/20 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-dark-surface border-2 border-dashed border-blue-500 rounded-xl p-12 text-center">
              <FileUp size={64} className="mx-auto mb-4 text-blue-400" />
              <h3 className="text-xl font-medium text-gray-200 mb-2">释放文件以打开</h3>
              <p className="text-gray-400">支持拖拽一个或多个文件到此处</p>
            </div>
          </div>
        )}

        {/* 全局错误提示 */}
        {globalError && (
          <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 bg-yellow-900/90 border border-yellow-500/50 rounded-lg px-4 py-2 shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-yellow-400" />
              <span className="text-sm text-yellow-200">{globalError}</span>
            </div>
          </div>
        )}

        {/* 自定义标题栏 */}
        <TitleBar />

        {/* 主内容区域 */}
        <div className="flex-1 flex min-h-0">
          {/* 侧边栏 */}
          <div className="w-72 flex-shrink-0 min-h-0">
            <SidebarWithErrorBoundary />
          </div>

          {/* 右侧内容区 */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {openTabs.length > 0 && (
              <ErrorBoundary fallback={null}>
                <TabBar />
              </ErrorBoundary>
            )}
            <div className="flex-1 overflow-hidden">
              <FileViewerWithErrorBoundary />
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
