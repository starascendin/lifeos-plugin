/**
 * useBeeperSync Hook
 *
 * React hook for syncing business-marked Beeper threads to Convex.
 */

import { useState, useCallback } from "react";
import { useConvex } from "convex/react";
import {
  syncAllBusinessDataToConvex,
  syncBusinessThreadsToConvex,
  syncThreadMessagesToConvex,
  type SyncProgress,
  initialSyncProgress,
} from "@/lib/services/beeper-sync";

export interface BeeperSyncHookResult {
  // State
  progress: SyncProgress;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;

  // Actions
  syncAll: () => Promise<void>;
  syncThreads: () => Promise<void>;
  syncThreadMessages: (threadId: string) => Promise<void>;
  reset: () => void;
}

export interface SyncResult {
  threadsInserted: number;
  threadsUpdated: number;
  messagesInserted: number;
  messagesUpdated: number;
  timestamp: number;
}

export function useBeeperSync(): BeeperSyncHookResult {
  const convex = useConvex();
  const [progress, setProgress] = useState<SyncProgress>(initialSyncProgress);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const reset = useCallback(() => {
    setProgress(initialSyncProgress);
    setIsSyncing(false);
  }, []);

  const syncAll = useCallback(async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setProgress(initialSyncProgress);

    try {
      const result = await syncAllBusinessDataToConvex(convex, setProgress);
      setLastSyncResult({
        ...result,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Sync failed:", error);
      // Progress will be set to error state by the service
    } finally {
      setIsSyncing(false);
    }
  }, [convex, isSyncing]);

  const syncThreads = useCallback(async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setProgress(initialSyncProgress);

    try {
      const result = await syncBusinessThreadsToConvex(convex, setProgress);
      setLastSyncResult({
        threadsInserted: result.insertedCount,
        threadsUpdated: result.updatedCount,
        messagesInserted: 0,
        messagesUpdated: 0,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Thread sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [convex, isSyncing]);

  const syncThreadMessages = useCallback(
    async (threadId: string) => {
      if (isSyncing) return;

      setIsSyncing(true);
      setProgress(initialSyncProgress);

      try {
        const result = await syncThreadMessagesToConvex(
          convex,
          threadId,
          setProgress
        );
        setLastSyncResult({
          threadsInserted: 0,
          threadsUpdated: 0,
          messagesInserted: result.insertedCount,
          messagesUpdated: result.updatedCount,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error("Message sync failed:", error);
      } finally {
        setIsSyncing(false);
      }
    },
    [convex, isSyncing]
  );

  return {
    progress,
    isSyncing,
    lastSyncResult,
    syncAll,
    syncThreads,
    syncThreadMessages,
    reset,
  };
}
