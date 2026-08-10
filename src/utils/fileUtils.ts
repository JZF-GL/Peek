import type { FileNode, FileInfo, FileType, RecentFile } from '../types';
import { useFileStore } from '../store/useFileStore';
import type { ElectronAPI } from '../types/electron';

// 获取 Electron API
const getElectronAPI = (): ElectronAPI | null => {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI as ElectronAPI;
  }
  return null;
};

const CODE_EXTENSIONS = [
  'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cc', 'h', 'hpp', 'cs', 'go', 'rs',
  'rb', 'php', 'swift', 'kt', 'kts', 'scala', 'html', 'htm', 'css', 'scss', 'less',
  'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'conf', 'cfg', 'properties',
  'sh', 'bash', 'zsh', 'shell', 'sql', 'vue', 'svelte', 'astro', 'jsm', 'mjs', 'cjs',
  'dart', 'r', 'jl', 'lua', 'pl', 'pm', 'groovy', 'gradle', 'dockerfile', 'makefile',
  'cmake', 'proto', 'graphql', 'gql', 'tf', 'terraform', 'csv',
];

const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mdx', 'rst', 'txt', 'log', 'env'];

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'tiff', 'avif'];

const SVG_EXTENSIONS = ['svg'];

// 办公文档 - 支持预览
const PDF_EXTENSIONS = ['pdf'];
const WORD_EXTENSIONS = ['docx', 'doc'];
const EXCEL_EXTENSIONS = ['xlsx', 'xls'];
const POWERPOINT_EXTENSIONS = ['pptx', 'ppt'];

// 不支持预览的文件类型 (二进制/多媒体)
const UNSUPPORTED_EXTENSIONS = [
  // 压缩文件 (二进制)
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'tgz',
  // 可执行文件 (二进制)
  'exe', 'msi', 'apk', 'dmg', 'deb', 'rpm', 'bin', 'cmd', 'bat', 'com',
  // 系统文件 (二进制)
  'dll', 'so', 'dylib', 'sys', 'drv', 'lib',
  // 媒体文件 (需要播放器)
  'mp3', 'wav', 'flac', 'ogg', 'aac', 'wma', 'm4a',
  'mp4', 'avi', 'mov', 'wmv', 'mkv', 'webm', 'flv', 'm4v', 'mpg', 'mpeg',
  // 数据库 (二进制格式)
  'db', 'sqlite', 'sqlite3',
  // 设计文件
  'psd', 'ai', 'sketch', 'fig', 'dwg', 'dxf',
  // 3D 文件
  '3ds', 'obj', 'fbx', 'blend', 'dae',
  // 邮件
  'eml', 'msg',
  // 其他特殊格式
  'epub', 'mobi',
  // 旧版办公格式 (暂不支持)
  'odt', 'ods', 'odp',
];

export function getFileType(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  // 优先检查办公文档
  if (PDF_EXTENSIONS.includes(ext)) return 'pdf';
  if (WORD_EXTENSIONS.includes(ext)) return 'word';
  if (EXCEL_EXTENSIONS.includes(ext)) return 'excel';
  if (POWERPOINT_EXTENSIONS.includes(ext)) return 'powerpoint';
  
  // 然后检查其他类型
  if (UNSUPPORTED_EXTENSIONS.includes(ext)) return 'unsupported';
  if (SVG_EXTENSIONS.includes(ext)) return 'svg';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (MARKDOWN_EXTENSIONS.includes(ext)) return 'markdown';
  if (CODE_EXTENSIONS.includes(ext)) return 'code';
  
  return 'text';
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function isUnsupportedFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return UNSUPPORTED_EXTENSIONS.includes(ext);
}

