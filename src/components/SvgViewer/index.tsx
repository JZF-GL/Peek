import React, { useState, useEffect, useRef } from 'react';
import { Eye, Code2, RotateCw, ZoomIn, ZoomOut, Save, Loader2, AlertCircle } from 'lucide-react';
import { readFileTextOnly } from '../../utils/fileUtils';
import CodeEditor from '../Editor/CodeEditor';

interface SvgViewerProps {
  filePath: string;
  initialContent: string;
  onSave?: (content: string) => void;
}

const SvgViewer: React.FC<SvgViewerProps> = ({ filePath, initialContent, onSave }) => {
  const [mode, setMode] = useState<'preview' | 'code'>('preview');
  const [svgContent, setSvgContent] = useState<string>(initialContent);
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 当initialContent变化时（切换到另一个SVG文件），更新state
  useEffect(() => {
    setSvgContent(initialContent);
    setZoom(1);
    setRotate(0);
    setError(null);
  }, [initialContent, filePath]);

  useEffect(() => {
    // 验证 SVG 内容
    try {
      if (!svgContent.includes('<svg')) {
        setError('无效的 SVG 文件');
      } else {
        setError(null);
      }
    } catch (e) {
      setError('SVG 解析错误');
    }
  }, [svgContent]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.1));
  const handleRotate = () => setRotate(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotate(0);
  };

  const handleCodeChange = (newCode: string) => {
    setSvgContent(newCode);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(svgContent);
    }
  };

  // Ctrl+S 快捷保存（代码模式）
  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return;
      if (mode !== 'code' || !onSave) return;
      e.preventDefault();
      handleSave();
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [mode, onSave, svgContent]);

  // 监听外部文件变化，自动刷新内容
  useEffect(() => {
    const handleExternalChange = async (e: Event) => {
      const changedPath = (e as CustomEvent<string>).detail;
      if (changedPath !== filePath) return;
      try {
        const newContent = await readFileTextOnly(filePath);
        if (newContent !== null) {
          setSvgContent(newContent);
        }
      } catch (err) {
        console.error('SVG 外部刷新失败:', err);
      }
    };
    window.addEventListener('external-file-changed', handleExternalChange);
    return () => window.removeEventListener('external-file-changed', handleExternalChange);
  }, [filePath]);

  const svgBase64 = React.useMemo(() => {
    try {
      const base64 = btoa(unescape(encodeURIComponent(svgContent)));
      return `data:image/svg+xml;base64,${base64}`;
    } catch {
      return '';
    }
  }, [svgContent]);

  // 解析 SVG 的宽高信息
  const svgInfo = React.useMemo(() => {
    try {
      const match = svgContent.match(/<svg[^>]*>/i);
      if (match) {
        const attrs = match[0];
        const width = attrs.match(/width=['"]([^'"]+)['"]/i)?.[1] || 'auto';
        const height = attrs.match(/height=['"]([^'"]+)['"]/i)?.[1] || 'auto';
        const viewBox = attrs.match(/viewBox=['"]([^'"]+)['"]/i)?.[1] || '';
        return { width, height, viewBox };
      }
    } catch {}
    return { width: 'auto', height: 'auto', viewBox: '' };
  }, [svgContent]);

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-dark-surface border-b border-dark-border">
        <div className="flex items-center gap-2">
          {/* 模式切换 */}
          <div className="flex items-center bg-dark-bg rounded-lg p-1">
            <button
              onClick={() => setMode('preview')}
              className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
                mode === 'preview'
                  ? 'bg-accent text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Eye size={14} />
              <span className="text-sm">预览</span>
            </button>
            <button
              onClick={() => setMode('code')}
              className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
                mode === 'code'
                  ? 'bg-accent text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Code2 size={14} />
              <span className="text-sm">代码</span>
            </button>
          </div>

          {/* SVG 信息 */}
          {mode === 'preview' && (
            <div className="flex items-center gap-2 ml-4 text-xs text-gray-500">
              <span>宽度: {svgInfo.width}</span>
              <span>|</span>
              <span>高度: {svgInfo.height}</span>
              {svgInfo.viewBox && (
                <>
                  <span>|</span>
                  <span>viewBox: {svgInfo.viewBox}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {mode === 'preview' ? (
            <>
              {/* 预览模式工具栏 */}
              <button
                onClick={handleZoomOut}
                className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-border transition-colors"
                title="缩小"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-sm text-gray-400 min-w-[50px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-border transition-colors"
                title="放大"
              >
                <ZoomIn size={16} />
              </button>
              <div className="w-px h-5 bg-dark-border mx-1" />
              <button
                onClick={handleRotate}
                className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-border transition-colors"
                title="旋转"
              >
                <RotateCw size={16} />
              </button>
              <div className="w-px h-5 bg-dark-border mx-1" />
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`p-1 rounded transition-colors ${
                  showGrid
                    ? 'text-accent bg-dark-border'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-dark-border'
                }`}
                title="显示网格"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="1" width="14" height="14" stroke="currentColor" strokeWidth="1"/>
                  <line x1="5" y1="1" x2="5" y2="15" stroke="currentColor" strokeWidth="0.5"/>
                  <line x1="10" y1="1" x2="10" y2="15" stroke="currentColor" strokeWidth="0.5"/>
                  <line x1="1" y1="5" x2="15" y2="5" stroke="currentColor" strokeWidth="0.5"/>
                  <line x1="1" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="0.5"/>
                </svg>
              </button>
              <button
                onClick={handleReset}
                className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-border transition-colors"
                title="重置"
              >
                <RotateCw size={14} style={{ transform: 'scaleX(-1)' }} />
              </button>
            </>
          ) : (
            <>
              {/* 代码模式工具栏 */}
              {onSave && (
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white transition-colors"
                  title="保存"
                >
                  <Save size={14} />
                  <span className="text-sm">保存</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">
        {mode === 'preview' ? (
          // 预览模式
          <div
            ref={containerRef}
            className="h-full w-full flex items-center justify-center relative"
            style={{
              backgroundImage: showGrid
                ? `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                   linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`
                : 'none',
              backgroundSize: showGrid ? '20px 20px' : undefined,
              backgroundColor: showGrid ? '#1a1a2e' : '#1a1a2e',
            }}
          >
            {error ? (
              <div className="text-center">
                <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
                <p className="text-red-400">{error}</p>
              </div>
            ) : (
              <img
                src={svgBase64}
                alt={filePath}
                className="max-w-full max-h-full object-contain"
                style={{
                  transform: `scale(${zoom}) rotate(${rotate}deg)`,
                  transition: 'transform 0.2s ease',
                }}
                onError={(e) => {
                  console.error('SVG render error:', e);
                  setError('SVG 渲染失败');
                }}
              />
            )}
          </div>
        ) : (
          // 代码模式
          <div className="h-full">
            <CodeEditor
              value={svgContent}
              language="xml"
              onChange={handleCodeChange}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SvgViewer;
