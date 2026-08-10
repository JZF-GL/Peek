import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ZoomIn, ZoomOut, RotateCw, Loader2, AlertCircle, ScrollText, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { readBinaryFile } from '../../utils/fileReader';
import { getCached, setCache } from '../../utils/fileCache';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfViewerProps {
  filePath: string;
}

interface PageRenderInfo {
  pageNumber: number;
  originalRotation: number;
  baseWidth: number;
  baseHeight: number;
}

interface PdfCache {
  doc: pdfjsLib.PDFDocumentProxy;
  pagesInfo: PageRenderInfo[];
  totalPages: number;
  paginationPages: number[];
}

const PdfViewer: React.FC<PdfViewerProps> = ({ filePath }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const singleCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderVersionRef = useRef(0);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const containerWidthRef = useRef<number>(0);
  const activeRenderTasksRef = useRef<{ cancel: () => void }[]>([]);
  
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [autoFitScale, setAutoFitScale] = useState(0);
  const [manualRotation, setManualRotation] = useState(0);
  const [showAllPages, setShowAllPages] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pagesInfo, setPagesInfo] = useState<PageRenderInfo[]>([]);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [paginationPages, setPaginationPages] = useState<number[]>([]);
  const [autoFit, setAutoFit] = useState(true);
  const [maxPageWidth, setMaxPageWidth] = useState(0);
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    const cacheKey = `pdf:${filePath}`;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);
        renderVersionRef.current++;

        // 优先使用缓存，避免切换 tab 时重复读取与解析
        const cached = getCached<PdfCache>(cacheKey);
        if (cached) {
          pdfDocRef.current = cached.doc;
          setPagesInfo(cached.pagesInfo);
          setPaginationPages(cached.paginationPages);
          setPdfDoc(cached.doc);
          setTotalPages(cached.totalPages);
          setScale(1.0);
          setManualRotation(0);
          setCurrentPage(1);
          setRenderedPages(new Set());
          setRenderKey((k) => k + 1);
          setLoading(false);
          return;
        }

        const arrayBuffer = await readBinaryFile(filePath);
        const pdfData = new Uint8Array(arrayBuffer);

        const doc = await pdfjsLib.getDocument({ data: pdfData }).promise;
        
        const pageInfos: PageRenderInfo[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1.0, rotation: 0 });
          
          pageInfos.push({
            pageNumber: i,
            originalRotation: page.rotate || 0,
            baseWidth: viewport.width,
            baseHeight: viewport.height,
          });
        }

        // 生成页码选择器
        const pages: number[] = [];
        for (let i = 1; i <= Math.min(doc.numPages, 200); i++) {
          pages.push(i);
        }

        setCache<PdfCache>(cacheKey, {
          doc,
          pagesInfo: pageInfos,
          totalPages: doc.numPages,
          paginationPages: pages,
        });

        pdfDocRef.current = doc;
        setPagesInfo(pageInfos);
        setPaginationPages(pages);
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setScale(1.0);
        setManualRotation(0);
        setCurrentPage(1);
        setRenderedPages(new Set());
        setRenderKey((k) => k + 1);
        setLoading(false);
      } catch (err) {
        console.error('PDF load error:', err);
        setError(err instanceof Error ? err.message : 'PDF 加载失败');
        setLoading(false);
      }
    };

    loadPdf();
    
    return () => {
      renderVersionRef.current++;
      // 只有未被缓存的对象才在卸载时销毁，缓存对象供其他 tab 复用
      if (pdfDocRef.current && !getCached<PdfCache>(cacheKey)) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [filePath]);

  // 监听容器宽度变化，计算自动适应的缩放比例
  useEffect(() => {
    const container = containerRef.current;
    if (!container || pagesInfo.length === 0) return;

    const calculateAutoFitScale = () => {
      const containerWidth = container.clientWidth - 48; // 减去内边距
      containerWidthRef.current = containerWidth;

      // 找出最大的页面宽度（考虑旋转和缩放）
      let maxPageWidthPx = 0;
      for (const pageInfo of pagesInfo) {
        const isRotated = pageInfo.originalRotation === 90 || pageInfo.originalRotation === 270;
        const pageWidth = isRotated ? pageInfo.baseHeight : pageInfo.baseWidth;
        maxPageWidthPx = Math.max(maxPageWidthPx, pageWidth);
      }

      // 保存最大页面宽度用于居中
      setMaxPageWidth(maxPageWidthPx);

      // 计算适应容器的缩放比例
      if (maxPageWidthPx > 0) {
        const fitScale = containerWidth / maxPageWidthPx;
        setAutoFitScale(Math.min(fitScale, 2)); // 最大放大2倍
      }
    };

    calculateAutoFitScale();

    const resizeObserver = new ResizeObserver(() => {
      calculateAutoFitScale();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [pagesInfo]);

  // 实际使用的缩放比例（统一缩放）
  const actualScale = autoFit ? autoFitScale * scale : scale;

  const cancelActiveRenderTasks = () => {
    activeRenderTasksRef.current.forEach((task) => {
      try {
        task.cancel();
      } catch (e) {
        // 忽略取消异常
      }
    });
    activeRenderTasksRef.current = [];
  };

  const renderAllPages = useCallback(async () => {
    if (!pdfDoc || pagesInfo.length === 0 || !actualScale || actualScale <= 0) return;

    // 取消旧渲染任务，防止同一 canvas 被并发渲染
    cancelActiveRenderTasks();

    const currentVersion = ++renderVersionRef.current;
    setRendering(true);
    setRenderProgress(0);
    setRenderedPages(new Set());

    for (let i = 0; i < pagesInfo.length; i++) {
      if (renderVersionRef.current !== currentVersion) {
        setRendering(false);
        return;
      }

      const pageInfo = pagesInfo[i];
      const pageNumber = pageInfo.pageNumber;
      const canvas = document.getElementById(`pdf-canvas-${pageNumber}`) as HTMLCanvasElement;

      if (!canvas) {
        continue;
      }

      try {
        if (renderVersionRef.current !== currentVersion) {
          setRendering(false);
          return;
        }

        const page = await pdfDoc.getPage(pageNumber);

        if (renderVersionRef.current !== currentVersion) {
          setRendering(false);
          return;
        }

        // 使用统一的缩放比例
        const totalRotation = pageInfo.originalRotation + manualRotation;
        const viewport = page.getViewport({ scale: actualScale, rotation: totalRotation });

        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (renderVersionRef.current !== currentVersion) {
          setRendering(false);
          return;
        }

        const renderTask = page.render({
          canvasContext: context,
          viewport,
        });
        activeRenderTasksRef.current.push(renderTask);

        await renderTask.promise;

        activeRenderTasksRef.current = activeRenderTasksRef.current.filter((t) => t !== renderTask);

        if (renderVersionRef.current !== currentVersion) {
          setRendering(false);
          return;
        }

        setRenderedPages((prev) => new Set([...prev, pageNumber]));
        setRenderProgress(Math.round(((i + 1) / pagesInfo.length) * 100));
      } catch (err: any) {
        activeRenderTasksRef.current = activeRenderTasksRef.current.filter(
          (t) => t !== (err?.renderTask as unknown as { cancel: () => void })
        );

        if (renderVersionRef.current !== currentVersion) {
          setRendering(false);
          return;
        }

        // 取消异常或 canvas 冲突时跳过该页，不中断后续渲染
        if (
          err?.name === 'RenderingCancelledException' ||
          err?.message?.includes('same canvas')
        ) {
          console.warn(`Page ${pageNumber} render skipped:`, err.message || err.name);
          continue;
        }

        console.error(`Page ${pageNumber} render error:`, err);
      }
    }

    setRendering(false);
  }, [pdfDoc, pagesInfo, actualScale, manualRotation]);

  useEffect(() => {
    if (pdfDoc && pagesInfo.length > 0 && showAllPages) {
      renderAllPages();
    }

    return () => {
      renderVersionRef.current++;
      cancelActiveRenderTasks();
    };
  }, [renderKey, pdfDoc, pagesInfo, actualScale, manualRotation, showAllPages, renderAllPages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !showAllPages) return;

    const handleScroll = () => {
      let closestPage = 1;
      let closestDistance = Infinity;

      pagesInfo.forEach((pageInfo) => {
        const pageElement = document.getElementById(`pdf-page-${pageInfo.pageNumber}`);
        if (pageElement) {
          const rect = pageElement.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const distance = Math.abs(rect.top - containerRect.top);
          
          if (distance < closestDistance && rect.bottom > containerRect.top) {
            closestDistance = distance;
            closestPage = pageInfo.pageNumber;
          }
        }
      });

      setCurrentPage(closestPage);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [pagesInfo, showAllPages]);

  const renderSinglePage = useCallback(async () => {
    if (!pdfDoc || !singleCanvasRef.current || pagesInfo.length === 0 || !actualScale || actualScale <= 0) return;

    cancelActiveRenderTasks();

    const currentVersion = ++renderVersionRef.current;
    setRendering(true);

    try {
      const page = await pdfDoc.getPage(currentPage);

      if (renderVersionRef.current !== currentVersion) {
        setRendering(false);
        return;
      }

      const pageInfo = pagesInfo[currentPage - 1];
      if (!pageInfo) {
        setRendering(false);
        return;
      }

      const totalRotation = pageInfo.originalRotation + manualRotation;
      const viewport = page.getViewport({ scale: actualScale, rotation: totalRotation });

      const canvas = singleCanvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) {
        setRendering(false);
        return;
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (renderVersionRef.current !== currentVersion) {
        setRendering(false);
        return;
      }

      const renderTask = page.render({
        canvasContext: context,
        viewport,
      });
      activeRenderTasksRef.current.push(renderTask);

      await renderTask.promise;

      activeRenderTasksRef.current = activeRenderTasksRef.current.filter((t) => t !== renderTask);

      if (renderVersionRef.current !== currentVersion) {
        setRendering(false);
        return;
      }

      setRendering(false);
    } catch (err: any) {
      activeRenderTasksRef.current = [];

      if (renderVersionRef.current !== currentVersion) {
        setRendering(false);
        return;
      }

      if (err?.name === 'RenderingCancelledException') {
        setRendering(false);
        return;
      }

      console.error('Single page render error:', err);
      setRendering(false);
    }
  }, [pdfDoc, pagesInfo, currentPage, actualScale, manualRotation]);

  useEffect(() => {
    if (!showAllPages && pdfDoc) {
      renderSinglePage();
    }

    return () => {
      renderVersionRef.current++;
      cancelActiveRenderTasks();
    };
  }, [renderKey, showAllPages, pdfDoc, currentPage, actualScale, manualRotation, renderSinglePage]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleRotate = () => {
    setManualRotation(prev => (prev + 90) % 360);
  };

  const scrollToPage = (pageNumber: number) => {
    const pageElement = document.getElementById(`pdf-page-${pageNumber}`);
    if (pageElement && containerRef.current) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleGoToPage = () => {
    const input = prompt(`跳转到页码 (1-${totalPages})`, currentPage.toString());
    if (input) {
      const pageNum = parseInt(input, 10);
      if (pageNum >= 1 && pageNum <= totalPages) {
        setCurrentPage(pageNum);
        if (showAllPages) {
          scrollToPage(pageNum);
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <div className="text-center">
            <p className="text-gray-400">加载 PDF 文件中...</p>
            <p className="text-gray-500 text-sm mt-1">正在读取文件数据</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
          <h3 className="text-lg text-red-400 mb-2">PDF 加载失败</h3>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-dark-surface border-b border-dark-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-dark-bg rounded-lg p-1">
            <button
              onClick={() => setShowAllPages(true)}
              className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors ${
                showAllPages ? 'bg-accent text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <ScrollText size={14} />
              <span>连续</span>
            </button>
            <button
              onClick={() => setShowAllPages(false)}
              className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors ${
                !showAllPages ? 'bg-accent text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>单页</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* 渲染进度 */}
          {rendering && (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span className="text-sm text-blue-400">
                渲染中 {renderProgress}%
              </span>
            </div>
          )}

          <button
            onClick={handleGoToPage}
            className="text-sm text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-dark-border transition-colors"
          >
            {currentPage} / {totalPages}
          </button>

          {!showAllPages && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 text-gray-400 hover:text-gray-200 hover:bg-dark-border rounded disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 text-gray-400 hover:text-gray-200 hover:bg-dark-border rounded disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          <div className="w-px h-5 bg-dark-border" />

          <button
            onClick={() => setAutoFit(!autoFit)}
            className={`p-1 rounded transition-colors ${
              autoFit 
                ? 'text-blue-400 bg-blue-400/10' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-dark-border'
            }`}
            title="适应窗口"
          >
            <Maximize2 size={16} />
          </button>

          <button
            onClick={handleZoomOut}
            className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-border transition-colors"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-sm text-gray-400 min-w-[50px] text-center">
            {Math.round(actualScale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-border transition-colors"
          >
            <ZoomIn size={16} />
          </button>

          <div className="w-px h-5 bg-dark-border" />

          <button
            onClick={handleRotate}
            className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-border transition-colors"
            title="旋转 90°"
          >
            <RotateCw size={16} />
          </button>
        </div>
      </div>

      {/* 渲染进度条 */}
      {rendering && (
        <div className="h-1 bg-dark-surface">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${renderProgress}%` }}
          />
        </div>
      )}

      {/* 页码导航 */}
      {showAllPages && totalPages > 1 && (
        <div className="flex-shrink-0 px-4 py-2 bg-dark-surface border-b border-dark-border">
          <div className="flex items-center gap-1">
            {currentPage > 1 && (
              <button
                onClick={() => scrollToPage(1)}
                className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-dark-border rounded transition-colors"
              >
                首页
              </button>
            )}
            {currentPage > 1 && (
              <button
                onClick={() => scrollToPage(currentPage - 1)}
                className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-dark-border rounded transition-colors"
              >
                ←
              </button>
            )}
            
            {/* 当前页码附近的页码 */}
            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(11, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 11) {
                  pageNum = i + 1;
                } else {
                  const start = Math.max(1, currentPage - 5);
                  const end = Math.min(totalPages, start + 10);
                  const actualStart = Math.max(1, end - 10);
                  pageNum = actualStart + i;
                  if (pageNum > totalPages) return null;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => scrollToPage(pageNum)}
                    className={`min-w-[28px] px-2 py-1 text-xs rounded transition-colors ${
                      currentPage === pageNum
                        ? 'bg-accent text-white'
                        : 'bg-dark-bg text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            {currentPage < totalPages && (
              <button
                onClick={() => scrollToPage(currentPage + 1)}
                className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-dark-border rounded transition-colors"
              >
                →
              </button>
            )}
            {currentPage < totalPages && (
              <button
                onClick={() => scrollToPage(totalPages)}
                className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-dark-border rounded transition-colors"
              >
                末页
              </button>
            )}
          </div>
        </div>
      )}

      {/* PDF 显示区域 */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-[#1a1b26]"
      >
        {showAllPages ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            {pagesInfo.map((pageInfo) => {
              // 计算实际显示的宽度（考虑旋转）
              const isRotated = pageInfo.originalRotation === 90 || pageInfo.originalRotation === 270;
              const pageWidth = (isRotated ? pageInfo.baseHeight : pageInfo.baseWidth) * actualScale;
              const pageHeight = (isRotated ? pageInfo.baseWidth : pageInfo.baseHeight) * actualScale;
              return (
                <div
                  key={pageInfo.pageNumber}
                  id={`pdf-page-${pageInfo.pageNumber}`}
                  style={{
                    display: 'inline-block',
                    width: `${pageWidth}px`,
                    height: `${pageHeight}px`,
                    margin: '8px auto',
                    textAlign: 'left',
                    backgroundColor: 'white',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <canvas
                    id={`pdf-canvas-${pageInfo.pageNumber}`}
                    style={{ display: 'block' }}
                  />
                  {!renderedPages.has(pageInfo.pageNumber) && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(243, 244, 246, 0.9)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span style={{ fontSize: '14px' }}>渲染中 {pageInfo.pageNumber}/{totalPages}...</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full p-4">
            <canvas
              ref={singleCanvasRef}
              className="bg-white shadow-lg rounded"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            />
          </div>
        )}
      </div>

      {/* 状态栏 */}
      <div className="flex-shrink-0 px-4 py-1 bg-dark-surface border-t border-dark-border text-xs text-gray-500">
        {showAllPages 
          ? `连续模式 - ${currentPage}/${totalPages} 页` 
          : `单页模式 - ${currentPage}/${totalPages}`
        }
        {manualRotation !== 0 && ` · 已旋转 ${manualRotation}°`}
        {rendering && ` · 渲染中...`}
        {renderedPages.size > 0 && showAllPages && ` · 已渲染 ${renderedPages.size}/${totalPages}`}
      </div>
    </div>
  );
};

export default PdfViewer;
