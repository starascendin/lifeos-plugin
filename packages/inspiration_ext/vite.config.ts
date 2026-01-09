import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, mkdirSync, existsSync } from "fs";

// Plugin to copy manifest.json to dist
const copyManifest = () => ({
  name: "copy-manifest",
  writeBundle() {
    const distDir = resolve(__dirname, "dist");
    const popupDir = resolve(distDir, "popup");
    if (!existsSync(popupDir)) {
      mkdirSync(popupDir, { recursive: true });
    }
    copyFileSync(
      resolve(__dirname, "public/manifest.json"),
      resolve(distDir, "manifest.json")
    );
  },
});

export default defineConfig({
  plugins: [react(), copyManifest()],
  publicDir: "public",
  base: "./", // Use relative paths for Chrome extension
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        "popup/index": resolve(__dirname, "src/popup/index.html"),
        "service-worker": resolve(__dirname, "src/background/service-worker.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].[hash].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
