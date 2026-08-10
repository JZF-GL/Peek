import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Save, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { readFileContent, readFileTextOnly, saveFileContent, getLanguage, getFileType, getFileExtension } from '../../utils/fileUtils';
import CodeEditor from '../Editor/CodeEditor';
import MarkdownViewer from '../MarkdownViewer';
import ImageViewer from '../ImageViewer';
import SvgViewer from '../SvgViewer';
import PdfViewer from '../PdfViewer';
import WordViewer from '../WordViewer';
import ExcelViewer from '../ExcelViewer';
import PowerPointViewer from '../PowerPointViewer';
import UnsupportedFile from './UnsupportedFile';

const FileViewer: React.FC = () => {
  const { openTabs, activeTabId, updateTabContent, closeTab, markTabClean } = useFileStore();
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSavedAtRef = useRef<number>(0);

  const activeTab = openTabs.find((tab) => tab && tab.id === activeTabId);
  
  // 所有 hooks 必须在顶层调用
  // 定义所有处理函数
  const handleSave = useCallback(async (filePath: string, content: string) => {
    try {
      const success = await saveFileContent(filePath, content);
      if (success && activeTab) {
        lastSavedAtRef.current = Date.now();
        markTabClean(activeTab.id);
      }
      return success;
    } catch (err) {
      console.error('Save failed:', err);
      setError('保存失败');
      return false;
    }
  }, [activeTab, markTabClean]);

  const handleContentChange = useCallback((filePath: string, newContent: string) => {
    if (typeof newContent !== 'string' || !activeTab) return;
    setFileContents((prev) => {
      const newMap = new Map(prev);
      newMap.set(filePath, newContent);
      return newMap;
    });
    updateTabContent(activeTab.id, newContent);
  }, [activeTab, updateTabContent]);

  const handleRetry = useCallback(() => {
    if (!activeTab) return;
    setFileContents((prev) => {
      const newMap = new Map(prev);
      newMap.delete(activeTab.path);
      return newMap;
    });
    setError(null);
  }, [activeTab]);

  const handleClose = useCallback(() => {
    if (activeTab) {
      closeTab(activeTab.id);
    }
  }, [activeTab, closeTab]);

  // 监听外部文件变化，自动刷新当前未修改的文件
  useEffect(() => {
    const handleExternalChange = async (e: Event) => {
      const changedPath = (e as CustomEvent<string>).detail;
      if (!activeTab || changedPath !== activeTab.path) return;
      // 保存后 1 秒内忽略自身触发的事件，避免误刷新
      if (Date.now() - lastSavedAtRef.current < 1000) return;
      // 仅当文件未被修改时才自动刷新，避免覆盖用户编辑
      if (activeTab.isDirty) return;

      try {
        const newContent = await readFileTextOnly(changedPath);
        if (newContent !== null) {
          setFileContents((prev) => {
            const newMap = new Map(prev);
            newMap.set(changedPath, newContent);
            return newMap;
          });
        }
      } catch (err) {
        console.error('外部刷新失败:', err);
      }
    };

    window.addEventListener('external-file-changed', handleExternalChange);
    return () => window.removeEventListener('external-file-changed', handleExternalChange);
  }, [activeTab]);

  // Ctrl+S 快捷保存（代码/文本类型）
  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return;
      const type = activeTab?.type || (activeTab ? getFileType(activeTab.name) : '');
      if (!activeTab || (type !== 'code' && type !== 'text') || !activeTab.isDirty) return;
      e.preventDefault();
      const content = fileContents.get(activeTab.path) ?? activeTab.content ?? '';
      handleSave(activeTab.path, content);
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [activeTab, fileContents, handleSave]);

  // 加载内容的 effect
  useEffect(() => {
    if (!activeTab || !activeTab.path) return;
    
    const fileType = getFileType(activeTab.name);
    
    // 图片或不支持的类型不需要加载
    if (fileType === 'image' || fileType === 'unsupported') {
      setLoading(false);
      return;
    }
    
    // 如果已有内容，不重复加载
    if (fileContents.has(activeTab.path)) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadContent = async () => {
      setLoading(true);
      setError(null);

      try {
        const fileInfo = await readFileContent(activeTab.path);
        
        if (!isMounted) return;

        if (fileInfo && fileInfo.content !== undefined && fileInfo.content !== null) {
          const content = typeof fileInfo.content === 'string' 
            ? fileInfo.content 
            : String(fileInfo.content);
            
          setFileContents((prev) => {
            const newMap = new Map(prev);
            newMap.set(activeTab.path, content);
            return newMap;
          });
        } else {
          setError('文件内容为空');
        }
      } catch (err) {
        console.error('Error loading file:', err);
        if (isMounted) {
          setError('加载失败: ' + (err instanceof Error ? err.message : '未知错误'));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadContent();

    return () => {
      isMounted = false;
    };
  }, [activeTab?.path, activeTab?.name]);

  // 渲染逻辑 - 所有 hooks 调用完毕后再返回
  // 没有激活的标签
  if (!activeTab) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <FileText size={64} className="mx-auto mb-4 text-gray-600" />
          <h2 className="text-xl text-gray-400 mb-2">欢迎使用 Peek</h2>
          <p className="text-gray-500">从左侧选择文件开始浏览</p>
        </div>
      </div>
    );
  }

  // 优先使用 tab 中已保存的 type，否则重新计算
  const fileType = activeTab.type || getFileType(activeTab.name);
  
  // 调试信息
  console.log('DEBUG FileViewer:', {
    name: activeTab.name,
    tabType: activeTab.type,
    calculatedType: getFileType(activeTab.name),
    finalType: fileType,
    extension: getFileExtension(activeTab.name)
  });

  // 不支持的文件类型
  if (fileType === 'unsupported') {
    return (
      <UnsupportedFile
        fileName={activeTab.name}
        fileExtension={getFileExtension(activeTab.name)}
      />
    );
  }

  // 加载中
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-gray-400">加载中...</div>
        </div>
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="text-center max-w-md mx-auto px-8">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
          <h3 className="text-lg text-red-400 mb-2">加载失败</h3>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-4 py-2 bg-dark-surface hover:bg-dark-hover text-gray-300 rounded-lg transition-colors"
            >
              <RefreshCw size={16} />
              <span>重试</span>
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-dark-surface hover:bg-dark-hover text-gray-300 rounded-lg transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 图片类型
  if (fileType === 'image') {
    return <ImageViewer imagePath={activeTab.path} />;
  }

  // 获取内容
  const content = fileContents.get(activeTab.path);

  // SVG 类型 - 特殊处理，可以预览和编辑
  if (fileType === 'svg') {
    if (content === undefined) {
      return (
        <div className="h-full flex items-center justify-center bg-dark-bg">
          <div className="text-gray-500">加载中...</div>
        </div>
      );
    }
    return (
      <SvgViewer
        filePath={activeTab.path}
        initialContent={content}
        onSave={(newContent) => handleSave(activeTab.path, newContent)}
      />
    );
  }

  // 办公文档类型 - 直接传递文件路径给专门的预览组件
  if (fileType === 'pdf') {
    return <PdfViewer filePath={activeTab.path} />;
  }

  if (fileType === 'word') {
    return <WordViewer filePath={activeTab.path} />;
  }

  if (fileType === 'excel') {
    return <ExcelViewer filePath={activeTab.path} />;
  }

  if (fileType === 'powerpoint') {
    return <PowerPointViewer filePath={activeTab.path} />;
  }

  // Markdown 类型
  if (fileType === 'markdown') {
    if (content === undefined) {
      return (
        <div className="h-full flex items-center justify-center bg-dark-bg">
          <div className="text-gray-500">加载中...</div>
        </div>
      );
    }
    return <MarkdownViewer filePath={activeTab.path} initialContent={content} />;
  }

  // 代码/文本类型
  if (fileType === 'code' || fileType === 'text') {
    if (content === undefined) {
      return (
        <div className="h-full flex items-center justify-center bg-dark-bg">
          <div className="text-gray-500">加载中...</div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col bg-dark-bg">
        <div className="flex items-center justify-between px-4 py-2 bg-dark-surface border-b border-dark-border">
          <div className="text-sm text-gray-400">
            {getLanguage(activeTab.name)}
          </div>
          <button
            className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
              activeTab.isDirty
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
            onClick={() => handleSave(activeTab.path, content)}
            disabled={!activeTab.isDirty}
          >
            <Save size={14} />
            <span className="text-sm">保存</span>
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <CodeEditor
            value={content}
            language={getLanguage(activeTab.name)}
            onChange={(newContent) => handleContentChange(activeTab.path, newContent)}
          />
        </div>
      </div>
    );
  }

  // Fallback - 未知类型也尝试作为代码显示
  if (content === undefined) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      <div className="flex items-center justify-between px-4 py-2 bg-dark-surface border-b border-dark-border">
        <div className="text-sm text-gray-400">
          {getLanguage(activeTab.name)}
        </div>
        <button
          className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
            activeTab.isDirty
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
          onClick={() => handleSave(activeTab.path, content)}
          disabled={!activeTab.isDirty}
        >
          <Save size={14} />
          <span className="text-sm">保存</span>
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <CodeEditor
          value={content}
          language={getLanguage(activeTab.name)}
          onChange={(newContent) => handleContentChange(activeTab.path, newContent)}
        />
      </div>
    </div>
  );
};

export default FileViewer;
