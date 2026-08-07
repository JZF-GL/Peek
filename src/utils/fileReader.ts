import type { ElectronAPI, FileContent } from '../types/electron';

// 通用文件读取工具

export async function readBinaryFile(filePath: string): Promise<ArrayBuffer> {
  // 如果是 data URL，直接转换
  if (filePath.startsWith('data:')) {
    const base64 = filePath.split(',')[1];
    const binaryString = atob(base64);
    const arrayBuffer = new ArrayBuffer(binaryString.length);
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return arrayBuffer;
  }

  // 使用 Electron API 读取
  const api = window.electronAPI as ElectronAPI | undefined;
  if (api && api.fs) {
    const result = await api.fs.readBinaryFile(filePath) as FileContent;
    if (result && result.content) {
      const binaryString = atob(result.content);
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const bytes = new Uint8Array(arrayBuffer);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return arrayBuffer;
    }
    throw new Error('无法读取文件');
  }

  throw new Error('不支持的环境');
}

export async function readTextFile(filePath: string): Promise<string> {
  // 使用 Electron API 读取
  const api = window.electronAPI as ElectronAPI | undefined;
  if (api && api.fs) {
    const result = await api.fs.readTextFile(filePath) as FileContent;
    if (result && result.content) {
      return result.content;
    }
    throw new Error('无法读取文件');
  }

  throw new Error('不支持的环境');
}
