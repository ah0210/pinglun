// vite.widget.config.ts — Widget Web Component 构建
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
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
      entry: './src/widget/entry.ts',
      name: 'LiuyanBoard',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    // 不提取 CSS 为独立文件，让 Vue 运行时将样式注入 Shadow DOM
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // CSS 仍然会被提取，但我们会在 entry.ts 中手动注入
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'widget.css';
          return 'widget.[ext]';
        },
      },
    },
  },
});
