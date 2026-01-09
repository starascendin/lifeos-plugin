import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ConvexReactClient } from "convex/react";
import { api } from "@holaai/convex";

// Types matching Rust structs
export interface VoiceMemo {
  id: number;
  uuid: string;
  custom_label: string | null;
  date: number; // Unix timestamp in milliseconds
  duration: number; // Duration in seconds
  original_path: string;
  local_path: string | null;
  transcription: string | null;
  transcription_language: string | null;
  transcribed_at: number | null;
  file_size: number | null;
}

export interface VoiceMemosExportResult {
  total_count: number;
  exported_count: number;
  skipped_count: number;
  error: string | null;
}

export interface VoiceMemosExportProgress {
  current: number;
  total: number;
  exported: number;
  skipped: number;
  current_memo: string;
  status: "scanning" | "copying" | "complete" | "error";
}

export interface TranscriptionResult {
  memo_id: number;
  transcription: string;
  language: string | null;
  success: boolean;
  error: string | null;
}

export interface TranscriptionProgress {
  memo_id: number;
  memo_name: string;
  status: "preprocessing" | "uploading" | "transcribing" | "complete" | "error";
  current: number;
  total: number;
  error: string | null;
  // Conversion info
  original_format: string | null;
  original_size: number | null;
  converted_format: string | null;
  converted_size: number | null;
}

export interface TranscriptionEligibility {
  eligible: boolean;
  reason: string | null;
  file_size: number | null;
}

export interface VoiceMemosSyncProgress {
  status: "idle" | "syncing" | "complete" | "error";
  current: number;
  total: number;
  exported: number;
  skipped: number;
  currentMemo: string;
  error?: string;
}

export const initialSyncProgress: VoiceMemosSyncProgress = {
  status: "idle",
  current: 0,
  total: 0,
  exported: 0,
  skipped: 0,
  currentMemo: "",
};

// Progress type for syncing to Convex cloud
export interface ConvexSyncProgress {
  status: "idle" | "preparing" | "syncing" | "complete" | "error";
  current: number;
  total: number;
  synced: number;
  skipped: number;
  currentMemo: string;
  error?: string;
}

export const initialConvexSyncProgress: ConvexSyncProgress = {
  status: "idle",
  current: 0,
  total: 0,
  synced: 0,
  skipped: 0,
  currentMemo: "",
};

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

// ==================== Sync Functions ====================

/**
 * Sync voice memos from macOS to local database
 */
