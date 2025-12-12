import { fetch } from "@tauri-apps/plugin-http";

const BASE_URL = "https://www.googleapis.com/youtube/v3";

export interface YouTubePlaylist {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
  contentDetails: {
    itemCount: number;
  };
}

export interface YouTubeVideo {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
    publishedAt: string;
  };
  contentDetails: {
    duration: string;
  };
}

interface PlaylistsResponse {
  items: YouTubePlaylist[];
  nextPageToken?: string;
}

interface PlaylistItemsResponse {
  items: Array<{
    contentDetails: {
      videoId: string;
    };
  }>;
  nextPageToken?: string;
}

interface VideosResponse {
  items: YouTubeVideo[];
}

export async function fetchPlaylists(token: string): Promise<YouTubePlaylist[]> {
  if (!token) throw new Error("No access token provided");

  const playlists: YouTubePlaylist[] = [];
  let pageToken = "";

  do {
    const url = new URL(`${BASE_URL}/playlists`);
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("mine", "true");
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch playlists: ${errorText}`);
    }

    const data: PlaylistsResponse = await response.json();
    playlists.push(...data.items);
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return playlists;
}

export async function fetchPlaylistVideos(
  token: string,
  playlistId: string
): Promise<YouTubeVideo[]> {
  if (!token) throw new Error("No access token provided");

  const videoIds: string[] = [];
  let pageToken = "";

  // First get all video IDs from playlist items
  do {
    const url = new URL(`${BASE_URL}/playlistItems`);
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch playlist items: ${errorText}`);
    }

    const data: PlaylistItemsResponse = await response.json();
    videoIds.push(...data.items.map((item) => item.contentDetails.videoId));
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  // Then fetch video details in batches of 50
  const videos: YouTubeVideo[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = new URL(`${BASE_URL}/videos`);
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("id", batch.join(","));

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch video details: ${errorText}`);
    }

    const data: VideosResponse = await response.json();
    videos.push(...data.items);
  }

  return videos;
}

// Convert ISO 8601 duration (PT1H2M3S) to seconds
export function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");

  return hours * 3600 + minutes * 60 + seconds;
}

// Format seconds to human-readable duration
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
