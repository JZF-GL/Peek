import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Eye, Edit3, Save } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { saveFileContent, readFileTextOnly } from '../../utils/fileUtils';
import CodeEditor from '../Editor/CodeEditor';

interface MarkdownViewerProps {
  filePath: string;
  initialContent: string;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ filePath, initialContent }) => {
  const [content, setContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { updateTabContent } = useFileStore();

  useEffect(() => {
    setContent(initialContent);
    setIsDirty(false);
  }, [initialContent]);

  useEffect(() => {
    updateTabContent(filePath, content);
    setIsDirty(true);
  }, [content]);

  const handleSave = async () => {
    setIsSaving(true);
    const success = await saveFileContent(filePath, content);
    if (success) {
      setIsDirty(false);
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  // Ctrl+S 快捷保存
  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return;
      if (!isEditing || !isDirty) return;
      e.preventDefault();
      handleSave();
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [isEditing, isDirty, handleSave]);

  // 监听外部文件变化，自动刷新未修改的内容
  useEffect(() => {
    const handleExternalChange = async (e: Event) => {
      const changedPath = (e as CustomEvent<string>).detail;
      if (changedPath !== filePath || isDirty || isSaving) return;
      try {
        const newContent = await readFileTextOnly(filePath);
        if (newContent !== null) {
          setContent(newContent);
          setIsDirty(false);
        }
      } catch (err) {
        console.error('Markdown 外部刷新失败:', err);
      }
    };
    window.addEventListener('external-file-changed', handleExternalChange);
    return () => window.removeEventListener('external-file-changed', handleExternalChange);
  }, [filePath, isDirty, isSaving]);

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      <div className="flex items-center justify-between px-4 py-2 bg-dark-surface border-b border-dark-border">
        <div className="flex items-center gap-2">
          <button
            className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
              !isEditing
                ? 'bg-accent text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setIsEditing(false)}
          >
            <Eye size={14} />
            <span className="text-sm">预览</span>
          </button>
          <button
            className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
              isEditing
                ? 'bg-accent text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setIsEditing(true)}
          >
            <Edit3 size={14} />
            <span className="text-sm">编辑</span>
          </button>
        </div>
        {isEditing && (
          <button
            className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
              isDirty
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
            onClick={handleSave}
            disabled={!isDirty || isSaving}
          >
            <Save size={14} />
            <span className="text-sm">{isSaving ? '保存中...' : '保存'}</span>
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {isEditing ? (
          <CodeEditor
            value={content}
            language="markdown"
            onChange={handleContentChange}
          />
        ) : (
          <div className="markdown-preview p-8 max-w-4xl mx-auto">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkdownViewer;
