import { fetchPlaylists, fetchPlaylistVideos, parseDuration } from "./youtube-api";
import { fetchTranscript } from "./transcript";
import { api } from "@holaai/convex";
import type { ConvexReactClient } from "convex/react";
import type { Id } from "@holaai/convex";

export interface SyncProgress {
  status: "idle" | "syncing" | "error" | "complete";
  currentStep: string;
  totalPlaylists: number;
  completedPlaylists: number;
  totalVideos: number;
  completedVideos: number;
  transcriptsFetched: number;
  error?: string;
}

export const initialProgress: SyncProgress = {
  status: "idle",
  currentStep: "",
  totalPlaylists: 0,
  completedPlaylists: 0,
  totalVideos: 0,
  completedVideos: 0,
  transcriptsFetched: 0,
};

/**
 * Sync playlists only (not videos or transcripts)
 */
export async function syncPlaylistsOnly(
  client: ConvexReactClient,
  googleToken: string,
  onProgress: (progress: SyncProgress) => void
): Promise<void> {
  console.log("[syncPlaylistsOnly] Starting...");
  let progress = { ...initialProgress };

  const updateProgress = (updates: Partial<SyncProgress>) => {
    progress = { ...progress, ...updates };
    console.log("[syncPlaylistsOnly] Progress update:", progress);
    onProgress(progress);
  };

  try {
    updateProgress({ status: "syncing", currentStep: "Fetching playlists..." });

    console.log("[syncPlaylistsOnly] Calling fetchPlaylists with token:", googleToken.substring(0, 20) + "...");
    const playlists = await fetchPlaylists(googleToken);
    console.log("[syncPlaylistsOnly] Fetched playlists:", playlists.length);
    updateProgress({
      totalPlaylists: playlists.length,
      currentStep: `Found ${playlists.length} playlists`,
    });

    for (const playlist of playlists) {
      updateProgress({
        currentStep: `Syncing: ${playlist.snippet.title}`,
      });

      await client.mutation(api.lifeos.youtube.upsertPlaylist, {
        youtubePlaylistId: playlist.id,
        title: playlist.snippet.title,
        description: playlist.snippet.description || undefined,
        channelTitle: playlist.snippet.channelTitle || undefined,
        videoCount: playlist.contentDetails.itemCount,
        thumbnailUrl:
          playlist.snippet.thumbnails.medium?.url ||
          playlist.snippet.thumbnails.default?.url ||
          undefined,
      });

      updateProgress({
        completedPlaylists: progress.completedPlaylists + 1,
      });
    }

    updateProgress({
      status: "complete",
      currentStep: `Synced ${playlists.length} playlists`,
    });
  } catch (error) {
    console.error("[syncPlaylistsOnly] Playlist sync error:", error);
    updateProgress({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Sync videos for a specific playlist
 */
export async function syncPlaylistVideos(
  client: ConvexReactClient,
  googleToken: string,
  playlistId: Id<"life_youtubePlaylists">,
  youtubePlaylistId: string,
  onProgress: (progress: SyncProgress) => void
): Promise<void> {
  let progress = { ...initialProgress };

  const updateProgress = (updates: Partial<SyncProgress>) => {
    progress = { ...progress, ...updates };
    onProgress(progress);
  };

  try {
    updateProgress({ status: "syncing", currentStep: "Fetching videos..." });

    const videos = await fetchPlaylistVideos(googleToken, youtubePlaylistId);
    updateProgress({
      totalVideos: videos.length,
      currentStep: `Found ${videos.length} videos`,
    });

    for (const video of videos) {
      updateProgress({
        currentStep: `Syncing: ${video.snippet.title.slice(0, 40)}...`,
      });

      // Check if we already have a transcript for this video
      let hasTranscript = false;
      try {
        const existingTranscript = await client.query(
          api.lifeos.youtube.getTranscriptByYoutubeId,
          { youtubeVideoId: video.id }
        );
        hasTranscript = !!existingTranscript;
      } catch {
        // Transcript doesn't exist
      }

      await client.mutation(api.lifeos.youtube.upsertVideo, {
        playlistId,
        youtubeVideoId: video.id,
        title: video.snippet.title,
        description: video.snippet.description || undefined,
        channelTitle: video.snippet.channelTitle || undefined,
        duration: parseDuration(video.contentDetails.duration),
        thumbnailUrl:
          video.snippet.thumbnails.medium?.url ||
          video.snippet.thumbnails.default?.url ||
          undefined,
        publishedAt: video.snippet.publishedAt,
        hasTranscript,
      });

      updateProgress({
        completedVideos: progress.completedVideos + 1,
      });

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    updateProgress({
      status: "complete",
      currentStep: `Synced ${videos.length} videos`,
    });
  } catch (error) {
    console.error("Video sync error:", error);
    updateProgress({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Fetch transcript for a single video
 */
export async function fetchVideoTranscript(
  client: ConvexReactClient,
  videoId: Id<"life_youtubeVideos">,
  youtubeVideoId: string,
  playlistId: Id<"life_youtubePlaylists">,
  videoData: {
    title: string;
    description?: string;
    channelTitle?: string;
    duration?: number;
    thumbnailUrl?: string;
    publishedAt?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const transcript = await fetchTranscript(youtubeVideoId);

    if (transcript) {
      await client.mutation(api.lifeos.youtube.upsertTranscript, {
        videoId,
        youtubeVideoId,
        language: transcript.language,
        isAutoGenerated: transcript.isAutoGenerated,
        transcript: transcript.transcript,
        segments: transcript.segments,
      });

      // Update video to reflect that it has a transcript
      await client.mutation(api.lifeos.youtube.upsertVideo, {
        playlistId,
        youtubeVideoId,
        title: videoData.title,
        description: videoData.description,
        channelTitle: videoData.channelTitle,
        duration: videoData.duration,
        thumbnailUrl: videoData.thumbnailUrl,
        publishedAt: videoData.publishedAt,
        hasTranscript: true,
      });

      return { success: true };
    } else {
      return { success: false, error: "No transcript available" };
    }
  } catch (error) {
    console.error(`Failed to fetch transcript for video ${youtubeVideoId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetch transcripts for multiple videos
 */
export async function fetchMultipleTranscripts(
  client: ConvexReactClient,
  videos: Array<{
    videoId: Id<"life_youtubeVideos">;
    youtubeVideoId: string;
    playlistId: Id<"life_youtubePlaylists">;
    title: string;
    description?: string;
    channelTitle?: string;
    duration?: number;
    thumbnailUrl?: string;
    publishedAt?: string;
  }>,
  onProgress: (current: number, total: number, videoTitle: string) => void
): Promise<{ successful: number; failed: number }> {
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    onProgress(i + 1, videos.length, video.title);

    const result = await fetchVideoTranscript(
      client,
      video.videoId,
      video.youtubeVideoId,
      video.playlistId,
      {
        title: video.title,
        description: video.description,
        channelTitle: video.channelTitle,
        duration: video.duration,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt,
      }
    );

    if (result.success) {
      successful++;
    } else {
      failed++;
    }

    // Delay between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return { successful, failed };
}

// Keep the old function for backwards compatibility but mark as deprecated
/** @deprecated Use syncPlaylistsOnly, syncPlaylistVideos, or fetchVideoTranscript instead */
export async function syncYouTubeData(
  client: ConvexReactClient,
  googleToken: string,
  onProgress: (progress: SyncProgress) => void
): Promise<void> {
  // Just sync playlists for now
  await syncPlaylistsOnly(client, googleToken, onProgress);
}
