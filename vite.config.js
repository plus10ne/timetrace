import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: process.env.NODE_ENV === 'production' 
    ? '/timetrace/'   // 生产环境使用仓库名前缀
    : '/',            // 开发环境使用根路径
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
})
