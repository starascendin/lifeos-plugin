import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { useConvex } from "convex/react";
import { useAction } from "convex/react";
import { api } from "@holaai/convex";
import { syncPlaylistsOnly, SyncProgress, initialProgress } from "../services/sync";
import {
  syncScreenTimeData,
  ScreenTimeSyncProgress,
  initialSyncProgress,
  checkScreenTimePermission,
  syncScreenTimeToLocalDb,
} from "../services/screentime";

// YouTube Sync State
interface YouTubeSyncState {
  progress: SyncProgress;
  startSync: () => Promise<void>;
  reset: () => void;
}

// Screen Time Sync State
interface ScreenTimeSyncState {
  progress: ScreenTimeSyncProgress;
  hasPermission: boolean | null;
  startSync: () => Promise<void>;
  reset: () => void;
  refreshPermission: () => Promise<boolean>;
  isSyncing: boolean;
}

interface SyncContextValue {
  youtube: YouTubeSyncState;
  screenTime: ScreenTimeSyncState;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const getGoogleToken = useAction(api.lifeos.youtube.getGoogleOAuthToken);

  // YouTube sync state
  const [ytProgress, setYtProgress] = useState<SyncProgress>(initialProgress);

  // Screen time sync state
  const [stProgress, setStProgress] = useState<ScreenTimeSyncProgress>(initialSyncProgress);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const isSyncingRef = useRef(false);

  // Check screen time permission on mount
  useEffect(() => {
    checkScreenTimePermission().then(setHasPermission);
  }, []);

  // YouTube sync functions
  const startYouTubeSync = useCallback(async () => {
    if (ytProgress.status === "syncing") return;

    try {
      setYtProgress({ ...initialProgress, status: "syncing" });
      const { token } = await getGoogleToken();
      if (token) {
        await syncPlaylistsOnly(convex, token, setYtProgress);
      } else {
        setYtProgress({
          ...initialProgress,
          status: "error",
          error: "Could not get Google token",
        });
      }
    } catch (err) {
      console.error("[SyncContext] YouTube sync error:", err);
      setYtProgress({
        ...initialProgress,
        status: "error",
        error: err instanceof Error ? err.message : "Sync failed",
      });
    }
  }, [convex, getGoogleToken, ytProgress.status]);

  const resetYouTubeSync = useCallback(() => {
    setYtProgress(initialProgress);
  }, []);

  // Screen time sync functions
  const startScreenTimeSync = useCallback(async () => {
    if (isSyncingRef.current) return;

    isSyncingRef.current = true;
    setStProgress({ ...initialSyncProgress, status: "syncing", currentStep: "Syncing local database..." });

    try {
      // First, sync to our local database (parse SEGB files + knowledgeC.db)
      const localResult = await syncScreenTimeToLocalDb();
      console.log("[SyncContext] Local sync result:", localResult);

      setStProgress({
        ...initialSyncProgress,
        status: "syncing",
        currentStep: `Synced ${localResult.knowledge_sessions + localResult.biome_sessions} sessions locally. Uploading to Convex...`,
      });

      // Then sync to Convex
      await syncScreenTimeData(convex, setStProgress);
    } catch (error) {
      console.error("[SyncContext] Screen time sync error:", error);
      setStProgress({
        ...initialSyncProgress,
        status: "error",
        error: error instanceof Error ? error.message : "Sync failed",
      });
    } finally {
      isSyncingRef.current = false;
    }
  }, [convex]);

  const resetScreenTimeSync = useCallback(() => {
    setStProgress(initialSyncProgress);
  }, []);

  const refreshPermission = useCallback(async () => {
    const permission = await checkScreenTimePermission();
    setHasPermission(permission);
    return permission;
  }, []);

  const value: SyncContextValue = {
    youtube: {
      progress: ytProgress,
      startSync: startYouTubeSync,
      reset: resetYouTubeSync,
    },
    screenTime: {
      progress: stProgress,
      hasPermission,
      startSync: startScreenTimeSync,
      reset: resetScreenTimeSync,
      refreshPermission,
      isSyncing: stProgress.status === "syncing" || stProgress.status === "checking",
    },
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncContext() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSyncContext must be used within a SyncProvider");
  }
  return context;
}

// Convenience hooks
export function useYouTubeSync() {
  return useSyncContext().youtube;
}

export function useScreenTimeSync() {
  return useSyncContext().screenTime;
}
