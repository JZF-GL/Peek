import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Folder, Trash2, RefreshCw } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { buildFileTree } from '../../utils/fileUtils';
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
  const { folders, addFolder, removeFolder, setLoading, setError } = useFileStore();

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

  return (
    <div className="mb-1">
      <div
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-dark-hover cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
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
            title="移除"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="ml-4 border-l border-dark-border pl-2">
          {folder.tree.length > 0 ? (
            folder.tree.map((node) => (
              <FileTreeItem key={node.path} node={node} level={0} />
            ))
          ) : (
            <div className="text-xs text-gray-600 py-1">空文件夹</div>
          )}
        </div>
      )}
    </div>
  );
};

export default FolderSection;
