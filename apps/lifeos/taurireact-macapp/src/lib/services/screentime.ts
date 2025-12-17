import { invoke } from "@tauri-apps/api/core";
import type { ConvexReactClient } from "convex/react";
import { api } from "@holaai/convex";

// Types matching the Rust structs
export interface ScreenTimeSession {
  bundle_id: string;
  app_name: string | null;
  category: string | null;
  start_time: number;
  end_time: number;
  duration_seconds: number;
  timezone_offset: number | null;
  device_id: string | null;
  is_web_usage: boolean;
  domain: string | null;
}

export interface ScreenTimeResult {
  sessions: ScreenTimeSession[];
  has_permission: boolean;
  error: string | null;
}

export interface DeviceInfo {
  device_id: string;
  device_type: string; // "mac", "iphone", "ipad", "ios", "unknown"
  display_name: string;
  session_count: number;
}

export interface ScreenTimeSyncProgress {
  status: "idle" | "checking" | "syncing" | "error" | "complete";
  currentStep: string;
  totalSessions: number;
  syncedSessions: number;
  error?: string;
  hasPermission: boolean;
}

export const initialSyncProgress: ScreenTimeSyncProgress = {
  status: "idle",
  currentStep: "",
  totalSessions: 0,
  syncedSessions: 0,
  hasPermission: true,
};

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

// Tauri command wrappers
export async function checkScreenTimePermission(): Promise<boolean> {
  if (!isTauri) return false;
  return await invoke<boolean>("check_screentime_permission");
}

export async function readScreenTimeSessions(
  sinceTimestamp?: number,
  deviceId?: string
): Promise<ScreenTimeResult> {
  if (!isTauri) {
    return {
      sessions: [],
      has_permission: false,
      error: "Not running in Tauri",
    };
  }
  return await invoke<ScreenTimeResult>("read_screentime_sessions", {
    sinceTimestamp,
    deviceId,
  });
}

export async function listScreenTimeDevices(): Promise<DeviceInfo[]> {
  if (!isTauri) return [];
  try {
    return await invoke<DeviceInfo[]>("list_screentime_devices");
  } catch (error) {
    console.error("Failed to list devices:", error);
    return [];
  }
}

// Types for aggregated stats (matching Rust structs)
export interface AppUsageStat {
  bundle_id: string;
  app_name: string;
  category: string;
  seconds: number;
  session_count: number;
}

export interface CategoryUsageStat {
  category: string;
  seconds: number;
}

export interface DailyStats {
  date: string;
  total_seconds: number;
  app_usage: AppUsageStat[];
  category_usage: CategoryUsageStat[];
  device_id: string | null;
}

export interface DailySummaryEntry {
  date: string;
  total_seconds: number;
}

// Get daily stats for a specific date with optional device filter
export async function getScreenTimeDailyStats(
  date: string,
  deviceId?: string | null
): Promise<DailyStats | null> {
  if (!isTauri) return null;
  try {
    return await invoke<DailyStats | null>("get_screentime_daily_stats", {
      date,
      deviceId: deviceId ?? undefined,
    });
  } catch (error) {
    console.error("Failed to get daily stats:", error);
    return null;
  }
}

// Get recent daily summaries with optional device filter
export async function getScreenTimeRecentSummaries(
  days: number,
  deviceId?: string | null
): Promise<DailySummaryEntry[]> {
  if (!isTauri) return [];
  try {
    return await invoke<DailySummaryEntry[]>("get_screentime_recent_summaries", {
      days,
      deviceId: deviceId ?? undefined,
    });
  } catch (error) {
    console.error("Failed to get recent summaries:", error);
    return [];
  }
}

export async function getDeviceId(): Promise<string | null> {
  if (!isTauri) return null;
  return await invoke<string | null>("get_device_id");
}

// Sync result from Rust
export interface LocalSyncResult {
  knowledge_sessions: number;
  biome_sessions: number;
  daily_summaries: number;
}

// Sync screen time data to our local database (parses SEGB files and knowledgeC.db)
export async function syncScreenTimeToLocalDb(): Promise<LocalSyncResult> {
  if (!isTauri) {
    return { knowledge_sessions: 0, biome_sessions: 0, daily_summaries: 0 };
  }
  return await invoke<LocalSyncResult>("sync_screentime_to_local_db");
}

// Sync history entry type
export interface SyncHistoryEntry {
  synced_at: string;
  knowledge_sessions: number;
  biome_sessions: number;
  daily_summaries: number;
  source: string; // "manual" or "background"
}

// Get sync history from local database
export async function getScreenTimeSyncHistory(): Promise<SyncHistoryEntry[]> {
  if (!isTauri) return [];
  try {
    return await invoke<SyncHistoryEntry[]>("get_screentime_sync_history");
  } catch (error) {
    console.error("Failed to get sync history:", error);
    return [];
  }
}

// Generate session key for deduplication
function generateSessionKey(session: ScreenTimeSession): string {
  return `${session.bundle_id}_${session.start_time}`;
}

// Aggregate sessions into daily summaries
interface DailySummary {
  date: string;
  totalSeconds: number;
  appUsage: Map<
    string,
    {
      bundleId: string;
      appName: string | undefined;
      category: string | undefined;
      seconds: number;
      sessionCount: number;
    }
  >;
  categoryUsage: Map<string, number>;
  deviceId: string | null;
}

