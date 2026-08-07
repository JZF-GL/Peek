// 模块级解析结果缓存（仅内存，应用重启后失效）
// 用于避免切换 tabs 时重复读取/解析同一文件
const cache = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCache<T>(key: string, value: T): void {
  cache.set(key, value);
}

export function hasCache(key: string): boolean {
  return cache.has(key);
}
