/**
 * Platform Detection Utilities
 *
 * Detects runtime environment: Tauri (desktop) or Web (browser)
 */

// Check for Tauri (desktop)
export const isTauri =
  typeof window !== "undefined" && "__TAURI__" in window;

// Check for web browser (not Tauri)
export const isWeb = !isTauri;

// Platform type
export type Platform = "tauri" | "web";

// Get current platform
export function getPlatform(): Platform {
  if (isTauri) return "tauri";
  return "web";
}

// Helper for native platforms (Tauri only)
export const isNative = isTauri;
