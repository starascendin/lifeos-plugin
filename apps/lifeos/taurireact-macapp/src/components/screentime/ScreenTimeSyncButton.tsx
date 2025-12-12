import { useScreenTimeSync } from "../../lib/hooks/useScreenTimeSync";

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

interface ScreenTimeSyncButtonProps {
  autoSync?: boolean;
  autoSyncIntervalMinutes?: number;
}

export function ScreenTimeSyncButton({
  autoSync = false,
  autoSyncIntervalMinutes = 30,
}: ScreenTimeSyncButtonProps) {
  const { progress, hasPermission, startSync, isSyncing, refreshPermission } =
    useScreenTimeSync({
      autoSync,
      autoSyncIntervalMinutes,
    });

  const openSystemPreferences = async () => {
    if (!isTauri) return;
    // Open System Settings to Full Disk Access
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"
    );
  };

  if (hasPermission === null) {
    return (
      <div className="mb-4 p-4 bg-[var(--bg-secondary)] rounded-lg">
        <div className="flex items-center gap-2">
          <div className="spinner" />
          <span className="text-sm">Checking permissions...</span>
        </div>
      </div>
    );
  }

  if (!hasPermission || !progress.hasPermission) {
    return (
      <div className="mb-4 p-4 bg-[var(--bg-secondary)] rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <svg
            className="w-5 h-5 text-yellow-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium">Full Disk Access Required</span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mb-3">
          Screen Time data requires Full Disk Access permission to read.
        </p>
        <div className="flex gap-2">
          <button
            onClick={openSystemPreferences}
            className="flex-1 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors"
          >
            Open System Settings
          </button>
          <button
            onClick={refreshPermission}
            className="px-4 py-2 border border-[var(--border)] hover:bg-[var(--bg-secondary)] rounded-lg text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 p-4 bg-[var(--bg-secondary)] rounded-lg">
      {isSyncing ? (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="spinner" />
            <span className="text-sm font-medium">
              {progress.status === "checking" ? "Checking..." : "Syncing..."}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-2">
            {progress.currentStep}
          </p>
          {progress.totalSessions > 0 && (
            <div className="text-xs text-[var(--text-secondary)]">
              Sessions: {progress.syncedSessions}/{progress.totalSessions}
            </div>
          )}
        </div>
      ) : progress.status === "complete" ? (
        <div>
          <p className="text-sm text-green-600 mb-2">Sync complete!</p>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            {progress.currentStep}
          </p>
          <button
            onClick={startSync}
            className="w-full px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors"
          >
            Sync Again
          </button>
        </div>
      ) : progress.status === "error" ? (
        <div>
          <p className="text-sm text-red-500 mb-2">Error: {progress.error}</p>
          <button
            onClick={startSync}
            className="w-full px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors"
          >
            Retry Sync
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-green-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Screen Time Access Granted
            </span>
          </div>
          <button
            onClick={startSync}
            className="w-full px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors"
          >
            Sync Screen Time Data
          </button>
          {autoSync && (
            <p className="text-xs text-[var(--text-secondary)] mt-2 text-center">
              Auto-sync every {autoSyncIntervalMinutes} minutes
            </p>
          )}
        </div>
      )}
    </div>
  );
}
