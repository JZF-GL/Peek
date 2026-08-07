import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Presentation } from 'lucide-react';
import { PptxPreview } from 'react-pptx-preview-kit';
import { readBinaryFile } from '../../utils/fileReader';
import { getCached, setCache } from '../../utils/fileCache';

interface PowerPointViewerProps {
  filePath: string;
}

interface SlideData {
  slideNumber: number;
  title: string;
  content: string;
}

interface PptCache {
  slides: SlideData[];
}

const isPptFile = (path: string): boolean => path.toLowerCase().endsWith('.ppt') && !path.toLowerCase().endsWith('.pptx');

const PowerPointViewer: React.FC<PowerPointViewerProps> = ({ filePath }) => {
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [pptSlides, setPptSlides] = useState<SlideData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLegacyPpt, setIsLegacyPpt] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadPowerPoint = async () => {
      try {
        setLoading(true);
        setError(null);

        const cacheKey = `pptx:${filePath}`;
        const isPpt = isPptFile(filePath);
        setIsLegacyPpt(isPpt);

        if (isPpt) {
          // .ppt 旧版格式：使用 docstream 提取文本
          const pptCache = getCached<PptCache>(`ppt:${filePath}`);
          if (pptCache) {
            if (isMounted) setPptSlides(pptCache.slides);
            setLoading(false);
            return;
          }

          const { OfficeParser } = await import('@jose.espana/docstream');
          // 先读取为 ArrayBuffer，避免 docstream 需要 fs
          const buffer = await readBinaryFile(filePath);
          const ast = await OfficeParser.parseOffice(buffer, {
            extractAttachments: false,
            ignoreNotes: true,
          });

          // 从 AST 内容树中提取每张幻灯片的内容
          const slides: SlideData[] = [];
          for (const node of ast.content) {
            if (node.type === 'slide') {
              const meta = node.metadata as Record<string, unknown> | undefined;
              const slideNumber = (meta?.slideNumber as number) || slides.length + 1;
              const text = node.text || '';
              // 取第一行作为标题
              const lines = text.split('\n').filter((l: string) => l.trim());
              const title = lines.length > 0 ? lines[0].trim() : `幻灯片 ${slideNumber}`;
              const content = lines.length > 1 ? lines.slice(1).join('\n') : (lines.length === 1 ? '' : text);

              slides.push({ slideNumber, title, content });
            }
          }

          setCache<PptCache>(`ppt:${filePath}`, { slides });
          if (isMounted) setPptSlides(slides);
        } else {
          // .pptx 新格式：使用 react-pptx-preview-kit
          const cached = getCached<ArrayBuffer>(cacheKey);
          if (cached) {
            if (isMounted) setFileBuffer(cached);
            setLoading(false);
            return;
          }

          const buffer = await readBinaryFile(filePath);
          if (!isMounted) return;
          setCache<ArrayBuffer>(cacheKey, buffer);
          if (isMounted) setFileBuffer(buffer);
        }
      } catch (err) {
        console.error('PowerPoint load error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'PowerPoint 文件加载失败');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPowerPoint();

    return () => {
      isMounted = false;
    };
  }, [filePath]);

  // 加载中
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>加载 PowerPoint 中...</span>
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
          <h3 className="text-lg text-red-400 mb-2">PowerPoint 加载失败</h3>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // .ppt 旧版格式：纯文本显示
  if (isLegacyPpt && pptSlides) {
    return (
      <div className="h-full flex flex-col bg-dark-bg">
        <div className="flex items-center gap-2 px-4 py-2 bg-dark-surface border-b border-dark-border">
          <Presentation size={16} className="text-orange-400" />
          <span className="text-sm text-gray-400">PowerPoint 演示文稿 (.ppt - 文本预览)</span>
          <span className="text-xs text-gray-500 ml-auto">{pptSlides.length} 张幻灯片</span>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {pptSlides.map((slide) => (
              <div
                key={slide.slideNumber}
                className="bg-dark-surface rounded-lg border border-dark-border p-4"
              >
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-dark-border">
                  <span className="text-xs font-medium text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded">
                    幻灯片 {slide.slideNumber}
                  </span>
                  <h3 className="text-sm font-medium text-gray-200 truncate">
                    {slide.title}
                  </h3>
                </div>
                {slide.content ? (
                  <pre className="text-sm text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">
                    {slide.content}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-500 italic">（无内容）</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!fileBuffer) return null;

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* 顶部标题栏 */}
      <div className="flex items-center gap-2 px-4 py-2 bg-dark-surface border-b border-dark-border">
        <Presentation size={16} className="text-orange-400" />
        <span className="text-sm text-gray-400">PowerPoint 演示文稿</span>
      </div>

      {/* 渲染区域 - PptxPreview 自带缩放、翻页、全屏控制 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <PptxPreview key={filePath} file={fileBuffer} />
      </div>
    </div>
  );
};

export default PowerPointViewer;