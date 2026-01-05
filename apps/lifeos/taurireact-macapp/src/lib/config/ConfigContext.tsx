/**
 * Config Context - Centralized app configuration
 *
 * Provides unified config access for both Tauri and Web deployments.
 * LiveKit config is fetched from Convex.
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import type { AppConfig, ConfigContextValue, LiveKitConfig } from "./types";

// Detect runtime environment
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Query LiveKit config from Convex
  const livekitConfig = useQuery(api.lifeos.livekit_config.getConfig);

  const refresh = useCallback(async () => {
    // Config is automatically refreshed by Convex reactive query
    // This is a no-op but kept for API consistency
  }, []);

  useEffect(() => {
    if (livekitConfig === undefined) {
      // Still loading
      setIsLoading(true);
      return;
    }

    try {
      const appConfig: AppConfig = {
        livekit: livekitConfig as LiveKitConfig,
        runtime: isTauri ? "tauri" : "web",
      };
      setConfig(appConfig);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
    } finally {
      setIsLoading(false);
    }
  }, [livekitConfig]);

  return (
    <ConfigContext.Provider value={{ config, isLoading, error, refresh }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): ConfigContextValue {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within ConfigProvider");
  }
  return context;
}

/**
 * Convenience hook for LiveKit config
 */
export function useLiveKitConfig(): LiveKitConfig | null {
  const { config } = useConfig();
  return config?.livekit ?? null;
}
