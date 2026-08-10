import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  Code,
  Image,
  File,
  FileQuestion,
  Palette,
  FileSpreadsheet,
  Presentation,
  FileType,
  X,
  Plus,
  FolderPlus,
  Copy,
  ClipboardPaste,
  Trash2,
  Terminal as TerminalIcon,
} from 'lucide-react';
import type { FileNode } from '../../types';
import { useFileStore } from '../../store/useFileStore';
import {
  getFileType,
  createFile,
  createFolder,
  copyFileOrFolder,
  deleteFileOrFolder,
} from '../../utils/fileUtils';

interface FileTreeItemProps {
  node: FileNode;
  level: number;
  onRemove?: (path: string) => void;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ node, level, onRemove }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [inputMode, setInputMode] = useState<'file' | 'folder' | null>(null);
  const [inputValue, setInputValue] = useState('');
  const { addTab, addTerminalTab, copiedItemPath, setCopiedItemPath } = useFileStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputMode]);

  const getFileIcon = () => {
    if (node.type === 'directory') {
      return isExpanded ? (
        <FolderOpen size={14} className="text-yellow-500" />
      ) : (
        <Folder size={14} className="text-yellow-500" />
      );
    }

    const fileType = getFileType(node.name);
    switch (fileType) {
      case 'code':
        return <Code size={14} className="text-blue-400" />;
      case 'markdown':
        return <FileText size={14} className="text-green-400" />;
      case 'image':
        return <Image size={14} className="text-purple-400" />;
      case 'svg':
        return <Palette size={14} className="text-cyan-400" />;
      case 'pdf':
        return <FileType size={14} className="text-red-400" />;
      case 'word':
        return <FileText size={14} className="text-blue-500" />;
      case 'excel':
        return <FileSpreadsheet size={14} className="text-green-500" />;
      case 'powerpoint':
        return <Presentation size={14} className="text-orange-500" />;
      case 'unsupported':
        return <FileQuestion size={14} className="text-gray-500" />;
      default:
        return <File size={14} className="text-gray-400" />;
    }
  };

  const handleClick = () => {
    if (node.type === 'directory') {
      setIsExpanded(!isExpanded);
    } else {
      const fileType = getFileType(node.name);
      const tab = {
        id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        path: node.path,
        name: node.name,
        type: fileType,
        isDirty: false,
      };
      addTab(tab);
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
    if (node.type !== 'directory') return;
    setInputMode('file');
    setInputValue('');
    setIsExpanded(true);
  };

  const handleCreateFolder = () => {
    closeContextMenu();
    if (node.type !== 'directory') return;
    setInputMode('folder');
    setInputValue('');
    setIsExpanded(true);
  };

  const handleCopy = () => {
    closeContextMenu();
    setCopiedItemPath(node.path);
  };

  const handlePaste = async () => {
    closeContextMenu();
    if (node.type !== 'directory' || !copiedItemPath) return;

    const sourceName = copiedItemPath.split(/[\\/]/).pop() || '';
    if (!sourceName) return;

    const targetPath = node.path + (node.path.endsWith('\\') || node.path.endsWith('/') ? '' : '\\') + sourceName;

    await copyFileOrFolder(copiedItemPath, targetPath);
    // 粘贴后保留剪贴板内容，允许多次粘贴
  };

  const handleDelete = async () => {
    closeContextMenu();
    if (confirm(`确定要删除 "${node.name}" 吗？`)) {
      await deleteFileOrFolder(node.path);
      if (copiedItemPath?.toLowerCase() === node.path.toLowerCase()) {
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

    const separator = node.path.endsWith('\\') || node.path.endsWith('/') ? '' : '\\';
    const targetPath = node.path + separator + name;

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

  const menuItems: { label: string; icon: React.ReactNode; onClick: () => void; show: boolean }[] = [
    {
      label: '新建文件',
      icon: <Plus size={14} />,
      onClick: handleCreateFile,
      show: node.type === 'directory',
    },
    {
      label: '新建文件夹',
      icon: <FolderPlus size={14} />,
      onClick: handleCreateFolder,
      show: node.type === 'directory',
    },
    {
      label: '复制',
      icon: <Copy size={14} />,
      onClick: handleCopy,
      show: true,
    },
    {
      label: '粘贴',
      icon: <ClipboardPaste size={14} />,
      onClick: handlePaste,
      show: node.type === 'directory' && !!copiedItemPath,
    },
    {
      label: '删除',
      icon: <Trash2 size={14} />,
      onClick: handleDelete,
      show: true,
    },
  ];

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-dark-hover cursor-pointer group"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {node.type === 'directory' ? (
          isExpanded ? (
            <ChevronDown size={12} className="text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-gray-500 flex-shrink-0" />
          )
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        {getFileIcon()}
        <span className="text-sm text-gray-300 truncate flex-1">{node.name}</span>
        {node.type === 'directory' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              addTerminalTab(node.path);
            }}
            className="p-0.5 rounded hover:bg-dark-border text-gray-500 hover:text-green-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            title="在终端中打开"
          >
            <TerminalIcon size={12} />
          </button>
        )}
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(node.path);
            }}
            className="p-0.5 rounded hover:bg-dark-border text-gray-500 hover:text-red-400 flex-shrink-0"
            title="从列表移除"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* 新建文件/文件夹输入框 */}
      {inputMode && (
        <div
          className="flex items-center gap-1 px-2 py-1"
          style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
        >
          {inputMode === 'file' ? <Plus size={14} className="text-gray-400" /> : <FolderPlus size={14} className="text-yellow-500" />}
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

      {node.type === 'directory' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem key={child.path} node={child} level={level + 1} />
          ))}
        </div>
      )}

      {/* 右键菜单 - fixed 定位避免被父容器裁剪 */}
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
              .filter((item) => item.show)
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

export default FileTreeItem;
