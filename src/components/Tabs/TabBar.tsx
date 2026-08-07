import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, FileText, Code, Image, File, ChevronDown, MoreHorizontal, AlertTriangle } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import type { Tab } from '../../types';

const TAB_MIN_WIDTH = 120;
const TAB_MAX_WIDTH = 180;
const TAB_COMPLETE_WIDTH = 140; // 确保关闭按钮也能完整显示的最小宽度
const OVERFLOW_BUTTON_WIDTH = 80;
const ACTION_BUTTON_WIDTH = 100;

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  tabId: string | null;
}

interface ConfirmDialogState {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

const TabBar: React.FC = () => {
  const {
    openTabs,
    activeTabId,
    setActiveTab,
    closeTab,
    closeAllTabs,
    forceCloseAllTabs,
    closeOtherTabs,
    forceCloseOtherTabs,
  } = useFileStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const overflowBtnRef = useRef<HTMLButtonElement>(null);
  const actionBtnRef = useRef<HTMLButtonElement>(null);
  
  const [visibleTabsCount, setVisibleTabsCount] = useState(openTabs.length);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    tabId: null,
  });
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // 获取按钮相对于视口的位置
  const getButtonPosition = (buttonRef: React.RefObject<HTMLButtonElement | null>) => {
    if (!buttonRef.current) return { x: 0, y: 0 };
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      x: rect.right,
      y: rect.bottom + 4,
    };
  };

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

  // 计算可见tabs数量
  const calculateVisibleTabs = useCallback(() => {
    if (!containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const availableWidth = containerWidth - OVERFLOW_BUTTON_WIDTH - ACTION_BUTTON_WIDTH;
    
    // 使用较大的宽度计算，确保每个标签都能完整显示（包括关闭按钮）
    const maxTabs = Math.floor(availableWidth / TAB_COMPLETE_WIDTH);

    setVisibleTabsCount(Math.max(0, Math.min(maxTabs, openTabs.length)));
  }, [openTabs.length]);

  // 监听容器大小变化
  useEffect(() => {
    calculateVisibleTabs();

    const resizeObserver = new ResizeObserver(() => {
      calculateVisibleTabs();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', calculateVisibleTabs);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', calculateVisibleTabs);
    };
  }, [calculateVisibleTabs]);

  // 关闭所有菜单
  const closeAllMenus = useCallback(() => {
    setShowOverflowMenu(false);
    setShowActionMenu(false);
    setContextMenu({ visible: false, x: 0, y: 0, tabId: null });
  }, []);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.tab-menu-container')) {
        closeAllMenus();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [closeAllMenus]);

  // 显示确认对话框
  const showConfirmDialog = (
    title: string,
    message: string,
    onConfirm: () => void
  ) => {
    setConfirmDialog({
      visible: true,
      title,
      message,
      onConfirm,
    });
  };

  // 关闭单个tab（带确认）
  const handleCloseTab = (tabId: string) => {
    const tab = openTabs.find((t) => t.id === tabId);
    if (tab?.isDirty) {
      showConfirmDialog(
        '关闭未保存的文件',
        `"${tab.name}" 有未保存的更改，确定要关闭吗？`,
        () => {
          closeTab(tabId);
          closeAllMenus();
        }
      );
    } else {
      closeTab(tabId);
      closeAllMenus();
    }
  };

  // 关闭所有tabs
  const handleCloseAllTabs = () => {
    const result = closeAllTabs();
    if (result.hasDirty) {
      const dirtyNames = result.dirtyTabs.map((t) => t.name).join(', ');
      showConfirmDialog(
        '关闭所有文件',
        `以下文件有未保存的更改：${dirtyNames}\n确定要关闭所有文件吗？`,
        () => {
          forceCloseAllTabs();
          closeAllMenus();
        }
      );
    } else {
      forceCloseAllTabs();
      closeAllMenus();
    }
  };

  // 关闭其他tabs
  const handleCloseOtherTabs = (tabId: string) => {
    const result = closeOtherTabs(tabId);
    if (result.hasDirty) {
      const dirtyNames = result.dirtyTabs.map((t) => t.name).join(', ');
      showConfirmDialog(
        '关闭其他文件',
        `以下文件有未保存的更改：${dirtyNames}\n确定要关闭其他文件吗？`,
        () => {
          forceCloseOtherTabs(tabId);
          closeAllMenus();
        }
      );
    } else {
      forceCloseOtherTabs(tabId);
      closeAllMenus();
    }
  };

  // 右键菜单
  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      tabId,
    });
    setShowOverflowMenu(false);
    setShowActionMenu(false);
  };

  // 可见和溢出的tabs
  const visibleTabs = openTabs.slice(0, visibleTabsCount);
  const overflowTabs = openTabs.slice(visibleTabsCount);

  if (openTabs.length === 0) {
    return (
      <div className="h-10 bg-dark-surface border-b border-dark-border flex items-center px-4 flex-shrink-0">
        <span className="text-gray-500 text-sm">暂无打开的文件</span>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="h-10 bg-dark-surface border-b border-dark-border flex flex-shrink-0 relative"
      >
        {/* 可见的Tabs */}
        <div className="flex h-full flex-1 min-w-0 overflow-hidden">
          {visibleTabs.map((tab) => (
            <div
              key={tab.id}
              className={`group flex items-center gap-2 px-3 h-full cursor-pointer border-r border-dark-border transition-colors flex-shrink-0 ${
                activeTabId === tab.id
                  ? 'bg-dark-bg text-gray-200'
                  : 'hover:bg-dark-bg/50 text-gray-400'
              }`}
              style={{ minWidth: TAB_MIN_WIDTH, maxWidth: TAB_MAX_WIDTH }}
              onClick={() => {
                setActiveTab(tab.id);
                closeAllMenus();
              }}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
            >
              {getFileIcon(tab.type)}
              <span className="text-sm truncate flex-1">{tab.name}</span>
              {tab.isDirty && (
                <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTab(tab.id);
                }}
                className="p-0.5 rounded hover:bg-dark-border opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* 溢出菜单按钮 */}
        {overflowTabs.length > 0 && (
          <div className="tab-menu-container h-full flex-shrink-0">
            <button
              ref={overflowBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                const pos = getButtonPosition(overflowBtnRef);
                setMenuPosition(pos);
                setShowOverflowMenu(!showOverflowMenu);
                setShowActionMenu(false);
                setContextMenu({ visible: false, x: 0, y: 0, tabId: null });
              }}
              className={`px-3 h-full flex items-center gap-1 text-sm transition-colors ${
                showOverflowMenu
                  ? 'bg-dark-bg text-gray-200'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-dark-bg/50'
              }`}
            >
              <span className="bg-dark-border px-1.5 py-0.5 rounded text-xs">
                {overflowTabs.length}
              </span>
              <ChevronDown size={14} />
            </button>
          </div>
        )}

        {/* 操作菜单按钮 */}
        <div className="tab-menu-container h-full flex-shrink-0">
          <button
            ref={actionBtnRef}
            onClick={(e) => {
              e.stopPropagation();
              const pos = getButtonPosition(actionBtnRef);
              setMenuPosition(pos);
              setShowActionMenu(!showActionMenu);
              setShowOverflowMenu(false);
              setContextMenu({ visible: false, x: 0, y: 0, tabId: null });
            }}
            className={`px-3 h-full flex items-center gap-1 text-sm transition-colors border-l border-dark-border ${
              showActionMenu
                ? 'bg-dark-bg text-gray-200'
                : 'text-gray-400 hover:text-gray-200 hover:bg-dark-bg/50'
            }`}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* 溢出下拉菜单 - 使用 fixed 定位 */}
      {showOverflowMenu && (
        <div 
          className="fixed w-64 bg-dark-surface border border-dark-border rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto"
          style={{ left: menuPosition.x - 256, top: menuPosition.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1">
            {overflowTabs.map((tab) => (
              <div
                key={tab.id}
                className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                  activeTabId === tab.id
                    ? 'bg-dark-bg text-gray-200'
                    : 'hover:bg-dark-bg/50 text-gray-400'
                }`}
                onClick={() => {
                  setActiveTab(tab.id);
                  closeAllMenus();
                }}
                onContextMenu={(e) => handleContextMenu(e, tab.id)}
              >
                {getFileIcon(tab.type)}
                <span className="text-sm truncate flex-1">{tab.name}</span>
                {tab.isDirty && (
                  <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                  className="p-0.5 rounded hover:bg-dark-border opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作下拉菜单 - 使用 fixed 定位 */}
      {showActionMenu && (
        <div 
          className="fixed w-48 bg-dark-surface border border-dark-border rounded-lg shadow-xl z-50"
          style={{ left: menuPosition.x - 192, top: menuPosition.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1">
            <button
              onClick={() => handleCloseAllTabs()}
              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-dark-bg transition-colors"
            >
              关闭所有文件
            </button>
            {activeTabId && (
              <button
                onClick={() => handleCloseOtherTabs(activeTabId)}
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-dark-bg transition-colors"
              >
                关闭其他文件
              </button>
            )}
          </div>
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu.visible && contextMenu.tabId && (
        <div
          className="fixed bg-dark-surface border border-dark-border rounded-lg shadow-xl z-50 w-48"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1">
            <button
              onClick={() => handleCloseTab(contextMenu.tabId!)}
              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-dark-bg transition-colors"
            >
              关闭
            </button>
            <button
              onClick={() => handleCloseOtherTabs(contextMenu.tabId!)}
              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-dark-bg transition-colors"
            >
              关闭其他文件
            </button>
            <button
              onClick={() => handleCloseAllTabs()}
              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-dark-bg transition-colors"
            >
              关闭所有文件
            </button>
          </div>
        </div>
      )}

      {/* 确认对话框 */}
      {confirmDialog.visible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-dark-surface border border-dark-border rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-200 mb-2">
                    {confirmDialog.title}
                  </h3>
                  <p className="text-sm text-gray-400 whitespace-pre-line">
                    {confirmDialog.message}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-dark-border">
              <button
                onClick={() =>
                  setConfirmDialog({ ...confirmDialog, visible: false })
                }
                className="px-4 py-2 text-sm text-gray-300 hover:bg-dark-border rounded transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog({ ...confirmDialog, visible: false });
                }}
                className="px-4 py-2 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
              >
                确定关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TabBar;
