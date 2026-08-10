export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  modified?: number;
}

export interface RecentFile {
  path: string;
  name: string;
  type: string;
  openedAt: number;
}

export type FileType = 'code' | 'markdown' | 'image' | 'svg' | 'pdf' | 'word' | 'excel' | 'powerpoint' | 'text' | 'binary' | 'unsupported' | 'terminal';

export interface FileInfo {
  path: string;
  name: string;
  content: string;
  type: FileType;
  language?: string;
  isDirty?: boolean;
}

export interface TerminalMeta {
  cwd: string;
  command?: string;
}

export interface Tab {
  id: string;
  path: string;
  name: string;
  type: FileType;
  content?: string;
  language?: string;
  isDirty: boolean;
  terminalMeta?: TerminalMeta;
}
