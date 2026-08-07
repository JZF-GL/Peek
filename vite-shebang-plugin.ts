import { Plugin } from 'vite';

/**
 * 移除文件开头的 shebang (#!) 行
 * 这在处理 Node.js CJS 模块时很有用，因为浏览器不支持 shebang
 */
export function shebangRemover(): Plugin {
  return {
    name: 'vite-plugin-remove-shebang',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('node_modules/@jose.espana')) {
        return {
          code: code.replace(/^#!.*\n/, ''),
          map: null,
        };
      }
      return null;
    },
  };
}
