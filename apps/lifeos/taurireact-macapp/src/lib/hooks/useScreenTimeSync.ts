import { useState, useCallback, useEffect, useRef } from "react";
import { useConvex } from "convex/react";
import {
  syncScreenTimeData,
  ScreenTimeSyncProgress,
  initialSyncProgress,
  checkScreenTimePermission,
} from "../services/screentime";

interface UseScreenTimeSyncOptions {
  autoSync?: boolean;
  autoSyncIntervalMinutes?: number;
}

export function useScreenTimeSync(options: UseScreenTimeSyncOptions = {}) {
  const { autoSync = false, autoSyncIntervalMinutes = 30 } = options;

  const [progress, setProgress] = useState<ScreenTimeSyncProgress>(initialSyncProgress);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const convex = useConvex();
  const intervalRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);

  // Check permission on mount
  useEffect(() => {
    checkScreenTimePermission().then(setHasPermission);
  }, []);

  const startSync = useCallback(async () => {
    // Prevent concurrent syncs
    if (isSyncingRef.current) return;

    isSyncingRef.current = true;
    setProgress({ ...initialSyncProgress, status: "syncing" });

    try {
      await syncScreenTimeData(convex, setProgress);
    } finally {
      isSyncingRef.current = false;
    }
  }, [convex]);

  const reset = useCallback(() => {
    setProgress(initialSyncProgress);
  }, []);

  // Refresh permission check
  const refreshPermission = useCallback(async () => {
    const permission = await checkScreenTimePermission();
    setHasPermission(permission);
    return permission;
  }, []);

  // Auto-sync setup
  useEffect(() => {
    if (!autoSync || !hasPermission) return;

    // Run initial sync after a short delay
    const initialSyncTimeout = setTimeout(() => {
      startSync();
    }, 2000);

    // Set up interval for periodic sync
    intervalRef.current = window.setInterval(
      startSync,
      autoSyncIntervalMinutes * 60 * 1000
    );

    return () => {
      clearTimeout(initialSyncTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoSync, autoSyncIntervalMinutes, hasPermission, startSync]);

  return {
    progress,
    hasPermission,
    startSync,
    reset,
    refreshPermission,
    isSyncing: progress.status === "syncing" || progress.status === "checking",
  };
}
