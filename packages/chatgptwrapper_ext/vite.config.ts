import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-extension-files',
      closeBundle() {
        // Copy manifest.json
        copyFileSync('public/manifest.json', 'dist/manifest.json');

        // Copy background.js
        copyFileSync('public/background.js', 'dist/background.js');

        // Copy proof-worker.js
        copyFileSync('public/proof-worker.js', 'dist/proof-worker.js');

        // Copy rules directory
        if (!existsSync('dist/rules')) mkdirSync('dist/rules');
        copyFileSync('public/rules/chatgpt.json', 'dist/rules/chatgpt.json');
        copyFileSync('public/rules/x-frame-options.json', 'dist/rules/x-frame-options.json');
      }
    }
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});
