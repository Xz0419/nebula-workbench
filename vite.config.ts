import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // 相对路径：同一份 dist 既能放在域名根目录（Netlify / Vercel），
  // 也能放在子路径（GitHub Pages 的 /repo/），无需按平台改配置。
  base: './',
  plugins: [react()],
  server: {
    // 显式绑定 IPv4 回环：避免 localhost 解析到 ::1 而实际监听在 127.0.0.1 导致的 ERR_CONNECTION_REFUSED
    // 访问地址固定为 http://127.0.0.1:5173
    host: '127.0.0.1',
    port: 5173,
    // 端口被占用时直接报错，而不是静默换到 5174 —— 否则你会对着旧端口反复刷新
    strictPort: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
  },
})
