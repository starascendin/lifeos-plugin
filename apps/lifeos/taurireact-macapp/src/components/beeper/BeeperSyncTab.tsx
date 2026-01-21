import { useState, useEffect, useCallback } from "react";
import {
  checkBeeperAvailable,
  checkBeeperDatabaseExists,
  syncBeeperDatabase,
  getBeeperThreads,
  type BeeperThread,
  type BeeperSyncProgress,
  initialSyncProgress,
} from "../../lib/services/beeper";

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

  // Threads preview
  const [threads, setThreads] = useState<BeeperThread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);

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

  // Handle sync
  const handleSync = async () => {
    setSyncProgress({
      status: "checking",
      currentStep: "Checking Beeper availability...",
    });

    const available = await checkBeeperAvailable();
    if (!available) {
      setSyncProgress({
        status: "error",
        currentStep: "",
        error:
          "Beeper not found. Make sure BeeperTexts is installed at ~/Library/Application Support/BeeperTexts",
      });
      return;
    }

    setSyncProgress({
      status: "syncing",
      currentStep: "Syncing Beeper database...",
    });

    const result = await syncBeeperDatabase();

    if (result.success) {
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
            onClick={handleSync}
            disabled={
              syncProgress.status === "syncing" ||
              syncProgress.status === "checking"
            }
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              syncProgress.status === "syncing" ||
              syncProgress.status === "checking"
                ? "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-not-allowed"
                : "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
            }`}
          >
            {syncProgress.status === "syncing" ||
            syncProgress.status === "checking"
              ? "Syncing..."
              : "Sync Now"}
          </button>
        </div>

        {/* Progress/Status */}
        {syncProgress.status !== "idle" && (
          <div className="mt-3">
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
