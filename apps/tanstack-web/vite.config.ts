import path from "node:path";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@holaai/convex": path.resolve(__dirname, "../../packages/holaaiconvex"),
    },
  },
  optimizeDeps: {
    include: ["convex/react", "convex/react-clerk"],
  },
  ssr: {
    noExternal: ["@holaai/convex"],
  },
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart(),
    viteReact(),
  ],
});
