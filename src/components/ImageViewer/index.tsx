import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCw, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import type { ElectronAPI } from '../../types/electron';
import { getCached, setCache } from '../../utils/fileCache';

interface ImageViewerProps {
  imagePath: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ imagePath }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadImage = async () => {
      try {
        setLoading(true);
        setError(null);
        const cacheKey = `image:${imagePath}`;

        // 如果已经是 data URL 或 http URL，直接使用
        if (imagePath.startsWith('data:') || imagePath.startsWith('http')) {
          setImageUrl(imagePath);
          setLoading(false);
          return;
        }

        // 优先使用缓存，避免切换 tab 时重复读取
        const cached = getCached<string>(cacheKey);
        if (cached) {
          setImageUrl(cached);
          setLoading(false);
          return;
        }

        // 使用 Electron API 读取文件
        const api = window.electronAPI as ElectronAPI | undefined;
        if (api && api.fs) {
          console.log('Loading image via electronAPI:', imagePath);

          const ext = imagePath.split('.').pop()?.toLowerCase();
          const mimeMap: Record<string, string> = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'bmp': 'image/bmp',
            'svg': 'image/svg+xml',
            'webp': 'image/webp',
            'ico': 'image/x-icon',
            'tiff': 'image/tiff',
            'avif': 'image/avif',
          };
          const mime = mimeMap[ext || ''] || 'image/*';

          // 使用 readBinaryFile 读取二进制文件
          const result = await api.fs.readBinaryFile(imagePath);

          console.log('Image load result:', result);

          if (result && result.content) {
            const base64Content = result.content;

            let url: string;

            // 如果是 SVG，需要特殊处理
            if (ext === 'svg') {
              // SVG 是文本格式，直接转换为 data URL
              const base64 = btoa(unescape(encodeURIComponent(base64Content)));
              url = `data:image/svg+xml;base64,${base64}`;
            } else {
              // 其他图片格式 - content 应该是 base64
              if (typeof base64Content === 'string') {
                // 如果已经是 data URL 格式，直接使用
                if (base64Content.startsWith('data:')) {
                  url = base64Content;
                } else {
                  // 添加 data URL 前缀
                  url = `data:${mime};base64,${base64Content}`;
                }
              } else {
                throw new Error('不支持的图片格式');
              }
            }

            setCache(cacheKey, url);
            setImageUrl(url);
          } else {
            throw new Error('无法读取图片文件内容');
          }
        } else {
          // Web 环境 - 直接使用文件路径
          console.log('Web environment, using path directly');
          setImageUrl(imagePath);
        }
      } catch (err) {
        console.error('Error loading image:', err);
        setError(err instanceof Error ? err.message : '加载图片失败');
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [imagePath]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 5));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.1));
  };

  const handleRotate = () => {
    setRotation((prev) => prev + 90);
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.max(0.1, Math.min(5, prev + delta)));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        container.removeEventListener('wheel', handleWheel);
      };
    }
  }, [handleWheel]);

  // 加载中
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>加载图片中...</span>
        </div>
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
          <h3 className="text-lg text-red-400 mb-2">图片加载失败</h3>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="text-gray-400">无法加载图片</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-4 py-2 bg-dark-surface border-b border-dark-border">
        <button
          className="flex items-center gap-1 px-3 py-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-border transition-colors"
          onClick={handleZoomIn}
          title="放大"
        >
          <ZoomIn size={16} />
        </button>
        <span className="text-sm text-gray-400 min-w-[60px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          className="flex items-center gap-1 px-3 py-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-border transition-colors"
          onClick={handleZoomOut}
          title="缩小"
        >
          <ZoomOut size={16} />
        </button>
        <div className="w-px h-6 bg-dark-border mx-2" />
        <button
          className="flex items-center gap-1 px-3 py-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-border transition-colors"
          onClick={handleRotate}
          title="旋转"
        >
          <RotateCw size={16} />
        </button>
        <div className="w-px h-6 bg-dark-border mx-2" />
        <button
          className="flex items-center gap-1 px-3 py-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-border transition-colors"
          onClick={handleReset}
          title="重置"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* 图片显示区域 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-move bg-[#1a1a2e]"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="w-full h-full flex items-center justify-center">
          <img
            src={imageUrl}
            alt={imagePath}
            className="max-w-full max-h-full select-none pointer-events-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease',
            }}
            draggable={false}
            onError={(e) => {
              console.error('Image load error:', e);
              setError('图片格式不支持或已损坏');
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;
