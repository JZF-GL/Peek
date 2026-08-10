import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FileNode, RecentFile, FileInfo, Tab } from '../types';

interface FolderItem {
  path: string;
  name: string;
  tree: FileNode[];
  addedAt: number;
}

interface CloseResult {
  hasDirty: boolean;
  dirtyTabs: Tab[];
}

interface FileStore {
  folders: FolderItem[];
  openedFiles: FileNode[];
  expandedNodes: Set<string>;
  currentFile: FileInfo | null;
  openTabs: Tab[];
  activeTabId: string | null;
  recentFiles: RecentFile[];
  copiedItemPath: string | null;
  isLoading: boolean;
  error: string | null;

  addFolder: (path: string, tree: FileNode[]) => void;
  removeFolder: (path: string) => void;
  refreshFolder: (path: string, tree: FileNode[]) => void;
  addOpenedFile: (file: FileNode) => void;
  removeOpenedFile: (path: string) => void;
  toggleNode: (path: string) => void;
  setCurrentFile: (file: FileInfo | null) => void;
  addTab: (tab: Tab) => void;
  addTerminalTab: (cwd: string, command?: string) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => CloseResult;
  forceCloseAllTabs: () => void;
  closeOtherTabs: (id: string) => CloseResult;
  forceCloseOtherTabs: (id: string) => void;
  setActiveTab: (id: string | null) => void;
  updateTabContent: (id: string, content: string) => void;
  markTabClean: (id: string) => void;
  addRecentFile: (file: RecentFile) => void;
  removeRecentFile: (path: string) => void;
  clearRecentFiles: () => void;
  setCopiedItemPath: (path: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// 路径归一化：统一为小写 + 正斜杠，避免大小写/分隔符差异导致同一文件重复
const normalizePath = (p: string): string => p.replace(/\\/g, '/').toLowerCase();

// 判断文件是否已存在于某个已添加文件夹的文件树中（避免列表最外层重复显示）
const isInFolderTrees = (state: FileStore, filePath: string): boolean => {
  const target = normalizePath(filePath);
  const search = (nodes: FileNode[]): boolean =>
    nodes.some(
      (n) => normalizePath(n.path) === target || (n.children ? search(n.children) : false)
    );
  return state.folders.some((f: FolderItem) => search(f.tree));
};

export const useFileStore = create<FileStore>()(
  persist(
    (set, get) => ({
      folders: [],
      openedFiles: [],
      expandedNodes: new Set(),
      currentFile: null,
      openTabs: [],
      activeTabId: null,
      recentFiles: [],
      copiedItemPath: null,
      isLoading: false,
      error: null,

      addFolder: (path: string, tree: FileNode[]) =>
        set((state: FileStore) => {
          const existingIndex = state.folders.findIndex((f: FolderItem) => f.path === path);
          if (existingIndex >= 0) {
            const newFolders = [...state.folders];
            newFolders[existingIndex] = {
              ...newFolders[existingIndex],
              tree,
              addedAt: Date.now(),
            };
            return { folders: newFolders };
          }
          return {
            folders: [
              {
                path,
                name: path.split(/[\\/]/).pop() || path,
                tree,
                addedAt: Date.now(),
              },
              ...state.folders,
            ],
          };
        }),

      removeFolder: (path: string) =>
        set((state: FileStore) => ({
          folders: state.folders.filter((f: FolderItem) => f.path !== path),
        })),

      refreshFolder: (path: string, tree: FileNode[]) =>
        set((state: FileStore) => {
          const existingIndex = state.folders.findIndex((f: FolderItem) => f.path === path);
          if (existingIndex < 0) return {};
          const newFolders = [...state.folders];
          newFolders[existingIndex] = {
            ...newFolders[existingIndex],
            tree,
            addedAt: Date.now(),
          };
          return { folders: newFolders };
        }),

      addOpenedFile: (file: FileNode) =>
        set((state: FileStore) => {
          const normalizedPath = normalizePath(file.path);
          // 已存在于打开列表，或已存在于某个文件夹树中时不再重复添加
          const exists =
            state.openedFiles.some((f: FileNode) => normalizePath(f.path) === normalizedPath) ||
            isInFolderTrees(state, file.path);
          if (exists) return {};
          return { openedFiles: [file, ...state.openedFiles] };
        }),

      removeOpenedFile: (path: string) =>
        set((state: FileStore) => ({
          openedFiles: state.openedFiles.filter((f: FileNode) => f.path !== path),
        })),

      toggleNode: (path: string) =>
        set((state: FileStore) => {
          const newExpanded = new Set(state.expandedNodes);
          if (newExpanded.has(path)) {
            newExpanded.delete(path);
          } else {
            newExpanded.add(path);
          }
          return { expandedNodes: newExpanded };
        }),

      setCurrentFile: (file: FileInfo | null) => set({ currentFile: file }),

      addTab: (tab: Tab) =>
        set((state: FileStore) => {
          const existingIndex = state.openTabs.findIndex((t: Tab) => t.path === tab.path);
          if (existingIndex >= 0) {
            return { activeTabId: state.openTabs[existingIndex].id };
          }
          return {
            openTabs: [...state.openTabs, tab],
            activeTabId: tab.id,
          };
        }),

      // 添加终端标签页：cwd 为终端工作目录，command 为空时启动交互式 shell
      addTerminalTab: (cwd: string, command?: string) =>
        set((state: FileStore) => {
          const folderName = cwd.split(/[\\/]/).filter(Boolean).pop() || cwd;
          const tab: Tab = {
            id: `term-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            path: `terminal://${cwd}`,
            name: command ? `${folderName} › ${command}` : `${folderName} - 终端`,
            type: 'terminal',
            isDirty: false,
            terminalMeta: { cwd, command },
          };
          return {
            openTabs: [...state.openTabs, tab],
            activeTabId: tab.id,
          };
        }),

      closeTab: (id: string) =>
        set((state: FileStore) => {
          // 关闭终端标签时终止对应进程
          const closedTab = state.openTabs.find((t: Tab) => t.id === id);
          if (closedTab?.type === 'terminal' && typeof window !== 'undefined' && (window as any).electronAPI?.terminal) {
            (window as any).electronAPI.terminal.stop(id);
          }
          const tabs = state.openTabs.filter((t: Tab) => t.id !== id);
          let activeTabId = state.activeTabId;
          if (activeTabId === id) {
            const closedIndex = state.openTabs.findIndex((t: Tab) => t.id === id);
            activeTabId = tabs[Math.min(closedIndex, tabs.length - 1)]?.id ?? null;
          }
          return { openTabs: tabs, activeTabId };
        }),

      closeAllTabs: (): CloseResult => {
        const state = get();
        const dirtyTabs = state.openTabs.filter((t: Tab) => t.isDirty);
        return { hasDirty: dirtyTabs.length > 0, dirtyTabs };
      },

      forceCloseAllTabs: () => {
        // 终止所有终端进程
        if (typeof window !== 'undefined' && (window as any).electronAPI?.terminal) {
          const state = get();
          for (const t of state.openTabs) {
            if (t.type === 'terminal') {
              (window as any).electronAPI.terminal.stop(t.id);
            }
          }
        }
        set(() => ({
          openTabs: [],
          activeTabId: null,
        }));
      },

      closeOtherTabs: (id: string): CloseResult => {
        const state = get();
        const tabsToClose = state.openTabs.filter((t: Tab) => t.id !== id);
        const dirtyTabs = tabsToClose.filter((t: Tab) => t.isDirty);
        return { hasDirty: dirtyTabs.length > 0, dirtyTabs };
      },

      forceCloseOtherTabs: (id: string) => {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.terminal) {
          const state = get();
          for (const t of state.openTabs) {
            if (t.type === 'terminal' && t.id !== id) {
              (window as any).electronAPI.terminal.stop(t.id);
            }
          }
        }
        set((state: FileStore) => {
          const tabs = state.openTabs.filter((t: Tab) => t.id === id);
          return {
            openTabs: tabs,
            activeTabId: tabs[0]?.id ?? null,
          };
        });
      },

      setActiveTab: (id: string | null) => set({ activeTabId: id }),

      updateTabContent: (id: string, content: string) =>
        set((state: FileStore) => ({
          openTabs: state.openTabs.map((tab: Tab) =>
            tab.id === id ? { ...tab, content, isDirty: true } : tab
          ),
        })),

      markTabClean: (id: string) =>
        set((state: FileStore) => ({
          openTabs: state.openTabs.map((tab: Tab) =>
            tab.id === id ? { ...tab, isDirty: false } : tab
          ),
        })),

      addRecentFile: (file: RecentFile) =>
        set((state: FileStore) => {
          const filtered = state.recentFiles.filter((f: RecentFile) => f.path !== file.path);
          return { recentFiles: [file, ...filtered].slice(0, 50) };
        }),

      removeRecentFile: (path: string) =>
        set((state: FileStore) => ({
          recentFiles: state.recentFiles.filter((f: RecentFile) => f.path !== path),
        })),

      clearRecentFiles: () => set({ recentFiles: [] }),

      setCopiedItemPath: (path: string | null) => set({ copiedItemPath: path }),

      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setError: (error: string | null) => set({ error }),
    }),
    {
      name: 'peek-file-store',
      partialize: (state: FileStore) => ({
        folders: state.folders,
        openedFiles: state.openedFiles,
        expandedNodes: Array.from(state.expandedNodes),
        recentFiles: state.recentFiles,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.expandedNodes = new Set(state.expandedNodes as unknown as string[]);
        }
      },
    }
  )
);
