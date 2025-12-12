import { useState } from "react";
import { useQuery, useConvex } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api, type Doc, type Id } from "@holaai/convex";
import { formatDuration } from "../../lib/services/youtube-api";
import {
  syncPlaylistVideos,
  fetchMultipleTranscripts,
  SyncProgress,
  initialProgress,
} from "../../lib/services/sync";

interface VideoListProps {
  playlistId: Id<"life_youtubePlaylists">;
  youtubePlaylistId: string;
  onSelectVideo: (video: Doc<"life_youtubeVideos">) => void;
  selectedVideoId?: Id<"life_youtubeVideos">;
}

export function VideoList({
  playlistId,
  youtubePlaylistId,
  onSelectVideo,
  selectedVideoId,
}: VideoListProps) {
  const videos = useQuery(api.lifeos.youtube.getVideos, { playlistId });
  const convex = useConvex();
  const { getToken } = useAuth();

  const [selectedVideos, setSelectedVideos] = useState<Set<Id<"life_youtubeVideos">>>(new Set());
  const [syncProgress, setSyncProgress] = useState<SyncProgress>(initialProgress);
  const [transcriptProgress, setTranscriptProgress] = useState<{
    status: "idle" | "fetching" | "complete" | "error";
    current: number;
    total: number;
    currentTitle: string;
    successful: number;
    failed: number;
    error?: string;
  }>({
    status: "idle",
    current: 0,
    total: 0,
    currentTitle: "",
    successful: 0,
    failed: 0,
  });

  const handleSyncVideos = async () => {
    const token = await getToken({ template: "oauth_google" });
    if (!token) {
      console.error("Could not get Google OAuth token");
      return;
    }
    await syncPlaylistVideos(convex, token, playlistId, youtubePlaylistId, setSyncProgress);
  };

  const toggleVideoSelection = (videoId: Id<"life_youtubeVideos">) => {
    setSelectedVideos((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  };

  const selectAllWithoutTranscript = () => {
    if (!videos) return;
    const videosWithoutTranscript = videos.filter((v) => !v.hasTranscript);
    setSelectedVideos(new Set(videosWithoutTranscript.map((v) => v._id)));
  };

  const clearSelection = () => {
    setSelectedVideos(new Set());
  };

  const handleFetchTranscripts = async () => {
    if (!videos || selectedVideos.size === 0) return;

    const videosToFetch = videos
      .filter((v) => selectedVideos.has(v._id) && !v.hasTranscript)
      .map((v) => ({
        videoId: v._id,
        youtubeVideoId: v.youtubeVideoId,
        playlistId: v.playlistId!,
        title: v.title,
        description: v.description,
        channelTitle: v.channelTitle,
        duration: v.duration,
        thumbnailUrl: v.thumbnailUrl,
        publishedAt: v.publishedAt,
      }));

    if (videosToFetch.length === 0) {
      setTranscriptProgress({
        status: "complete",
        current: 0,
        total: 0,
        currentTitle: "",
        successful: 0,
        failed: 0,
        error: "All selected videos already have transcripts",
      });
      return;
    }

    setTranscriptProgress({
      status: "fetching",
      current: 0,
      total: videosToFetch.length,
      currentTitle: "",
      successful: 0,
      failed: 0,
    });

    const result = await fetchMultipleTranscripts(
      convex,
      videosToFetch,
      (current, total, title) => {
        setTranscriptProgress((prev) => ({
          ...prev,
          current,
          total,
          currentTitle: title,
        }));
      }
    );

    setTranscriptProgress({
      status: "complete",
      current: videosToFetch.length,
      total: videosToFetch.length,
      currentTitle: "",
      successful: result.successful,
      failed: result.failed,
    });

    // Clear selection after fetching
    setSelectedVideos(new Set());
  };

  const isSyncing = syncProgress.status === "syncing";
  const isFetchingTranscripts = transcriptProgress.status === "fetching";

  // No videos synced yet - show sync button
  if (videos === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="spinner" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-[var(--text-secondary)]">
          <p className="text-sm">No videos synced for this playlist yet.</p>
          <p className="text-xs mt-1">Click below to fetch videos.</p>
        </div>
        <button
          onClick={handleSyncVideos}
          disabled={isSyncing}
          className="w-full px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isSyncing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="spinner spinner-sm" />
              {syncProgress.currentStep}
            </span>
          ) : (
            "Fetch Videos"
          )}
        </button>
      </div>
    );
  }

  const videosWithoutTranscript = videos.filter((v) => !v.hasTranscript).length;
  const selectedWithoutTranscript = videos.filter(
    (v) => selectedVideos.has(v._id) && !v.hasTranscript
  ).length;

  return (
    <div className="flex flex-col h-full">
      {/* Action bar */}
      <div className="flex-shrink-0 mb-3 space-y-2">
        {/* Sync videos button */}
        <button
          onClick={handleSyncVideos}
          disabled={isSyncing || isFetchingTranscripts}
          className="w-full px-3 py-2 border border-[var(--border)] hover:bg-[var(--bg-secondary)] rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {isSyncing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="spinner spinner-sm" />
              {syncProgress.currentStep}
            </span>
          ) : (
            "Refresh Videos"
          )}
        </button>

        {/* Selection actions */}
        {videosWithoutTranscript > 0 && (
          <div className="flex gap-2">
            <button
              onClick={selectAllWithoutTranscript}
              disabled={isFetchingTranscripts}
              className="flex-1 px-3 py-1.5 text-xs border border-[var(--border)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors disabled:opacity-50"
            >
              Select All ({videosWithoutTranscript})
            </button>
            {selectedVideos.size > 0 && (
              <button
                onClick={clearSelection}
                disabled={isFetchingTranscripts}
                className="px-3 py-1.5 text-xs border border-[var(--border)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Fetch transcripts button */}
        {selectedVideos.size > 0 && (
          <button
            onClick={handleFetchTranscripts}
            disabled={isFetchingTranscripts || selectedWithoutTranscript === 0}
            className="w-full px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isFetchingTranscripts ? (
              <span className="flex items-center justify-center gap-2">
                <div className="spinner spinner-sm" />
                Fetching {transcriptProgress.current}/{transcriptProgress.total}...
              </span>
            ) : (
              `Fetch Transcripts (${selectedWithoutTranscript})`
            )}
          </button>
        )}

        {/* Progress/status messages */}
        {transcriptProgress.status === "complete" && transcriptProgress.total > 0 && (
          <p className="text-xs text-center text-green-600">
            Done! {transcriptProgress.successful} fetched, {transcriptProgress.failed} failed
          </p>
        )}
        {transcriptProgress.error && (
          <p className="text-xs text-center text-[var(--text-secondary)]">
            {transcriptProgress.error}
          </p>
        )}
      </div>

      {/* Video list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {videos.map((video) => {
          const isSelected = selectedVideos.has(video._id);
          const isViewing = selectedVideoId === video._id;

          return (
            <div
              key={video._id}
              className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                isViewing
                  ? "bg-[var(--accent)] text-white"
                  : isSelected
                    ? "bg-blue-100 dark:bg-blue-900/30"
                    : "bg-[var(--bg-secondary)] hover:bg-[var(--border)]"
              }`}
            >
              {/* Checkbox for selection */}
              <button
                onClick={() => toggleVideoSelection(video._id)}
                disabled={isFetchingTranscripts}
                className={`flex-shrink-0 w-5 h-5 mt-1 rounded border-2 flex items-center justify-center transition-colors ${
                  isSelected
                    ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                    : "border-[var(--border)] hover:border-[var(--accent)]"
                } ${video.hasTranscript ? "opacity-30" : ""}`}
              >
                {isSelected && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>

              {/* Video content - clickable to view */}
              <button
                onClick={() => onSelectVideo(video)}
                className="flex-1 flex items-start gap-3 text-left"
              >
                <div className="relative flex-shrink-0">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="w-20 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-20 h-12 bg-[var(--border)] rounded flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-[var(--text-secondary)]"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  )}
                  {video.duration && (
                    <span className="absolute bottom-0.5 right-0.5 px-1 text-[10px] bg-black/80 text-white rounded">
                      {formatDuration(video.duration)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-xs line-clamp-2">{video.title}</h3>
                  <p
                    className={`text-[10px] mt-0.5 ${
                      isViewing ? "text-white/70" : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {video.channelTitle}
                  </p>
                  {video.hasTranscript && (
                    <span
                      className={`inline-flex items-center gap-0.5 mt-0.5 text-[10px] ${
                        isViewing ? "text-white/70" : "text-green-600"
                      }`}
                    >
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Transcript
                    </span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
