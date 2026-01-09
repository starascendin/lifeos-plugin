import { useState, useEffect } from "react";

/**
 * Check if running in Tauri at runtime
 */
const checkIsTauri = () => typeof window !== "undefined" && "__TAURI__" in window;

export interface UsePlatformReturn {
  /** True if running in Tauri desktop app */
  isTauri: boolean;
  /** True if running in browser (web) */
  isBrowser: boolean;
  /** True during initial hydration */
  isLoading: boolean;
}

/**
 * Hook for platform detection.
 * Handles SSR/hydration safely by returning loading state initially.
 */
export function usePlatform(): UsePlatformReturn {
  const [isTauri, setIsTauri] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsTauri(checkIsTauri());
    setIsLoading(false);
  }, []);

  return {
    isTauri,
    isBrowser: !isTauri && !isLoading,
    isLoading,
  };
}

/**
 * Non-hook version for use outside React components.
 * Only use after initial render/hydration.
 */
export const isTauri = () => checkIsTauri();
