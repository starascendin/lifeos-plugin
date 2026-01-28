/**
 * Granola Service
 *
 * Service for syncing meeting notes from Granola app to Convex.
 * Uses Tauri commands to run the Granola CLI and read output files.
 */

// Types for Granola data (matching Rust structs)

export interface GranolaUtterance {
  source: string;
  text: string;
  start_timestamp?: string;
  end_timestamp?: string;
  confidence?: number;
}

export interface GranolaFolder {
  id: string;
  name: string;
}

export interface GranolaMeeting {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  workspace_id?: string;
  workspace_name?: string;
  folders?: GranolaFolder[];
  resume_markdown?: string;
  transcript?: GranolaUtterance[];
  transcript_markdown?: string;
}

export interface GranolaSyncResult {
  success: boolean;
  error?: string;
  message?: string;
  meetings_count?: number;
}

export interface GranolaTokenStatus {
  has_token: boolean;
  is_valid: boolean;
  expires_at?: string;
  minutes_remaining?: number;
  message: string;
}

export interface GranolaSyncProgress {
  status: "idle" | "checking" | "syncing" | "error" | "complete";
  currentStep: string;
  error?: string;
  progress?: {
    current: number;
    total: number;
  };
}

export const initialSyncProgress: GranolaSyncProgress = {
  status: "idle",
  currentStep: "",
};

// Storage keys
const LAST_SYNC_KEY = "granola_last_sync_timestamp";
const AUTO_SYNC_ENABLED_KEY = "granola_auto_sync_enabled";
const AUTO_SYNC_INTERVAL_KEY = "granola_auto_sync_interval";

// Sync interval options
export const SYNC_INTERVAL_OPTIONS = [
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
];

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

/**
 * Get the auto-sync enabled setting
 */
export function getGranolaAutoSyncEnabled(): boolean {
  const stored = localStorage.getItem(AUTO_SYNC_ENABLED_KEY);
  return stored !== null ? stored === "true" : true;
}

/**
 * Save the auto-sync enabled setting
 */
export function saveGranolaAutoSyncEnabled(enabled: boolean): void {
  localStorage.setItem(AUTO_SYNC_ENABLED_KEY, String(enabled));
}

/**
 * Get the auto-sync interval in minutes
 */
export function getGranolaSyncInterval(): number {
  const stored = localStorage.getItem(AUTO_SYNC_INTERVAL_KEY);
  return stored ? parseInt(stored, 10) : 10;
}

/**
 * Save the auto-sync interval
 */
export function saveGranolaSyncInterval(interval: number): void {
  localStorage.setItem(AUTO_SYNC_INTERVAL_KEY, String(interval));
}

/**
 * Get the last sync timestamp
 */
export function getGranolaLastSync(): Date | null {
  const stored = localStorage.getItem(LAST_SYNC_KEY);
  return stored ? new Date(stored) : null;
}

/**
 * Save the last sync timestamp
 */
export function saveGranolaLastSync(date: Date): void {
  localStorage.setItem(LAST_SYNC_KEY, date.toISOString());
}

/**
 * Check if Granola is available (CLI exists and config is set up)
 * Uses Rust backend to check file existence
 */
export async function checkGranolaAvailable(): Promise<boolean> {
  if (!isTauri) return false;

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<boolean>("check_granola_available");
  } catch (error) {
    console.error("Failed to check Granola availability:", error);
    return false;
  }
}

/**
 * Check Granola token status - whether we have a valid, non-expired token
 * The CLI uses access tokens imported from the Granola desktop app
 * Tokens are valid for ~4-6 hours
 */
export async function checkGranolaTokenStatus(): Promise<GranolaTokenStatus> {
  if (!isTauri) {
    return {
      has_token: false,
      is_valid: false,
      message: "Not running in Tauri",
    };
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<GranolaTokenStatus>("check_granola_token_status");
  } catch (error) {
    console.error("Failed to check token status:", error);
    return {
      has_token: false,
      is_valid: false,
      message: String(error),
    };
  }
}

/**
 * Run the Granola CLI sync command via Rust backend
 */
export async function runGranolaSync(
  onProgress?: (progress: GranolaSyncProgress) => void
): Promise<GranolaSyncResult> {
  if (!isTauri) {
    return { success: false, error: "Not running in Tauri" };
  }

  try {
    onProgress?.({
      status: "checking",
      currentStep: "Checking Granola availability...",
    });

    const available = await checkGranolaAvailable();
    if (!available) {
      return {
        success: false,
        error:
          "Granola CLI not found or config.json missing. Check installation.",
      };
    }

    onProgress?.({
      status: "syncing",
      currentStep: "Running Granola sync...",
    });

    // Run the sync via Rust backend
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<GranolaSyncResult>("sync_granola");

    if (result.success) {
      onProgress?.({
        status: "complete",
        currentStep: result.message || `Synced ${result.meetings_count || 0} meetings`,
      });
    } else {
      onProgress?.({
        status: "error",
        currentStep: result.error || "Sync failed",
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    console.error("Granola sync failed:", error);
    const errorMsg = String(error);
    onProgress?.({
      status: "error",
      currentStep: errorMsg,
      error: errorMsg,
    });
    return { success: false, error: errorMsg };
  }
}

/**
 * Read synced meetings from the output directory via Rust backend
 */
export async function readSyncedMeetings(): Promise<GranolaMeeting[]> {
  if (!isTauri) return [];

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<GranolaMeeting[]>("get_granola_meetings");
  } catch (error) {
    console.error("Failed to read synced meetings:", error);
    return [];
  }
}

/**
 * Check if an error is an auth error
 */
export function isAuthError(error: string | undefined): boolean {
  if (!error) return false;
  const lowerError = error.toLowerCase();
  return (
    lowerError.includes("auth failed") ||
    lowerError.includes("invalid_grant") ||
    lowerError.includes("session has already ended") ||
    lowerError.includes("unauthorized") ||
    lowerError.includes("401")
  );
}

/**
 * Run Granola auth to import fresh tokens from the Granola desktop app
 * Prerequisite: Granola app must be open and logged in
 * Tokens are valid for ~4-6 hours
 */
export async function runGranolaAuth(): Promise<GranolaSyncResult> {
  if (!isTauri) {
    return { success: false, error: "Not running in Tauri" };
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<GranolaSyncResult>("run_granola_auth");
  } catch (error) {
    console.error("Granola auth failed:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Format time ago for display
 */
export function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format countdown for display
 */
export function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format date for display
 */
export function formatMeetingDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        hour: "numeric",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        hour: "numeric",
        minute: "2-digit",
      });
    }
  } catch {
    return dateString;
  }
}
