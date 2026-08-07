import React from 'react';
import { FolderPlus, FilePlus, Loader2, AlertCircle, X } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { openDirectoryDialog, openFileDialog, buildFileTree } from '../../utils/fileUtils';
import { readFileContent, generateTabId } from '../../utils/fileUtils';
import FolderSection from './FolderSection';
import FileTreeItem from './FileTreeItem';
import RecentFiles from './RecentFiles';
import type { FileInfo, Tab } from '../../types';

const Sidebar: React.FC = () => {
  const { folders, openedFiles, recentFiles, addFolder, addTab, setActiveTab, setCurrentFile, setLoading, setError, isLoading, error, openTabs, removeOpenedFile, clearRecentFiles } = useFileStore();

  const handleAddFolder = async () => {
    try {
      const selectedPath = await openDirectoryDialog();
      if (selectedPath) {
        setLoading(true);
        setError(null);
        const tree = await buildFileTree(selectedPath);
        addFolder(selectedPath, tree);
        setLoading(false);
      }
    } catch (error) {
      setError('打开文件夹失败');
      setLoading(false);
      console.error(error);
    }
  };

  const handleOpenFile = async () => {
    try {
      const filePaths = await openFileDialog();
      for (const filePath of filePaths) {
        // 检查是否已打开
        const existingTab = openTabs.find(tab => tab.path === filePath);
        if (existingTab) {
          setActiveTab(existingTab.id);
          continue;
        }

        // 读取文件内容
        const fileInfo: FileInfo | null = await readFileContent(filePath);
        if (!fileInfo) {
          console.error('Failed to read file:', filePath);
          continue;
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
      }
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-dark-surface">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-dark-border">
        <button
          onClick={handleOpenFile}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-dark-bg rounded hover:bg-dark-hover transition-colors text-gray-300 text-sm"
          title="打开文件（可多选）"
        >
          <FilePlus size={14} />
          <span>打开文件</span>
        </button>
        <button
          onClick={handleAddFolder}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-dark-bg rounded hover:bg-dark-hover transition-colors text-gray-300 text-sm"
          title="添加文件夹"
        >
          <FolderPlus size={14} />
          <span>添加文件夹</span>
        </button>
      </div>

      {/* 上半部分 - 文件夹/文件列表 */}
      <div className="flex-1 flex flex-col min-h-0 border-b border-dark-border">
        <div className="flex items-center justify-between px-3 py-2 border-b border-dark-border">
          <span className="text-sm font-medium text-gray-300">文件夹/文件</span>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {/* Loading 状态 */}
          {isLoading && (
            <div className="absolute inset-0 bg-dark-surface/90 flex items-center justify-center z-10">
              <div className="text-center">
                <Loader2 size={32} className="animate-spin text-accent mx-auto mb-2" />
                <p className="text-sm text-gray-400">正在加载...</p>
                <p className="text-xs text-gray-500 mt-1">请稍候</p>
              </div>
            </div>
          )}
          
          {/* Error 状态 */}
          {error && (
            <div className="p-3 mx-2 mt-2 bg-red-900/30 border border-red-500/50 rounded-lg">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle size={16} />
                <span className="text-sm">{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
              >
                知道了
              </button>
            </div>
          )}
          
          {/* 打开的文件列表 */}
          {openedFiles.length > 0 && (
            <div className="p-1 pb-0">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs text-gray-500 font-medium">打开的文件</span>
                <button
                  onClick={() => openedFiles.forEach((f) => removeOpenedFile(f.path))}
                  className="p-0.5 rounded hover:bg-dark-border text-gray-500 hover:text-gray-300"
                  title="清空列表"
                >
                  <X size={12} />
                </button>
              </div>
              {openedFiles.map((file) => (
                <FileTreeItem key={file.path} node={file} level={0} onRemove={removeOpenedFile} />
              ))}
            </div>
          )}

          {folders.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500 mb-3">暂无文件夹</p>
              <button
                onClick={handleAddFolder}
                disabled={isLoading}
                className="w-full py-2 px-3 text-sm bg-dark-border rounded hover:bg-dark-hover transition-colors text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FolderPlus size={14} className="inline mr-2" />
                添加文件夹
              </button>
            </div>
          ) : (
            <div className="p-1">
              {folders.map((folder) => (
                <FolderSection key={folder.path} folder={folder} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 下半部分 - 最近文件 */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-dark-border">
          <span className="text-sm font-medium text-gray-300">最近文件</span>
          {recentFiles.length > 0 && (
            <button
              onClick={clearRecentFiles}
              className="p-0.5 rounded hover:bg-dark-border text-gray-500 hover:text-red-400 transition-colors"
              title="清空最近文件"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <RecentFiles />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
