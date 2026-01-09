import { useState, useCallback } from "react";
import { useQuery, useConvex } from "convex/react";
import { api } from "@holaai/convex";
import { toast } from "sonner";
import {
  type TranscriptionProgress,
  type TranscriptionResult,
  transcribeVoiceMemo,
  transcribeVoiceMemosBatch,
  syncTranscriptsToConvex,
  initialConvexSyncProgress,
} from "../services/voicememos";
import {
  transcribeAudio,
  getExtensionFromMimeType,
} from "../services/transcriptionService";
import { usePlatform } from "./usePlatform";

export interface UseVoiceMemoTranscriptionOptions {
  /** Callback for progress updates during transcription */
  onProgress?: (progress: TranscriptionProgress) => void;
  /** Callback when transcription completes */
  onComplete?: () => void;
  /** Auto-sync transcripts to Convex after transcription (default: false) */
  autoSyncToConvex?: boolean;
  /** Show toast notifications for errors (default: true) */
  showErrorToasts?: boolean;
}

export interface UseVoiceMemoTranscriptionReturn {
  // State
  /** Whether transcription is in progress */
  isTranscribing: boolean;
  /** Current transcription progress */
  progress: TranscriptionProgress | null;
  /** List of failed transcription results */
  errors: TranscriptionResult[];
  /** Clear stored errors */
  clearErrors: () => void;

  // Actions - Tauri (exported macOS Voice Memos)
  /** Transcribe a single exported voice memo by ID (Tauri only) */
  transcribeSingle: (memoId: number) => Promise<TranscriptionResult>;
  /** Transcribe multiple exported voice memos by IDs (Tauri only) */
  transcribeBatch: (memoIds: number[]) => Promise<TranscriptionResult[]>;

  // Actions - Browser (recorded in browser)
  /** Transcribe an audio blob using browser-based GROQ API call */
  transcribeBrowserAudio: (
    blob: Blob,
    mimeType: string
  ) => Promise<{ text: string; language?: string }>;

  // API key status
  /** Whether GROQ API key is configured in Convex */
  hasApiKey: boolean;
  /** Whether API key is still loading from Convex */
  isApiKeyLoading: boolean;
  /** The API key value (for browser transcription) */
  apiKey: string | null;
}

/**
 * Unified hook for voice memo transcription.
 * Handles:
 * - API key fetching from Convex
 * - Single memo transcription (Tauri via Rust backend)
 * - Batch transcription (Tauri via Rust backend)
 * - Browser-based transcription (via GROQ API)
 * - Progress tracking
 * - Error handling with toast notifications
 * - Optional auto-sync to Convex after transcription
 */
