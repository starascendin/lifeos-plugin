/// <reference types="vite/client" />

declare const __BUILD_TIMESTAMP__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_NATIVE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
