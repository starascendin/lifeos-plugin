import { useState, useCallback } from "react";
import { useConvex } from "convex/react";
import {
  type ConvexSyncProgress,
  initialConvexSyncProgress,
  syncTranscriptsToConvex,
} from "../services/voicememos";
import { usePlatform } from "./usePlatform";

export interface UseConvexSyncReturn {
  /** Current sync progress */
  syncProgress: ConvexSyncProgress;
  /** Whether sync is currently in progress */
  isSyncing: boolean;
  /** Sync transcribed voice memos to Convex cloud */
  syncTranscripts: () => Promise<{ synced: number; skipped: number; error?: string }>;
  /** Reset sync progress to idle state */
  resetProgress: () => void;
}

/**
 * Hook for syncing transcribed voice memos to Convex cloud.
 * Only syncs transcript text and metadata, NOT audio files.
 */
export function useConvexSync(): UseConvexSyncReturn {
  const { isTauri } = usePlatform();
  const convex = useConvex();
  const [syncProgress, setSyncProgress] = useState<ConvexSyncProgress>(initialConvexSyncProgress);

  const isSyncing =
    syncProgress.status === "syncing" ||
    syncProgress.status === "preparing";

  const syncTranscripts = useCallback(async () => {
    if (!isTauri) {
      return { synced: 0, skipped: 0, error: "Cloud sync is only available in the Tauri app" };
    }

    setSyncProgress({ ...initialConvexSyncProgress, status: "preparing" });

    const result = await syncTranscriptsToConvex(convex, setSyncProgress);

    return result;
  }, [convex, isTauri]);

  const resetProgress = useCallback(() => {
    setSyncProgress(initialConvexSyncProgress);
  }, []);

  return {
    syncProgress,
    isSyncing,
    syncTranscripts,
    resetProgress,
  };
}
