import { useState, useCallback } from "react";
import { useConvex } from "convex/react";
import { syncPlaylistsOnly, SyncProgress, initialProgress } from "../services/sync";

export function useSyncProgress() {
  const [progress, setProgress] = useState<SyncProgress>(initialProgress);
  const convex = useConvex();

  const startSync = useCallback(async (googleToken: string) => {
    if (!googleToken) {
      setProgress({
        ...initialProgress,
        status: "error",
        error: "No Google token available",
      });
      return;
    }
    setProgress({ ...initialProgress, status: "syncing" });
    await syncPlaylistsOnly(convex, googleToken, setProgress);
  }, [convex]);

  const reset = useCallback(() => {
    setProgress(initialProgress);
  }, []);

  return { progress, startSync, reset };
}
