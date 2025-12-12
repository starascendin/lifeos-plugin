import { useSession } from "@clerk/clerk-react";
import { useSyncProgress } from "../../lib/hooks/useSyncProgress";
import { useState, useEffect } from "react";

export function SyncButton() {
  const { session } = useSession();
  const { progress, startSync } = useSyncProgress();
  const [hasYouTubeAccess, setHasYouTubeAccess] = useState<boolean | null>(null);

  // Check if user has Google connected with YouTube scope
  useEffect(() => {
    if (session?.user?.externalAccounts) {
      const googleAccount = session.user.externalAccounts.find(
        (account) => account.provider === "google"
      );
      setHasYouTubeAccess(!!googleAccount);
    }
  }, [session]);

  const handleSync = async () => {
    console.log("[SyncButton] handleSync called");
    try {
      // Get the Google OAuth access token from the user's external account
      console.log("[SyncButton] Getting Google OAuth token from external account...");

      const googleAccount = session?.user?.externalAccounts?.find(
        (account) => account.provider === "google"
      );

      if (!googleAccount) {
        console.error("[SyncButton] No Google account connected");
        return;
      }

      // Get a fresh token from the external account
      const tokenResponse = await googleAccount.getToken();
      const token = tokenResponse?.token;

      console.log("[SyncButton] Token received:", token ? `${token.substring(0, 20)}...` : "null");
      if (token) {
        console.log("[SyncButton] Starting sync...");
        await startSync(token);
        console.log("[SyncButton] Sync completed");
      } else {
        console.error("[SyncButton] Could not get Google OAuth token from external account");
      }
    } catch (err) {
      console.error("[SyncButton] Failed to get token:", err);
    }
  };

  if (hasYouTubeAccess === null) {
    return (
      <div className="mb-4 p-4 bg-[var(--bg-secondary)] rounded-lg">
        <div className="flex items-center gap-2">
          <div className="spinner" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!hasYouTubeAccess) {
    return (
      <div className="mb-4 p-4 bg-[var(--bg-secondary)] rounded-lg">
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Sign out and sign back in with Google to enable YouTube sync.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 p-4 bg-[var(--bg-secondary)] rounded-lg">
      {progress.status === "syncing" ? (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="spinner" />
            <span className="text-sm font-medium">Syncing...</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-2">
            {progress.currentStep}
          </p>
          <div className="text-xs text-[var(--text-secondary)]">
            Playlists: {progress.completedPlaylists}/{progress.totalPlaylists} |
            Videos: {progress.completedVideos}/{progress.totalVideos} |
            Transcripts: {progress.transcriptsFetched}
          </div>
        </div>
      ) : progress.status === "complete" ? (
        <div>
          <p className="text-sm text-green-600 mb-2">Sync complete!</p>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Synced {progress.completedPlaylists} playlists,{" "}
            {progress.completedVideos} videos, {progress.transcriptsFetched}{" "}
            transcripts
          </p>
          <button
            onClick={handleSync}
            className="w-full px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors"
          >
            Sync Again
          </button>
        </div>
      ) : progress.status === "error" ? (
        <div>
          <p className="text-sm text-red-500 mb-2">
            Error: {progress.error}
          </p>
          <button
            onClick={handleSync}
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
              YouTube Connected
            </span>
          </div>
          <button
            onClick={handleSync}
            className="w-full px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors"
          >
            Sync Playlists
          </button>
        </div>
      )}
    </div>
  );
}
