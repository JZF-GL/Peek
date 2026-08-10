import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  X,
  RefreshCw,
  Plus,
  FolderPlus,
  Copy,
  ClipboardPaste,
  Trash2,
  Terminal as TerminalIcon,
} from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { buildFileTree, createFile, createFolder, copyFileOrFolder, deleteFileOrFolder } from '../../utils/fileUtils';
import FileTreeItem from './FileTreeItem';
import type { FileNode } from '../../types';

interface FolderItem {
  path: string;
  name: string;
  tree: FileNode[];
  addedAt: number;
}

interface FolderSectionProps {
  folder: FolderItem;
}

const FolderSection: React.FC<FolderSectionProps> = ({ folder }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [inputMode, setInputMode] = useState<'file' | 'folder' | null>(null);
  const [inputValue, setInputValue] = useState('');
  const { folders, addFolder, removeFolder, addTerminalTab, setLoading, setError, copiedItemPath, setCopiedItemPath } = useFileStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputMode]);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const tree = await buildFileTree(folder.path);
      addFolder(folder.path, tree);
      setLoading(false);
    } catch (error) {
      setError('刷新失败');
      setLoading(false);
      console.error(error);
    }
  };

  const handleRemove = () => {
    removeFolder(folder.path);
  };

  // 静默刷新，不显示全局 loading
  const refreshSilent = async () => {
    try {
      const tree = await buildFileTree(folder.path);
      addFolder(folder.path, tree);
    } catch (error) {
      console.error('展开刷新失败:', error);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleCreateFile = () => {
    closeContextMenu();
    setInputMode('file');
    setInputValue('');
    setIsExpanded(true);
  };

  const handleCreateFolder = () => {
    closeContextMenu();
    setInputMode('folder');
    setInputValue('');
    setIsExpanded(true);
  };

  const handleCopy = () => {
    closeContextMenu();
    setCopiedItemPath(folder.path);
  };

  const handlePaste = async () => {
    closeContextMenu();
    if (!copiedItemPath) return;

    const sourceName = copiedItemPath.split(/[\\/]/).pop() || '';
    if (!sourceName) return;

    const targetPath = folder.path + (folder.path.endsWith('\\') || folder.path.endsWith('/') ? '' : '\\') + sourceName;

    await copyFileOrFolder(copiedItemPath, targetPath);
  };

  const handleDelete = async () => {
    closeContextMenu();
    if (confirm(`确定要删除文件夹 "${folder.name}" 吗？`)) {
      await deleteFileOrFolder(folder.path);
      if (copiedItemPath?.toLowerCase() === folder.path.toLowerCase()) {
        setCopiedItemPath(null);
      }
    }
  };

  const handleInputConfirm = async () => {
    if (!inputValue.trim()) {
      setInputMode(null);
      return;
    }

    let name = inputValue.trim();
    if (inputMode === 'file' && !name.includes('.')) {
      name += '.txt';
    }

    const separator = folder.path.endsWith('\\') || folder.path.endsWith('/') ? '' : '\\';
    const targetPath = folder.path + separator + name;

    if (inputMode === 'file') {
      await createFile(targetPath);
    } else {
      await createFolder(targetPath);
    }

    setInputMode(null);
    setInputValue('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInputConfirm();
    } else if (e.key === 'Escape') {
      setInputMode(null);
      setInputValue('');
    }
  };

  const menuItems = [
    { label: '新建文件', icon: <Plus size={14} />, onClick: handleCreateFile },
    { label: '新建文件夹', icon: <FolderPlus size={14} />, onClick: handleCreateFolder },
    { label: '复制', icon: <Copy size={14} />, onClick: handleCopy },
    { label: '粘贴', icon: <ClipboardPaste size={14} />, onClick: handlePaste, show: !!copiedItemPath },
    { label: '删除', icon: <Trash2 size={14} />, onClick: handleDelete },
  ];

  return (
    <div className="mb-1">
      <div
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-dark-hover cursor-pointer group"
        onClick={() => {
          const willExpand = !isExpanded;
          setIsExpanded(willExpand);
          if (willExpand) {
            refreshSilent();
          }
        }}
        onContextMenu={handleContextMenu}
      >
        {isExpanded ? (
          <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-gray-500 flex-shrink-0" />
        )}
        <Folder size={14} className="text-yellow-500 flex-shrink-0" />
        <span className="text-sm text-gray-300 truncate flex-1" title={folder.path}>
          {folder.name}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              addTerminalTab(folder.path);
            }}
            className="p-1 rounded hover:bg-dark-border text-gray-500 hover:text-green-400"
            title="在终端中打开"
          >
            <TerminalIcon size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRefresh();
            }}
            className="p-1 rounded hover:bg-dark-border text-gray-500 hover:text-gray-300"
            title="刷新"
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            className="p-1 rounded hover:bg-dark-border text-gray-500 hover:text-red-400"
            title="关闭"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* 新建文件/文件夹输入框 */}
      {inputMode && (
        <div className="flex items-center gap-1 px-2 py-1 ml-4 pl-2">
          {inputMode === 'file' ? (
            <Plus size={14} className="text-gray-400" />
          ) : (
            <FolderPlus size={14} className="text-yellow-500" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onBlur={handleInputConfirm}
            placeholder={inputMode === 'file' ? '文件名（无后缀默认为.txt）' : '文件夹名'}
            className="flex-1 min-w-0 text-sm bg-dark-bg text-gray-200 px-2 py-0.5 rounded border border-dark-border outline-none focus:border-accent"
          />
        </div>
      )}

      {isExpanded && (
        <div className="ml-4 border-l border-dark-border pl-2">
          {folder.tree.length > 0 ? (
            folder.tree.map((node) => (
              <FileTreeItem key={node.path} node={node} level={0} />
            ))
          ) : !inputMode && (
            <div className="text-xs text-gray-600 py-1">空文件夹</div>
          )}
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeContextMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              closeContextMenu();
            }}
          />
          <div
            className="fixed z-50 min-w-[140px] bg-dark-surface border border-dark-border rounded-lg shadow-lg py-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {menuItems
              .filter((item) => item.show !== false)
              .map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:bg-dark-hover transition-colors text-left"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
};

export default FolderSection;
