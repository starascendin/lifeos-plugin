import { useState } from "react";
import type { Doc } from "@holaai/convex";
import { UserButton } from "./auth/UserButton";
import { SyncButton } from "./youtube/SyncButton";
import { PlaylistList } from "./youtube/PlaylistList";
import { VideoList } from "./youtube/VideoList";
import { TranscriptView } from "./youtube/TranscriptView";
import { ScreenTimeDashboard } from "./screentime/ScreenTimeDashboard";
import { NotesTab } from "./notes/NotesTab";
import { SettingsTab } from "./settings/SettingsTab";

type Tab = "youtube" | "screentime" | "notes" | "settings";

export function MainContent() {
  const [activeTab, setActiveTab] = useState<Tab>("youtube");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Doc<"life_youtubePlaylists"> | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Doc<"life_youtubeVideos"> | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  function handleSelectPlaylist(playlist: Doc<"life_youtubePlaylists">) {
    setSelectedPlaylist(playlist);
    setSelectedVideo(null);
    setShowTranscript(false);
  }

  function handleSelectVideo(video: Doc<"life_youtubeVideos">) {
    setSelectedVideo(video);
    if (video.hasTranscript) {
      setShowTranscript(true);
    }
  }

  function handleCloseTranscript() {
    setShowTranscript(false);
  }

  function handleBack() {
    if (showTranscript) {
      setShowTranscript(false);
    } else if (selectedVideo) {
      setSelectedVideo(null);
    } else if (selectedPlaylist) {
      setSelectedPlaylist(null);
    }
  }

  const getTitle = () => {
    if (activeTab === "settings") {
      return "Settings";
    }
    if (activeTab === "screentime") {
      return "Screen Time";
    }
    if (activeTab === "notes") {
      return "Notes";
    }
    if (showTranscript && selectedVideo) {
      return "Transcript";
    }
    if (selectedPlaylist) {
      return selectedPlaylist.title;
    }
    return "YouTube";
  };

  const showBackButton = activeTab === "youtube" && selectedPlaylist;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-3 border-b border-[var(--border)] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {showBackButton && (
            <button
              onClick={handleBack}
              aria-label="Go back"
              className="p-1.5 rounded hover:bg-[var(--bg-secondary)] transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 18l-6-6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <h1 className="font-semibold truncate">{getTitle()}</h1>
        </div>
        <UserButton />
      </header>

      {/* Tab bar */}
      <div className="flex border-b border-[var(--border)] flex-shrink-0">
        <button
          onClick={() => setActiveTab("youtube")}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
            activeTab === "youtube"
              ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          YouTube
        </button>
        <button
          onClick={() => setActiveTab("screentime")}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
            activeTab === "screentime"
              ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          Screen Time
        </button>
        <button
          onClick={() => setActiveTab("notes")}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
            activeTab === "notes"
              ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          Notes
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
            activeTab === "settings"
              ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          Settings
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-hidden p-3">
        {activeTab === "settings" ? (
          <SettingsTab />
        ) : activeTab === "notes" ? (
          <NotesTab />
        ) : activeTab === "screentime" ? (
          <ScreenTimeDashboard />
        ) : showTranscript && selectedVideo ? (
          <TranscriptView
            videoId={selectedVideo._id}
            onClose={handleCloseTranscript}
          />
        ) : selectedPlaylist ? (
          <VideoList
            playlistId={selectedPlaylist._id}
            youtubePlaylistId={selectedPlaylist.youtubePlaylistId}
            onSelectVideo={handleSelectVideo}
            selectedVideoId={selectedVideo?._id}
          />
        ) : (
          <div className="flex flex-col h-full">
            <SyncButton />
            <div className="flex-1 min-h-0">
              <PlaylistList
                onSelectPlaylist={handleSelectPlaylist}
                selectedPlaylistId={undefined}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
