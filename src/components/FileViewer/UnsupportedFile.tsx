import React from 'react';
import { FileQuestion, Download, ExternalLink } from 'lucide-react';

interface UnsupportedFileProps {
  fileName: string;
  fileExtension: string;
  fileSize?: number;
}

const UnsupportedFile: React.FC<UnsupportedFileProps> = ({ 
  fileName, 
  fileExtension,
  fileSize 
}) => {
  const formatSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getSuggestion = (ext: string): string => {
    const suggestions: Record<string, string> = {
      'pdf': '请使用 Adobe Reader 或其他 PDF 阅读器打开',
      'doc': '请使用 Microsoft Word 或 WPS 打开',
      'docx': '请使用 Microsoft Word 或 WPS 打开',
      'xls': '请使用 Microsoft Excel 或 WPS 打开',
      'xlsx': '请使用 Microsoft Excel 或 WPS 打开',
      'ppt': '请使用 Microsoft PowerPoint 或 WPS 打开',
      'pptx': '请使用 Microsoft PowerPoint 或 WPS 打开',
      'zip': '请使用解压软件打开',
      'rar': '请使用解压软件打开',
      '7z': '请使用解压软件打开',
      'exe': '可执行文件不支持预览',
      'dll': '动态链接库不支持预览',
      'mp3': '音频文件不支持预览',
      'mp4': '视频文件不支持预览',
      'avi': '视频文件不支持预览',
      'mov': '视频文件不支持预览',
    };
    return suggestions[ext.toLowerCase()] || '该文件格式暂不支持预览';
  };

  return (
    <div className="h-full flex items-center justify-center bg-dark-bg">
      <div className="text-center max-w-md mx-auto px-8">
        <div className="mb-6">
          <div className="w-24 h-24 mx-auto bg-dark-surface rounded-2xl flex items-center justify-center mb-4">
            <FileQuestion size={48} className="text-gray-500" />
          </div>
          <div className="inline-block px-4 py-1 bg-dark-surface rounded-full">
            <span className="text-lg font-mono text-accent uppercase">
              {fileExtension || 'unknown'}
            </span>
          </div>
        </div>

        <h3 className="text-xl font-medium text-gray-300 mb-2">
          暂不支持此文件格式
        </h3>
        
        <p className="text-gray-500 mb-2 truncate" title={fileName}>
          {fileName}
        </p>
        
        {fileSize && (
          <p className="text-sm text-gray-600 mb-4">
            {formatSize(fileSize)}
          </p>
        )}

        <div className="bg-dark-surface rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-400">
            {getSuggestion(fileExtension)}
          </p>
        </div>

        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Download size={14} />
            <span>文件已识别</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnsupportedFile;
