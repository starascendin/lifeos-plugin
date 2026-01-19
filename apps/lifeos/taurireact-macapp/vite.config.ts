import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import pkg from "./package.json";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// Use different ports for different modes to allow running DEV, STAGING and PROD simultaneously
// DEV mode: port 1420, Staging mode: port 1440, Production mode: port 1430
const getPort = (mode: string) => {
  if (mode === "production") return 1430;
  if (mode === "staging") return 1440;
  return 1420;
};
const getHmrPort = (mode: string) => {
  if (mode === "production") return 1431;
  if (mode === "staging") return 1441;
  return 1421;
};

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => ({
  plugins: [react()],

  // Inject build-time version info
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
  },
  // Expose additional env vars (e.g. E2E_TEST_USER_EMAIL) to the client.
  // Only enable test-user login UI in non-production modes.
  envPrefix: ["VITE_", "E2E_"],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: getPort(mode),
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: getHmrPort(mode),
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