function aggregateDailySummaries(
  sessions: ScreenTimeSession[],
  deviceId: string | null
): Map<string, DailySummary> {
  const summaries = new Map<string, DailySummary>();

  for (const session of sessions) {
    // Convert to local date string (YYYY-MM-DD) using device timezone
    const date = new Date(session.start_time);
    // Use local timezone for date bucketing (not UTC)
    const dateStr = date.toLocaleDateString('en-CA'); // 'en-CA' returns YYYY-MM-DD format

    if (!summaries.has(dateStr)) {
      summaries.set(dateStr, {
        date: dateStr,
        totalSeconds: 0,
        appUsage: new Map(),
        categoryUsage: new Map(),
        deviceId,
      });
    }

    const summary = summaries.get(dateStr)!;
    summary.totalSeconds += session.duration_seconds;

    // Update app usage
    const appKey = session.bundle_id;
    const existing = summary.appUsage.get(appKey) || {
      bundleId: session.bundle_id,
      appName: session.app_name ?? undefined,
      category: session.category ?? undefined,
      seconds: 0,
      sessionCount: 0,
    };
    existing.seconds += session.duration_seconds;
    existing.sessionCount += 1;
    summary.appUsage.set(appKey, existing);

    // Update category usage
    const category = session.category || "Other";
    const catSeconds = summary.categoryUsage.get(category) || 0;
    summary.categoryUsage.set(category, catSeconds + session.duration_seconds);
  }

  return summaries;
}

// Main sync function
export async function syncScreenTimeData(
  client: ConvexReactClient,
  onProgress: (progress: ScreenTimeSyncProgress) => void
): Promise<void> {
  let progress = { ...initialSyncProgress };

  const updateProgress = (updates: Partial<ScreenTimeSyncProgress>) => {
    progress = { ...progress, ...updates };
    onProgress(progress);
  };

  try {
    updateProgress({
      status: "checking",
      currentStep: "Checking permissions...",
    });

    // Check permission
    const hasPermission = await checkScreenTimePermission();
    if (!hasPermission) {
      updateProgress({
        status: "error",
        hasPermission: false,
        error:
          "Full Disk Access permission required. Please grant access in System Settings > Privacy & Security > Full Disk Access.",
      });
      return;
    }

    updateProgress({ status: "syncing", currentStep: "Getting sync status..." });

    // Get last sync timestamp for incremental sync
    let lastSyncTime: number | undefined;
    try {
      const syncStatus = await client.query(
        api.lifeos.screentime.getSyncStatus,
        {}
      );
      lastSyncTime = syncStatus?.lastSessionTime ?? undefined;
    } catch {
      // First sync, no status exists
    }

    updateProgress({ currentStep: "Reading Screen Time data..." });

    // Read sessions from local database
    const result = await readScreenTimeSessions(lastSyncTime);

    if (result.error) {
      updateProgress({
        status: "error",
        error: result.error,
      });
      return;
    }

    const sessions = result.sessions;
    updateProgress({
      totalSessions: sessions.length,
      currentStep: `Found ${sessions.length} sessions to sync`,
    });

    if (sessions.length === 0) {
      updateProgress({
        status: "complete",
        currentStep: "No new sessions to sync",
      });
      return;
    }

    // Get device ID
    const deviceId = await getDeviceId();

    // Batch upsert sessions (50 at a time)
    const BATCH_SIZE = 50;
    for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
      const batch = sessions.slice(i, i + BATCH_SIZE);

      updateProgress({
        currentStep: `Syncing sessions ${i + 1}-${Math.min(i + BATCH_SIZE, sessions.length)}...`,
      });

      // Upsert session batch
      await client.mutation(api.lifeos.screentime.upsertSessionBatch, {
        sessions: batch.map((s) => ({
          sessionKey: generateSessionKey(s),
          bundleId: s.bundle_id,
          appName: s.app_name ?? undefined,
          category: s.category ?? undefined,
          startTime: s.start_time,
          endTime: s.end_time,
          durationSeconds: s.duration_seconds,
          timezoneOffset: s.timezone_offset ?? undefined,
          deviceId: deviceId ?? undefined,
          isWebUsage: s.is_web_usage,
          domain: s.domain ?? undefined,
        })),
      });

      updateProgress({
        syncedSessions: Math.min(i + BATCH_SIZE, sessions.length),
      });
    }

    // Generate and upsert daily summaries
    updateProgress({ currentStep: "Generating daily summaries..." });

    const summaries = aggregateDailySummaries(sessions, deviceId);
    for (const [, summary] of summaries) {
      await client.mutation(api.lifeos.screentime.upsertDailySummary, {
        date: summary.date,
        totalSeconds: summary.totalSeconds,
        appUsage: Array.from(summary.appUsage.values()),
        categoryUsage: Array.from(summary.categoryUsage.entries()).map(
          ([category, seconds]) => ({
            category,
            seconds,
          })
        ),
        deviceId: deviceId ?? undefined,
      });
    }

    // Update sync status
    const latestSessionTime = Math.max(...sessions.map((s) => s.start_time));
    await client.mutation(api.lifeos.screentime.updateSyncStatus, {
      lastSyncAt: Date.now(),
      lastSessionTime: latestSessionTime,
      deviceId: deviceId ?? undefined,
    });

    updateProgress({
      status: "complete",
      currentStep: `Synced ${sessions.length} sessions, ${summaries.size} daily summaries`,
    });
  } catch (error) {
    console.error("Screen Time sync error:", error);
    updateProgress({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
