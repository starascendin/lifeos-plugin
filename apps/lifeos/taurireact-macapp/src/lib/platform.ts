/**
 * Platform Detection Utilities
 *
 * Detects runtime environment: Tauri (desktop), Capacitor (mobile), or Web (browser)
 */

// Check for Tauri (desktop)
export const isTauri =
  typeof window !== "undefined" && "__TAURI__" in window;

// Check for Capacitor (mobile)
// Capacitor injects a global object when running in native context
export const isCapacitor =
  typeof window !== "undefined" &&
  "Capacitor" in window &&
  (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.() === true;

// Check for web browser (not Tauri, not Capacitor)
export const isWeb = !isTauri && !isCapacitor;

// Platform type
export type Platform = "tauri" | "capacitor" | "web";

// Get current platform
export function getPlatform(): Platform {
  if (isTauri) return "tauri";
  if (isCapacitor) return "capacitor";
  return "web";
}

// Helper for native platforms (Tauri or Capacitor)
export const isNative = isTauri || isCapacitor;

// Helper for mobile (Capacitor only, for now)
export const isMobile = isCapacitor;