export function useVoiceMemoTranscription(
  options: UseVoiceMemoTranscriptionOptions = {}
): UseVoiceMemoTranscriptionReturn {
  const {
    onProgress,
    onComplete,
    autoSyncToConvex = false,
    showErrorToasts = true,
  } = options;

  const { isTauri } = usePlatform();
  const convex = useConvex();

  // Query GROQ API key from Convex
  const groqApiKey = useQuery(api.lifeos.voicememo.getGroqApiKey, {});
  const isApiKeyLoading = groqApiKey === undefined;
  const hasApiKey = Boolean(groqApiKey);

  // State
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState<TranscriptionProgress | null>(null);
  const [errors, setErrors] = useState<TranscriptionResult[]>([]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Handle progress updates
  const handleProgress = useCallback(
    (p: TranscriptionProgress) => {
      setProgress(p);
      onProgress?.(p);
    },
    [onProgress]
  );

  // Show error toast
  const showErrorToast = useCallback(
    (title: string, description: string) => {
      if (showErrorToasts) {
        toast.error(title, {
          description,
          duration: 10000,
        });
      }
    },
    [showErrorToasts]
  );

  // Auto-sync to Convex
  const performAutoSync = useCallback(async () => {
    if (!autoSyncToConvex || !isTauri) return;

    // Small delay to ensure local DB is updated
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      await syncTranscriptsToConvex(convex, () => {
        // Progress callback - could expose this if needed
      });
    } catch (error) {
      console.error("Auto-sync to Convex failed:", error);
    }
  }, [autoSyncToConvex, isTauri, convex]);

  // Transcribe a single exported voice memo (Tauri)
  const transcribeSingle = useCallback(
    async (memoId: number): Promise<TranscriptionResult> => {
      if (!isTauri) {
        return {
          memo_id: memoId,
          transcription: "",
          language: null,
          success: false,
          error: "Not running in Tauri",
        };
      }

      if (!groqApiKey) {
        const error = "GROQ API Key not configured. Please set GROQ_API_KEY in Convex environment.";
        showErrorToast("GROQ API Key Not Configured", error);
        return {
          memo_id: memoId,
          transcription: "",
          language: null,
          success: false,
          error,
        };
      }

      setIsTranscribing(true);
      setProgress(null);
      setErrors([]);

      try {
        const result = await transcribeVoiceMemo(memoId, groqApiKey, handleProgress);

        if (!result.success && result.error) {
          setErrors([result]);
          showErrorToast("Transcription Failed", result.error);
        } else if (result.success) {
          await performAutoSync();
        }

        onComplete?.();
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const result: TranscriptionResult = {
          memo_id: memoId,
          transcription: "",
          language: null,
          success: false,
          error: errorMessage,
        };
        setErrors([result]);
        showErrorToast("Transcription Failed", errorMessage);
        return result;
      } finally {
        setIsTranscribing(false);
        setProgress(null);
      }
    },
    [isTauri, groqApiKey, handleProgress, showErrorToast, performAutoSync, onComplete]
  );

  // Transcribe multiple exported voice memos (Tauri)
  const transcribeBatch = useCallback(
    async (memoIds: number[]): Promise<TranscriptionResult[]> => {
      if (!isTauri) {
        return memoIds.map((id) => ({
          memo_id: id,
          transcription: "",
          language: null,
          success: false,
          error: "Not running in Tauri",
        }));
      }

      if (!groqApiKey) {
        const error = "GROQ API Key not configured. Please set GROQ_API_KEY in Convex environment.";
        showErrorToast("GROQ API Key Not Configured", error);
        return memoIds.map((id) => ({
          memo_id: id,
          transcription: "",
          language: null,
          success: false,
          error,
        }));
      }

      if (memoIds.length === 0) {
        return [];
      }

      setIsTranscribing(true);
      setProgress(null);
      setErrors([]);

      try {
        const results = await transcribeVoiceMemosBatch(memoIds, groqApiKey, handleProgress);

        // Capture any failed transcriptions
        const failed = results.filter((r) => !r.success && r.error);
        if (failed.length > 0) {
          setErrors(failed);

          // Show toast for failures
          if (failed.length === 1) {
            showErrorToast("Transcription Failed", failed[0].error || "Unknown error");
          } else {
            showErrorToast(
              `${failed.length} Transcriptions Failed`,
              failed[0].error || "Unknown error"
            );
          }
        }

        // Auto-sync if any succeeded
        const successful = results.filter((r) => r.success);
        if (successful.length > 0) {
          await performAutoSync();
        }

        onComplete?.();
        return results;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const result: TranscriptionResult = {
          memo_id: 0,
          transcription: "",
          language: null,
          success: false,
          error: errorMessage,
        };
        setErrors([result]);
        showErrorToast("Transcription Failed", errorMessage);
        return memoIds.map((id) => ({ ...result, memo_id: id }));
      } finally {
        setIsTranscribing(false);
        setProgress(null);
      }
    },
    [isTauri, groqApiKey, handleProgress, showErrorToast, performAutoSync, onComplete]
  );

  // Transcribe audio blob (browser)
  const transcribeBrowserAudio = useCallback(
    async (
      blob: Blob,
      mimeType: string
    ): Promise<{ text: string; language?: string }> => {
      if (!groqApiKey) {
        const error = "GROQ API Key not configured. Please set GROQ_API_KEY in Convex environment.";
        showErrorToast("GROQ API Key Not Configured", error);
        throw new Error(error);
      }

      setIsTranscribing(true);

      try {
        const filename = `audio.${getExtensionFromMimeType(mimeType)}`;
        const result = await transcribeAudio(blob, groqApiKey, filename);
        onComplete?.();
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        showErrorToast("Transcription Failed", errorMessage);
        throw error;
      } finally {
        setIsTranscribing(false);
      }
    },
    [groqApiKey, showErrorToast, onComplete]
  );

  return {
    // State
    isTranscribing,
    progress,
    errors,
    clearErrors,

    // Actions
    transcribeSingle,
    transcribeBatch,
    transcribeBrowserAudio,

    // API key status
    hasApiKey,
    isApiKeyLoading,
    apiKey: groqApiKey ?? null,
  };
}
