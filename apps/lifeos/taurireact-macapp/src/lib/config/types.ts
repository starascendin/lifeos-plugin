/**
 * App Configuration Types
 */

export interface LiveKitConfig {
  server_url: string;
  is_configured: boolean;
}

export interface AppConfig {
  livekit: LiveKitConfig;
  runtime: "tauri" | "web";
}

export interface ConfigContextValue {
  config: AppConfig | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
