// vite.admin.config.ts — 管理后台 SPA 构建
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  base: '/admin/',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/admin/admin.html'),
      output: {
        entryFileNames: 'admin/assets/[name]-[hash].js',
        chunkFileNames: 'admin/assets/[name]-[hash].js',
        assetFileNames: 'admin/assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8788',
    },
  },
});
