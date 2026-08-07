import React from 'react';
import { X, FileText, Code, Image, File } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { getFileType } from '../../utils/fileUtils';

const RecentFiles: React.FC = () => {
  const { recentFiles, removeRecentFile, addTab } = useFileStore();

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'code':
        return <Code size={14} className="text-blue-400 flex-shrink-0" />;
      case 'markdown':
        return <FileText size={14} className="text-green-400 flex-shrink-0" />;
      case 'image':
        return <Image size={14} className="text-purple-400 flex-shrink-0" />;
      default:
        return <File size={14} className="text-gray-400 flex-shrink-0" />;
    }
  };

  const handleOpenFile = (file: typeof recentFiles[0]) => {
    const tab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      path: file.path,
      name: file.name,
      type: getFileType(file.name),
      isDirty: false,
    };
    addTab(tab);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    
    return date.toLocaleDateString();
  };

  if (recentFiles.length === 0) {
    return (
      <div className="text-sm text-gray-500 px-2 py-4 text-center">
        暂无最近文件
      </div>
    );
  }

  return (
    <div className="px-1">
      {recentFiles.map((file) => (
        <div
          key={file.path}
          className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-dark-hover cursor-pointer transition-colors"
          onClick={() => handleOpenFile(file)}
        >
          {getFileIcon(file.type)}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-300 truncate">{file.name}</div>
            <div className="text-xs text-gray-500 truncate">{file.path}</div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {formatTime(file.openedAt)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeRecentFile(file.path);
              }}
              className="p-1 rounded hover:bg-dark-border transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RecentFiles;
