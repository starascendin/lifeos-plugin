import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Vite config for server bundle.
 * Uses the same index.html as the extension.
 * The hooks detect server mode and use HTTP instead of direct LLM calls.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  publicDir: false,
  build: {
    outDir: 'dist-server',
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
