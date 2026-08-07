import React, { useState, useEffect, useRef, useCallback } from 'react';
import mammoth from 'mammoth';
import { Loader2, AlertCircle, FileText, List, Type, ZoomIn, ZoomOut } from 'lucide-react';
import { readBinaryFile } from '../../utils/fileReader';
import { getCached, setCache } from '../../utils/fileCache';
import { astToHtml } from '../../utils/docRenderer';

interface WordViewerProps {
  filePath: string;
}

interface WordCache {
  htmlContent: string;
  textContent: string;
}

const isDocFile = (path: string): boolean => path.toLowerCase().endsWith('.doc') && !path.toLowerCase().endsWith('.docx');

const WordViewer: React.FC<WordViewerProps> = ({ filePath }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [textContent, setTextContent] = useState<string>('');
  const [viewMode, setViewMode] = useState<'rendered' | 'text'>('rendered');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1); // 缩放比例 0.5 - 2.0
  const [isLegacyDoc, setIsLegacyDoc] = useState(false);

  useEffect(() => {
    const loadWord = async () => {
      try {
        setLoading(true);
        setError(null);

        const cacheKey = `word:${filePath}`;
        const cached = getCached<WordCache>(cacheKey);
        if (cached) {
          setHtmlContent(cached.htmlContent);
          setTextContent(cached.textContent);
          setLoading(false);
          return;
        }

        const isDoc = isDocFile(filePath);
        setIsLegacyDoc(isDoc);

        if (isDoc) {
          // .doc 旧版格式：使用 docstream 解析
          const { OfficeParser } = await import('@jose.espana/docstream');
          // 先读取为 ArrayBuffer，避免 docstream 需要 fs
          const buffer = await readBinaryFile(filePath);
          const ast = await OfficeParser.parseOffice(buffer, {
            extractAttachments: false,
          });

          const text = ast.toText();
          // 根据 AST 内容树生成 HTML（保留标题、列表、表格等结构）
          const html = astToHtml(ast.content as any);

          setCache<WordCache>(cacheKey, { htmlContent: html, textContent: text });
          setHtmlContent(html);
          setTextContent(text);
        } else {
          // .docx 新格式：使用 mammoth
          const buffer = await readBinaryFile(filePath);

          const options = {
            convertImage: mammoth.images.imgElement((image: any) => {
              return image.read("base64").then((imageBuffer: string) => {
                return {
                  src: `data:${image.contentType};base64,${imageBuffer}`,
                };
              });
            }),
          };
          
          const [htmlResult, textResult] = await Promise.all([
            mammoth.convertToHtml({ arrayBuffer: buffer }, options as any),
            mammoth.extractRawText({ arrayBuffer: buffer }),
          ]);

          setCache<WordCache>(cacheKey, {
            htmlContent: htmlResult.value,
            textContent: textResult.value,
          });

          setHtmlContent(htmlResult.value);
          setTextContent(textResult.value);

          if (htmlResult.messages.length > 0) {
            console.warn('Mammoth warnings:', htmlResult.messages);
          }
        }
      } catch (err) {
        console.error('Word load error:', err);
        setError(err instanceof Error ? err.message : 'Word 文件加载失败');
      } finally {
        setLoading(false);
      }
    };

    loadWord();
  }, [filePath]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 0.5));
  };

  const handleZoomReset = () => {
    setZoom(1);
  };

  // 加载中
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>加载 Word 文档中...</span>
        </div>
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="text-center max-w-md">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
          <h3 className="text-lg text-red-400 mb-2">Word 文档加载失败</h3>
          <p className="text-gray-500 text-sm">{error}</p>
          <p className="text-gray-600 text-xs mt-4">提示：请确保文件是有效的 .docx 格式</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-dark-surface border-b border-dark-border">
        <div className="flex items-center gap-2">
          {/* 视图切换 */}
          <div className="flex items-center bg-dark-bg rounded-lg p-1">
            <button
              onClick={() => setViewMode('rendered')}
              className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors ${
                viewMode === 'rendered'
                  ? 'bg-accent text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Type size={14} />
              <span>渲染</span>
            </button>
            <button
              onClick={() => setViewMode('text')}
              className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors ${
                viewMode === 'text'
                  ? 'bg-accent text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <List size={14} />
              <span>纯文本</span>
            </button>
          </div>
        </div>

        {viewMode === 'rendered' && (
          <div className="flex items-center gap-2">
            {/* 缩放控制 */}
            <button
              onClick={handleZoomOut}
              className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-border transition-colors"
              title="缩小"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={handleZoomReset}
              className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-dark-border rounded transition-colors min-w-[45px]"
              title="重置缩放"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-border transition-colors"
              title="放大"
            >
              <ZoomIn size={16} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <FileText size={14} />
          <span>{isLegacyDoc ? 'Word 文档 (.doc - 文本预览)' : 'Word 文档'}</span>
        </div>
      </div>

      {/* 内容区域 */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-[#1e1e2e]"
      >
        {viewMode === 'rendered' ? (
          // 渲染模式 - 自适应容器宽度
          <div 
            className="word-document-container p-6"
            style={{ height: '100%' }}
          >
            <div
              ref={contentRef}
              className="word-document bg-white text-gray-800 p-6 rounded shadow-lg mx-auto"
              style={{
                maxWidth: '100%',
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
                width: 'calc(100% / var(--zoom, 1))',
              }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        ) : (
          // 纯文本模式
          <div className="p-6 h-full">
            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300 bg-dark-surface p-6 rounded-lg h-full overflow-auto">
              {textContent}
            </pre>
          </div>
        )}
      </div>

      {/* 样式 */}
      <style>{`
        .word-document-container {
          position: relative;
        }
        .word-document {
          transition: transform 0.15s ease-out;
        }
        .word-document h1 { font-size: 2em; font-weight: bold; margin: 0.67em 0; }
        .word-document h2 { font-size: 1.5em; font-weight: bold; margin: 0.75em 0; }
        .word-document h3 { font-size: 1.17em; font-weight: bold; margin: 0.83em 0; }
        .word-document h4, .word-document h5, .word-document h6 { font-size: 1em; font-weight: bold; margin: 1em 0; }
        .word-document p { margin: 1em 0; line-height: 1.6; }
        .word-document ul, .word-document ol { margin: 1em 0; padding-left: 2em; }
        .word-document li { margin: 0.25em 0; }
        .word-document table { 
          border-collapse: collapse; 
          width: 100%; 
          margin: 1em 0; 
          table-layout: fixed;
        }
        .word-document th, .word-document td { 
          border: 1px solid #ddd; 
          padding: 8px; 
          text-align: left; 
          word-wrap: break-word;
          white-space: normal;
        }
        .word-document th { background-color: #f5f5f5; font-weight: bold; }
        .word-document img { 
          max-width: 100%; 
          height: auto; 
          margin: 1em 0;
          display: block;
        }
        .word-document blockquote { border-left: 4px solid #ddd; padding-left: 1em; margin: 1em 0; color: #666; }
        .word-document a { color: #0366d6; text-decoration: none; }
        .word-document a:hover { text-decoration: underline; }
        .word-document strong { font-weight: bold; }
        .word-document em { font-style: italic; }
        .word-document hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
        .word-document code { background-color: #f0f0f0; padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
        .word-document pre { 
          background-color: #f5f5f5; 
          padding: 1em; 
          border-radius: 5px; 
          overflow-x: auto;
        }
        .word-document pre code { background: none; padding: 0; }
        .word-document figure { margin: 1em 0; text-align: center; }
        .word-document figcaption { font-size: 0.9em; color: #666; margin-top: 0.5em; }
        .word-document section, .word-document div { box-sizing: border-box; }
      `}</style>
    </div>
  );
};

export default WordViewer;
