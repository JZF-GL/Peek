import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, FileText, Code, Image, File, FileQuestion, Palette, FileSpreadsheet, Presentation, FileType, X } from 'lucide-react';
import type { FileNode } from '../../types';
import { useFileStore } from '../../store/useFileStore';
import { getFileType } from '../../utils/fileUtils';

interface FileTreeItemProps {
  node: FileNode;
  level: number;
  onRemove?: (path: string) => void;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ node, level, onRemove }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { addTab } = useFileStore();

  const getFileIcon = () => {
    if (node.type === 'directory') {
      return isExpanded ? <FolderOpen size={14} className="text-yellow-500" /> : <Folder size={14} className="text-yellow-500" />;
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

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-dark-hover cursor-pointer group"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'directory' && (
          isExpanded ? (
            <ChevronDown size={12} className="text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-gray-500 flex-shrink-0" />
          )
        )}
        {node.type !== 'directory' && (
          <span className="w-3 flex-shrink-0" />
        )}
        {getFileIcon()}
        <span className="text-sm text-gray-300 truncate flex-1">{node.name}</span>
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
      {node.type === 'directory' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem key={child.path} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export default FileTreeItem;
