// vite.widget.config.ts — Widget Web Component 构建
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    vue({
      customElement: true,
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    lib: {
      entry: 'src/widget/entry.ts',
      name: 'LiuyanBoard',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'widget.css';
          return 'widget.[ext]';
        },
      },
    },
    cssCodeSplit: false,
  },
});
