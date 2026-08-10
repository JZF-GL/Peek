import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

// Vite 插件：移除 CJS 模块开头的 shebang 行
function removeShebangPlugin(): any {
  return {
    name: 'vite-plugin-remove-shebang',
    transform(code: string, id: string) {
      if (id.includes('@jose.espana') && code.startsWith('#!')) {
        return {
          code: code.replace(/^#!.*\n/, ''),
          map: null,
        }
      }
      return null
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // 打包后 Electron 以 file:// 协议加载，必须使用相对路径
  base: './',
  plugins: [
    removeShebangPlugin(),
    react(),
    nodePolyfills({
      // 只 polyfill docstream 需要的模块
      include: ['stream', 'util', 'zlib', 'buffer'],
      globals: {
        Buffer: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'fs': path.resolve(__dirname, './src/polyfills/fs-empty.ts'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    include: [
      // docstream 是 CJS 模块，需让 Vite 预打包为 ESM
      '@jose.espana/docstream',
    ],
  },
})