export function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', jsm: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    // Python
    py: 'python', pyw: 'python',
    // Java/Kotlin
    java: 'java', kt: 'kotlin', kts: 'kotlin',
    // C/C++
    c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp', hxx: 'cpp',
    // C#
    cs: 'csharp',
    // Go/Rust
    go: 'go', rs: 'rust',
    // Ruby/PHP
    rb: 'ruby', php: 'php',
    // Apple
    swift: 'swift',
    // Web
    html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
    // Data
    json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    // Config
    ini: 'ini', conf: 'ini', cfg: 'ini', properties: 'ini',
    // Shell
    sh: 'shell', bash: 'shell', zsh: 'shell', shell: 'shell',
    // DB
    sql: 'sql',
    // Frameworks
    vue: 'vue', svelte: 'svelte',
    // Markup
    md: 'markdown', markdown: 'markdown', mdx: 'markdown',
    // Other
    dart: 'dart', r: 'r', jl: 'julia', lua: 'lua',
    pl: 'perl', pm: 'perl',
    groovy: 'groovy', gradle: 'groovy',
    proto: 'proto', graphql: 'graphql', gql: 'graphql',
    dockerfile: 'dockerfile', makefile: 'makefile', cmake: 'cmake',
    tf: 'hcl', terraform: 'hcl',
  };
  
  return languageMap[ext] || 'plaintext';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

export function isElectron(): boolean {
  return getElectronAPI() !== null;
}

export async function openDirectoryDialog(): Promise<string | null> {
  const api = getElectronAPI();
  if (api) {
    return api.dialog.openDirectory();
  }
  
  // 非 Electron 环境的 fallback
  console.warn('openDirectoryDialog 仅在 Electron 环境中可用');
  return null;
}

export async function openFileDialog(): Promise<string[]> {
  const api = getElectronAPI();
  if (api) {
    return api.dialog.openFile();
  }
  
  console.warn('openFileDialog 仅在 Electron 环境中可用');
  return [];
}

