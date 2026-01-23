import { useState, useEffect, useCallback, useRef } from "react";
import {
  checkBeeperAvailable,
  checkBeeperDatabaseExists,
  syncBeeperDatabase,
  getBeeperThreads,
  getBeeperSyncInterval,
  saveBeeperSyncInterval,
  SYNC_INTERVAL_OPTIONS,
  type BeeperThread,
  type BeeperSyncProgress,
  initialSyncProgress,
} from "../../lib/services/beeper";

// Storage key for last sync timestamp
const LAST_SYNC_KEY = "beeper_last_sync_timestamp";

export function BeeperSyncTab() {
  // Availability state
  const [isBeeperAvailable, setIsBeeperAvailable] = useState<boolean | null>(
    null
  );
  const [hasDatabaseSynced, setHasDatabaseSynced] = useState<boolean | null>(
    null
  );

  // Sync state
  const [syncProgress, setSyncProgress] =
    useState<BeeperSyncProgress>(initialSyncProgress);

  // Last sync timestamp
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const stored = localStorage.getItem(LAST_SYNC_KEY);
    return stored ? new Date(stored) : null;
  });

  // Auto-sync enabled state
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  // Sync interval in minutes (configurable, default 3)
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState<number>(3);

  // Countdown to next sync
  const [nextSyncIn, setNextSyncIn] = useState<number | null>(null);

  // Threads preview
  const [threads, setThreads] = useState<BeeperThread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);

  // Timer refs
  const autoSyncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncTimeRef = useRef<Date | null>(lastSyncTime);

  // Keep ref in sync
  useEffect(() => {
    lastSyncTimeRef.current = lastSyncTime;
  }, [lastSyncTime]);

  // Load sync interval setting on mount
  useEffect(() => {
    getBeeperSyncInterval().then(setSyncIntervalMinutes);
  }, []);

  // Calculate interval in milliseconds
  const autoSyncInterval = syncIntervalMinutes * 60 * 1000;

  // Check availability on mount
  useEffect(() => {
    async function checkAvailability() {
      const available = await checkBeeperAvailable();
      setIsBeeperAvailable(available);

      if (available) {
        const dbExists = await checkBeeperDatabaseExists();
        setHasDatabaseSynced(dbExists);

        if (dbExists) {
          // Load threads preview
          await loadThreads();
        }
      }
    }
    checkAvailability();
  }, []);

  // Load threads
  const loadThreads = useCallback(async () => {
    setIsLoadingThreads(true);
    try {
      const threadList = await getBeeperThreads();
      setThreads(threadList);
    } catch (error) {
      console.error("Failed to load threads:", error);
    } finally {
      setIsLoadingThreads(false);
    }
  }, []);

  // Handle sync (can be called manually or by auto-sync)
  const handleSync = useCallback(async (isAutoSync = false) => {
    // Don't show checking status for auto-sync to be less intrusive
    if (!isAutoSync) {
      setSyncProgress({
        status: "checking",
        currentStep: "Checking Beeper availability...",
      });
    }

    const available = await checkBeeperAvailable();
    if (!available) {
      if (!isAutoSync) {
        setSyncProgress({
          status: "error",
          currentStep: "",
          error:
            "Beeper not found. Make sure BeeperTexts is installed at ~/Library/Application Support/BeeperTexts",
        });
      }
      return;
    }

    setSyncProgress({
      status: "syncing",
      currentStep: isAutoSync ? "Auto-syncing Beeper database..." : "Syncing Beeper database...",
    });

    const result = await syncBeeperDatabase();

    if (result.success) {
      const now = new Date();
      setLastSyncTime(now);
      localStorage.setItem(LAST_SYNC_KEY, now.toISOString());

      setSyncProgress({
        status: "complete",
        currentStep: result.message || "Sync complete!",
      });
      setHasDatabaseSynced(true);
      // Load threads after successful sync
      await loadThreads();
    } else {
      setSyncProgress({
        status: "error",
        currentStep: "",
        error: result.error || "Unknown error",
      });
    }
  }, [loadThreads]);

  // Calculate time until next sync
  const calculateNextSyncIn = useCallback(() => {
    if (!lastSyncTimeRef.current || !autoSyncEnabled) return null;
    const elapsed = Date.now() - lastSyncTimeRef.current.getTime();
    const remaining = autoSyncInterval - elapsed;
    return Math.max(0, Math.ceil(remaining / 1000));
  }, [autoSyncEnabled, autoSyncInterval]);

  // Auto-sync timer setup
  useEffect(() => {
    if (!autoSyncEnabled || !isBeeperAvailable) {
      // Clear timers when disabled
      if (autoSyncTimerRef.current) {
        clearInterval(autoSyncTimerRef.current);
        autoSyncTimerRef.current = null;
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setNextSyncIn(null);
      return;
    }

    // Auto-sync function
    const performAutoSync = async () => {
      const now = Date.now();
      const lastSync = lastSyncTimeRef.current?.getTime() || 0;

      // Only sync if enough time has passed
      if (now - lastSync >= autoSyncInterval) {
        await handleSync(true);
      }
    };

    // Run auto-sync check immediately if we haven't synced yet or enough time passed
    const timeSinceLastSync = lastSyncTimeRef.current
      ? Date.now() - lastSyncTimeRef.current.getTime()
      : Infinity;

    if (timeSinceLastSync >= autoSyncInterval) {
      performAutoSync();
    }

    // Set up auto-sync interval
    autoSyncTimerRef.current = setInterval(performAutoSync, autoSyncInterval);

    // Countdown timer - update every second
    countdownTimerRef.current = setInterval(() => {
      setNextSyncIn(calculateNextSyncIn());
    }, 1000);

    // Initial countdown
    setNextSyncIn(calculateNextSyncIn());

    return () => {
      if (autoSyncTimerRef.current) {
        clearInterval(autoSyncTimerRef.current);
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [autoSyncEnabled, isBeeperAvailable, handleSync, calculateNextSyncIn, autoSyncInterval]);

  // Format time ago
  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Format countdown
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffDays = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) {
        return date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
      } else if (diffDays === 1) {
        return "Yesterday";
      } else if (diffDays < 7) {
        return date.toLocaleDateString("en-US", { weekday: "short" });
      } else {
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }
    } catch {
      return timestamp;
    }
  };

  const isSyncing = syncProgress.status === "syncing" || syncProgress.status === "checking";

  return (
    <div className="space-y-4 overflow-y-auto h-full">
      {/* Sync Button Section */}
      <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Beeper (WhatsApp) Sync</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Sync your WhatsApp messages from Beeper Desktop
            </p>
          </div>
          <button
            onClick={() => handleSync(false)}
            disabled={isSyncing}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              isSyncing
                ? "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-not-allowed"
                : "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
            }`}
          >
            {isSyncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>

        {/* Auto-sync toggle and status */}
        <div className="flex items-center justify-between py-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border)] accent-[var(--accent)]"
              />
              <span className="text-sm">Auto-sync every</span>
            </label>
            <select
              value={syncIntervalMinutes}
              onChange={async (e) => {
                const newInterval = parseInt(e.target.value, 10);
                setSyncIntervalMinutes(newInterval);
                await saveBeeperSyncInterval(newInterval);
              }}
              disabled={!autoSyncEnabled}
              className="text-sm px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg-primary)] disabled:opacity-50"
            >
              {SYNC_INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
            {lastSyncTime && (
              <span title={lastSyncTime.toLocaleString()}>
                Last sync: {formatTimeAgo(lastSyncTime)}
              </span>
            )}
            {autoSyncEnabled && nextSyncIn !== null && nextSyncIn > 0 && !isSyncing && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Next: {formatCountdown(nextSyncIn)}
              </span>
            )}
          </div>
        </div>

        {/* Progress/Status */}
        {syncProgress.status !== "idle" && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            {syncProgress.status === "checking" ||
            syncProgress.status === "syncing" ? (
              <div className="flex items-center gap-2 text-sm">
                <div className="spinner" />
                <span>{syncProgress.currentStep}</span>
              </div>
            ) : syncProgress.status === "complete" ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>{syncProgress.currentStep}</span>
              </div>
            ) : syncProgress.status === "error" ? (
              <div className="text-sm text-red-500">
                <span className="font-medium">Error:</span> {syncProgress.error}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Availability Status */}
      {isBeeperAvailable === false && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-500">
                Beeper Desktop Not Found
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Install Beeper Desktop and sign in to sync your WhatsApp
                messages.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Database Status */}
      {isBeeperAvailable && hasDatabaseSynced === false && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-500">
                Database Not Synced
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Click "Sync Now" to import your WhatsApp messages from Beeper.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Threads Preview */}
      {threads.length > 0 && (
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
          <h3 className="font-semibold mb-3">
            Recent Threads ({threads.length})
          </h3>
          <div className="space-y-2">
            {threads.slice(0, 10).map((thread) => (
              <div
                key={thread.name}
                className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                      thread.thread_type === "group"
                        ? "bg-green-500/20 text-green-500"
                        : "bg-blue-500/20 text-blue-500"
                    }`}
                  >
                    {thread.thread_type === "group" ? (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{thread.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {thread.message_count.toLocaleString()} messages
                      {thread.thread_type === "group" &&
                        ` · ${thread.participant_count} members`}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-[var(--text-secondary)] flex-shrink-0 ml-2">
                  {formatTimestamp(thread.last_message_at)}
                </span>
              </div>
            ))}
          </div>
          {threads.length > 10 && (
            <p className="text-sm text-[var(--text-secondary)] mt-3 text-center">
              +{threads.length - 10} more threads
            </p>
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoadingThreads && (
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
          <div className="flex items-center gap-2">
            <div className="spinner" />
            <span className="text-sm">Loading threads...</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {isBeeperAvailable &&
        hasDatabaseSynced &&
        threads.length === 0 &&
        !isLoadingThreads && (
          <div className="p-4 bg-[var(--bg-secondary)] rounded-lg text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              No threads found. Try syncing again.
            </p>
          </div>
        )}
    </div>
  );
}
