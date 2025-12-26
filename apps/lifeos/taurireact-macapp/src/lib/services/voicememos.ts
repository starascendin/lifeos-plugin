import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

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
  status: "uploading" | "transcribing" | "complete" | "error";
  current: number;
  total: number;
  error: string | null;
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

    return await invoke<TranscriptionResult>("transcribe_voicememo", { memoId });
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
 * Check if a file size exceeds the Groq limit (25 MB)
 */
export function exceedsGroqLimit(bytes: number | null): boolean {
  if (bytes === null) return false;
  return bytes > 25 * 1024 * 1024;
}

/**
 * Get the local audio file URL for playback
 */
export function getAudioFileUrl(memo: VoiceMemo): string | null {
  if (!memo.local_path) return null;
  // Tauri can serve local files using the asset protocol
  return `asset://localhost/${encodeURIComponent(memo.local_path)}`;
}