export async function syncVoiceMemos(
  onProgress?: (progress: VoiceMemosSyncProgress) => void
): Promise<VoiceMemosExportResult> {
  if (!isTauri) {
    return {
      total_count: 0,
      exported_count: 0,
      skipped_count: 0,
      error: "Not running in Tauri",
    };
  }

  let progress: VoiceMemosSyncProgress = { ...initialSyncProgress };
  let unlisten: UnlistenFn | null = null;

  const updateProgress = (updates: Partial<VoiceMemosSyncProgress>) => {
    progress = { ...progress, ...updates };
    onProgress?.(progress);
  };

  try {
    updateProgress({
      status: "syncing",
      currentMemo: "Starting sync...",
    });

    // Set up event listener for progress updates
    unlisten = await listen<VoiceMemosExportProgress>(
      "voicememos-sync-progress",
      (event) => {
        const data = event.payload;
        const statusMap: Record<string, VoiceMemosSyncProgress["status"]> = {
          scanning: "syncing",
          copying: "syncing",
          complete: "complete",
          error: "error",
        };

        updateProgress({
          status: statusMap[data.status] || "syncing",
          current: data.current,
          total: data.total,
          exported: data.exported,
          skipped: data.skipped,
          currentMemo: data.current_memo,
        });
      }
    );

    // Run sync
    const result = await invoke<VoiceMemosExportResult>("sync_voicememos");

    if (result.error) {
      updateProgress({
        status: "error",
        error: result.error,
      });
    } else {
      updateProgress({
        status: "complete",
        exported: result.exported_count,
        skipped: result.skipped_count,
        total: result.total_count,
        currentMemo: `Synced ${result.exported_count} memos, ${result.skipped_count} already existed`,
      });
    }

    return result;
  } catch (error) {
    console.error("Voice memos sync error:", error);
    updateProgress({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      total_count: 0,
      exported_count: 0,
      skipped_count: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    if (unlisten) {
      unlisten();
    }
  }
}

/**
 * Get all synced voice memos from local database
 */
export async function getVoiceMemos(): Promise<VoiceMemo[]> {
  if (!isTauri) return [];
  return await invoke<VoiceMemo[]>("get_voicememos");
}

/**
 * Get a single voice memo by ID
 */
export async function getVoiceMemo(memoId: number): Promise<VoiceMemo | null> {
  if (!isTauri) return null;
  return await invoke<VoiceMemo | null>("get_voicememo", { memoId });
}

// ==================== Convex Cloud Sync Functions ====================

/**
 * Sync transcribed voice memos to Convex cloud
 * Only syncs transcript text and metadata, NOT audio files
 */
export async function syncTranscriptsToConvex(
  client: ConvexReactClient,
  onProgress?: (progress: ConvexSyncProgress) => void
): Promise<{ synced: number; skipped: number; error?: string }> {
  if (!isTauri) {
    return { synced: 0, skipped: 0, error: "Not running in Tauri" };
  }

  let progress: ConvexSyncProgress = { ...initialConvexSyncProgress };

  const updateProgress = (updates: Partial<ConvexSyncProgress>) => {
    progress = { ...progress, ...updates };
    onProgress?.(progress);
  };

  try {
    updateProgress({ status: "preparing", currentMemo: "Loading transcribed memos..." });

    // Get all local memos
    const localMemos = await getVoiceMemos();

    // Filter to only transcribed memos
    const transcribedMemos = localMemos.filter((m) => m.transcription);

    if (transcribedMemos.length === 0) {
      updateProgress({
        status: "complete",
        currentMemo: "No transcribed memos to sync",
      });
      return { synced: 0, skipped: 0 };
    }

    updateProgress({
      total: transcribedMemos.length,
      currentMemo: `Found ${transcribedMemos.length} transcribed memos`,
    });

    // Get already synced localIds to skip duplicates (optimization)
    let syncedLocalIds: string[] = [];
    try {
      syncedLocalIds = await client.query(api.lifeos.voicememo.getSyncedLocalIds, {});
    } catch {
      // First sync or not authenticated, continue with empty list
    }

    const syncedSet = new Set(syncedLocalIds);

    // Filter out already synced memos
    const memosToSync = transcribedMemos.filter((m) => !syncedSet.has(m.uuid));

    if (memosToSync.length === 0) {
      updateProgress({
        status: "complete",
        skipped: transcribedMemos.length,
        currentMemo: "All memos already synced",
      });
      return { synced: 0, skipped: transcribedMemos.length };
    }

    updateProgress({
      status: "syncing",
      total: memosToSync.length,
      currentMemo: `Syncing ${memosToSync.length} memos...`,
    });

    // Batch upsert (50 at a time)
    const BATCH_SIZE = 50;
    let totalSynced = 0;

    for (let i = 0; i < memosToSync.length; i += BATCH_SIZE) {
      const batch = memosToSync.slice(i, i + BATCH_SIZE);

      updateProgress({
        current: i,
        currentMemo: `Syncing ${i + 1}-${Math.min(i + BATCH_SIZE, memosToSync.length)}...`,
      });

      const result = await client.mutation(api.lifeos.voicememo.upsertTranscriptBatch, {
        memos: batch.map((m) => ({
          localId: m.uuid,
          name: m.custom_label || `Recording - ${formatMemoDateTime(m.date)}`,
          duration: m.duration * 1000, // Convert seconds to ms
          transcript: m.transcription!,
          language: m.transcription_language ?? undefined,
          clientCreatedAt: m.date,
          clientUpdatedAt: m.transcribed_at ?? m.date,
          transcribedAt: m.transcribed_at ?? undefined,
        })),
      });

      totalSynced += result.insertedCount + result.updatedCount;

      updateProgress({
        synced: totalSynced,
        current: Math.min(i + BATCH_SIZE, memosToSync.length),
      });
    }

    const skipped = transcribedMemos.length - memosToSync.length;

    updateProgress({
      status: "complete",
      synced: totalSynced,
      skipped,
      currentMemo: `Synced ${totalSynced} memos${skipped > 0 ? `, ${skipped} already existed` : ""}`,
    });

    return { synced: totalSynced, skipped };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    updateProgress({
      status: "error",
      error: errorMsg,
      currentMemo: `Error: ${errorMsg}`,
    });
    return { synced: 0, skipped: 0, error: errorMsg };
  }
}

// ==================== Transcription Functions ====================

/**
 * Check if a memo can be transcribed
 */
export async function checkTranscriptionEligibility(
  memoId: number
): Promise<TranscriptionEligibility> {
  if (!isTauri) {
    return {
      eligible: false,
      reason: "Not running in Tauri",
      file_size: null,
    };
  }
  return await invoke<TranscriptionEligibility>("check_transcription_eligibility", {
    memoId,
  });
}

/**
 * Transcribe a single voice memo
 */
export async function transcribeVoiceMemo(
  memoId: number,
  apiKey: string,
  onProgress?: (progress: TranscriptionProgress) => void
): Promise<TranscriptionResult> {
  if (!isTauri) {
    return {
      memo_id: memoId,
      transcription: "",
      language: null,
      success: false,
      error: "Not running in Tauri",
    };
  }

  if (!apiKey) {
    return {
      memo_id: memoId,
      transcription: "",
      language: null,
      success: false,
      error: "GROQ API key not configured. Please set GROQ_API_KEY in Convex environment.",
    };
  }

  let unlisten: UnlistenFn | null = null;

  try {
    // Set up event listener for progress updates
    unlisten = await listen<TranscriptionProgress>(
      "voicememos-transcription-progress",
      (event) => {
        if (event.payload.memo_id === memoId) {
          onProgress?.(event.payload);
        }
      }
    );

    return await invoke<TranscriptionResult>("transcribe_voicememo", { memoId, apiKey });
  } finally {
    if (unlisten) {
      unlisten();
    }
  }
}

/**
 * Batch transcribe multiple voice memos
 */
export async function transcribeVoiceMemosBatch(
  memoIds: number[],
  apiKey: string,
  onProgress?: (progress: TranscriptionProgress) => void
): Promise<TranscriptionResult[]> {
  if (!isTauri) {
    return memoIds.map((id) => ({
      memo_id: id,
      transcription: "",
      language: null,
      success: false,
      error: "Not running in Tauri",
    }));
  }

  if (!apiKey) {
    return memoIds.map((id) => ({
      memo_id: id,
      transcription: "",
      language: null,
      success: false,
      error: "GROQ API key not configured. Please set GROQ_API_KEY in Convex environment.",
    }));
  }

  let unlisten: UnlistenFn | null = null;

  try {
    // Set up event listener for progress updates
    unlisten = await listen<TranscriptionProgress>(
      "voicememos-transcription-progress",
      (event) => {
        onProgress?.(event.payload);
      }
    );

    return await invoke<TranscriptionResult[]>("transcribe_voicememos_batch", {
      memoIds,
      apiKey,
    });
  } finally {
    if (unlisten) {
      unlisten();
    }
  }
}

// ==================== Utility Functions ====================

/**
 * Format duration in seconds to human-readable string
 */
export function formatMemoDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  if (mins === 0) {
    return `${secs}s`;
  }

  if (mins < 60) {
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}:${remainingMins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format timestamp to human-readable date
 */
export function formatMemoDate(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Unknown date";
  }
}

/**
 * Format timestamp to human-readable date and time
 */
export function formatMemoDateTime(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "Unknown date";
  }
}

/**
 * Get display name for a memo
 */
export function getMemoDisplayName(memo: VoiceMemo): string {
  if (memo.custom_label) {
    return memo.custom_label;
  }
  // Generate a name from the date
  return `Recording - ${formatMemoDateTime(memo.date)}`;
}

/**
 * Format file size in bytes to human-readable string
 */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "Unknown";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if a file size exceeds the Groq limit (100 MB for paid accounts)
 */
export function exceedsGroqLimit(bytes: number | null): boolean {
  if (bytes === null) return false;
  return bytes > 100 * 1024 * 1024;
}

/**
 * Get the local audio file URL for playback
 */
export function getAudioFileUrl(memo: VoiceMemo): string | null {
  if (!memo.local_path) return null;
  // Tauri can serve local files using the asset protocol
  return `asset://localhost/${encodeURIComponent(memo.local_path)}`;
}
