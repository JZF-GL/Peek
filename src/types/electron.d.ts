// Electron API 类型声明
export interface ElectronAPI {
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    unmaximize: () => Promise<void>;
    close: () => Promise<void>;
  };
  dialog: {
    openDirectory: () => Promise<string | null>;
    openFile: () => Promise<string[]>;
  };
  fs: {
    readDir: (dirPath: string) => Promise<FileEntry[]>;
    buildTree: (dirPath: string) => Promise<FileNode[]>;
    readTextFile: (filePath: string) => Promise<FileContent>;
    readBinaryFile: (filePath: string) => Promise<FileContent>;
    writeTextFile: (filePath: string, content: string) => Promise<boolean>;
    getFileInfo: (filePath: string) => Promise<FileInfoResult>;
    createFile: (filePath: string) => Promise<boolean>;
    createFolder: (dirPath: string) => Promise<boolean>;
    copy: (sourcePath: string, targetPath: string) => Promise<boolean>;
    delete: (targetPath: string) => Promise<boolean>;
    watchFolder: (dirPath: string) => Promise<boolean>;
    unwatchFolder: (dirPath: string) => Promise<boolean>;
    watchFile: (filePath: string) => Promise<boolean>;
    unwatchFile: (filePath: string) => Promise<boolean>;
    onFolderChanged: (callback: (dirPath: string) => void) => () => void;
    onFileChanged: (callback: (filePath: string) => void) => () => void;
  };
  shell: {
    openExternal: (url: string) => Promise<boolean>;
  };
  app: {
    getLaunchFiles: () => Promise<string[]>;
    onOpenFiles: (callback: (filePaths: string[]) => void) => void;
    onDropFiles: (callback: (filePaths: string[]) => void) => void;
    getDroppedFiles: (fileList: FileList) => Promise<string[]>;
  };
  getPlatform: () => string;
  isElectron: boolean;
}

export interface FileContent {
  content: string;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  isDirectory: boolean;
  size: number;
  mtime: number;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  mtime?: number;
  children?: FileNode[];
}

export interface FileInfoResult {
  path: string;
  exists: boolean;
  isDirectory?: boolean;
  isFile?: boolean;
  size?: number;
  mtime?: number;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
