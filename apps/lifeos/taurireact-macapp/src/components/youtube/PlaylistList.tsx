import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api, type Doc } from "@holaai/convex";

type SortOption = "title-asc" | "title-desc" | "videos-desc" | "videos-asc" | "synced-desc" | "synced-asc";

interface PlaylistListProps {
  onSelectPlaylist: (playlist: Doc<"life_youtubePlaylists">) => void;
  selectedPlaylistId?: string;
}

export function PlaylistList({
  onSelectPlaylist,
  selectedPlaylistId,
}: PlaylistListProps) {
  const [sortBy, setSortBy] = useState<SortOption>("synced-desc");
  const playlists = useQuery(api.lifeos.youtube.getPlaylists);

  const sortedPlaylists = useMemo(() => {
    if (!playlists) return [];

    return [...playlists].sort((a, b) => {
      switch (sortBy) {
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        case "videos-desc":
          return (b.videoCount ?? 0) - (a.videoCount ?? 0);
        case "videos-asc":
          return (a.videoCount ?? 0) - (b.videoCount ?? 0);
        case "synced-desc":
          return (b.lastSyncedAt ?? 0) - (a.lastSyncedAt ?? 0);
        case "synced-asc":
          return (a.lastSyncedAt ?? 0) - (b.lastSyncedAt ?? 0);
        default:
          return 0;
      }
    });
  }, [playlists, sortBy]);

  if (playlists === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="spinner" />
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-secondary)]">
        <p className="text-sm">No playlists synced yet.</p>
        <p className="text-xs mt-1">
          Connect YouTube and sync to see your playlists.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sort controls */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <span className="text-xs text-[var(--text-secondary)]">
          {playlists.length} playlists
        </span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="text-xs bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text-primary)]"
        >
          <option value="synced-desc">Recently Synced</option>
          <option value="synced-asc">Oldest Synced</option>
          <option value="title-asc">Title A-Z</option>
          <option value="title-desc">Title Z-A</option>
          <option value="videos-desc">Most Videos</option>
          <option value="videos-asc">Fewest Videos</option>
        </select>
      </div>

      {/* Scrollable playlist list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {sortedPlaylists.map((playlist) => (
        <button
          key={playlist._id}
          onClick={() => onSelectPlaylist(playlist)}
          className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
            selectedPlaylistId === playlist._id
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-secondary)] hover:bg-[var(--border)]"
          }`}
        >
          {playlist.thumbnailUrl ? (
            <img
              src={playlist.thumbnailUrl}
              alt=""
              className="w-16 h-12 object-cover rounded"
            />
          ) : (
            <div className="w-16 h-12 bg-[var(--border)] rounded flex items-center justify-center">
              <svg
                className="w-6 h-6 text-[var(--text-secondary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate text-sm">{playlist.title}</h3>
            <p
              className={`text-xs ${
                selectedPlaylistId === playlist._id
                  ? "text-white/70"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {playlist.videoCount ?? 0} videos
            </p>
          </div>
          <svg
            className={`w-5 h-5 flex-shrink-0 ${
              selectedPlaylistId === playlist._id
                ? "text-white"
                : "text-[var(--text-secondary)]"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
        ))}
      </div>
    </div>
  );
}