export async function buildFileTree(dirPath: string): Promise<FileNode[]> {
  try {
    const api = getElectronAPI();
    if (api) {
      const entries = await api.fs.buildTree(dirPath);
      
      return entries.map((entry) => ({
        name: entry.name,
        path: entry.path,
        type: entry.type,
        size: entry.size,
        modified: entry.mtime,
        children: entry.children,
      })).sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }
    
    console.warn('buildFileTree 仅在 Electron 环境中可用');
    return [];
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
}

export async function readFileContent(filePath: string): Promise<FileInfo | null> {
  try {
    const name = filePath.split(/[\\/]/).pop() || filePath;
    const type = getFileType(name);
    const api = getElectronAPI();
    
    if (type === 'image') {
      let imageData = filePath;
      
      if (api) {
        try {
          const result = await api.fs.readBinaryFile(filePath);
          // 处理返回格式 { content: base64String }
          const base64 = result?.content || '';
          const ext = name.split('.').pop()?.toLowerCase() || 'png';
          const mimeTypes: Record<string, string> = {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            bmp: 'image/bmp',
            svg: 'image/svg+xml',
            webp: 'image/webp',
            ico: 'image/x-icon',
          };
          const mimeType = mimeTypes[ext] || 'image/*';
          imageData = `data:${mimeType};base64,${base64}`;
        } catch (err) {
          console.error('Error reading image:', err);
        }
      }
      
      // 添加到打开的文件列表（侧边栏显示）
      const imgStore = useFileStore.getState();
      imgStore.addOpenedFile({
        name,
        path: filePath,
        type: 'file',
      });

      return {
        path: filePath,
        name,
        content: imageData,
        type,
      };
    }

    let content = '';
    if (api) {
      const result = await api.fs.readTextFile(filePath);
      // 处理返回格式 { content: string }
      content = result?.content || '';
    } else {
      // 非 Electron 环境尝试 fetch
      try {
        const response = await fetch(filePath);
        content = await response.text();
      } catch {
        console.warn('无法在非 Electron 环境中读取本地文件');
      }
    }
    
    const fileInfo: FileInfo = {
      path: filePath,
      name,
      content,
      type,
      language: getLanguage(name),
      isDirty: false,
    };

    const store = useFileStore.getState();
    store.addRecentFile({
      path: filePath,
      name,
      type,
      openedAt: Date.now(),
    });

    // 添加到打开的文件列表（侧边栏显示）
    store.addOpenedFile({
      name,
      path: filePath,
      type: 'file',
    });

    return fileInfo;
  } catch (error) {
    console.error('Error reading file:', error);
    return null;
  }
}

// 仅读取文本内容，不更新最近文件/打开文件列表（用于自动刷新等场景）
export async function readFileTextOnly(filePath: string): Promise<string | null> {
  try {
    const api = getElectronAPI();
    if (api) {
      const result = await api.fs.readTextFile(filePath);
      return result?.content ?? null;
    }
    console.warn('readFileTextOnly 仅在 Electron 环境中可用');
    return null;
  } catch (error) {
    console.error('Error reading text file:', error);
    return null;
  }
}

export async function saveFileContent(filePath: string, content: string): Promise<boolean> {
  try {
    const api = getElectronAPI();
    if (api) {
      await api.fs.writeTextFile(filePath, content);
      return true;
    }
    
    console.warn('saveFileContent 仅在 Electron 环境中可用');
    return false;
  } catch (error) {
    console.error('Error saving file:', error);
    return false;
  }
}

export function getFileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function createFile(filePath: string): Promise<boolean> {
  try {
    const api = getElectronAPI();
    if (api) {
      return await api.fs.createFile(filePath);
    }
    console.warn('createFile 仅在 Electron 环境中可用');
    return false;
  } catch (error) {
    console.error('Error creating file:', error);
    return false;
  }
}

export async function createFolder(dirPath: string): Promise<boolean> {
  try {
    const api = getElectronAPI();
    if (api) {
      return await api.fs.createFolder(dirPath);
    }
    console.warn('createFolder 仅在 Electron 环境中可用');
    return false;
  } catch (error) {
    console.error('Error creating folder:', error);
    return false;
  }
}

async function generateUniquePath(targetPath: string): Promise<string> {
  const api = getElectronAPI();
  if (!api) return targetPath;

  const sep = targetPath.includes('/') ? '/' : '\\';
  const lastSepIndex = targetPath.lastIndexOf(sep);
  const dir = targetPath.substring(0, lastSepIndex);
  const fullName = targetPath.substring(lastSepIndex + 1);

  const dotIndex = fullName.lastIndexOf('.');
  const hasExtension = dotIndex > 0;
  const name = hasExtension ? fullName.substring(0, dotIndex) : fullName;
  const ext = hasExtension ? fullName.substring(dotIndex) : '';

  let counter = 1;
  while (counter <= 1000) {
    const candidate = `${dir}${sep}${name}_${counter}${ext}`;
    const info = await api.fs.getFileInfo(candidate);
    if (!info.exists) {
      return candidate;
    }
    counter++;
  }

  return targetPath;
}

export async function copyFileOrFolder(sourcePath: string, targetPath: string): Promise<boolean> {
  try {
    const api = getElectronAPI();
    if (!api) {
      console.warn('copyFileOrFolder 仅在 Electron 环境中可用');
      return false;
    }

    const targetInfo = await api.fs.getFileInfo(targetPath);
    const finalTarget = targetInfo.exists ? await generateUniquePath(targetPath) : targetPath;

    return await api.fs.copy(sourcePath, finalTarget);
  } catch (error) {
    console.error('Error copying file/folder:', error);
    return false;
  }
}

export async function deleteFileOrFolder(targetPath: string): Promise<boolean> {
  try {
    const api = getElectronAPI();
    if (api) {
      return await api.fs.delete(targetPath);
    }
    console.warn('deleteFileOrFolder 仅在 Electron 环境中可用');
    return false;
  } catch (error) {
    console.error('Error deleting file/folder:', error);
    return false;
  }
}
