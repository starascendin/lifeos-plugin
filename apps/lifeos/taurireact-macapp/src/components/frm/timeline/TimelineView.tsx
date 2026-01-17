import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import {
  Clock,
  Play,
  Pause,
  Users,
  FileText,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Format duration as MM:SS
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// Format date for grouping
function formatDateGroup(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

interface LinkedPerson {
  personId: string;
  personName: string;
  context?: string;
}

interface MemoWithLinks {
  _id: string;
  name: string;
  transcript?: string;
  duration: number;
  audioUrl?: string;
  clientCreatedAt?: number;
  createdAt: number;
  linkedPeople: LinkedPerson[];
}

interface TimelineEntryProps {
  memo: MemoWithLinks;
  isPlaying: boolean;
  onPlayPause: () => void;
}

function TimelineEntry({ memo, isPlaying, onPlayPause }: TimelineEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const timestamp = memo.clientCreatedAt || memo.createdAt;
  const hasTranscript = Boolean(memo.transcript);
  const hasLinkedPeople = memo.linkedPeople.length > 0;

  return (
    <div className="rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3">
        {/* Play button */}
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={onPlayPause}
          disabled={!memo.audioUrl}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{memo.name}</span>
            <span className="text-xs text-muted-foreground font-mono">
              {formatDuration(memo.duration)}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(timestamp)}
            </span>
          </div>

          {/* Linked people badges */}
          {hasLinkedPeople && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {memo.linkedPeople.map((person) => (
                <span
                  key={person.personId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
                >
                  <Users className="h-3 w-3" />
                  {person.personName}
                </span>
              ))}
            </div>
          )}

          {/* Transcript preview/full */}
          {hasTranscript && (
            <div className="mt-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <FileText className="h-3 w-3" />
                Transcript
              </button>
              {isExpanded ? (
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {memo.transcript}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {memo.transcript}
                </p>
              )}
            </div>
          )}

          {/* No transcript indicator */}
          {!hasTranscript && (
            <p className="text-xs text-muted-foreground mt-2 italic">
              No transcript available
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function TimelineView() {
  const memos = useQuery(api.lifeos.frm_memos.getAllMemosWithLinks, {
    limit: 100,
  });

  const [playingMemoId, setPlayingMemoId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Handle audio playback
  const handlePlayPause = (memo: MemoWithLinks) => {
    if (!memo.audioUrl) return;

    if (playingMemoId === memo._id) {
      // Pause current
      audioRef.current?.pause();
      setPlayingMemoId(null);
    } else {
      // Play new
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(memo.audioUrl);
      audioRef.current = audio;
      audio.play();
      setPlayingMemoId(memo._id);

      audio.onended = () => {
        setPlayingMemoId(null);
      };
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  // Group memos by date
  const groupedMemos = memos?.reduce(
    (acc, memo) => {
      const timestamp = memo.clientCreatedAt || memo.createdAt;
      const dateKey = formatDateGroup(timestamp);
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(memo);
      return acc;
    },
    {} as Record<string, MemoWithLinks[]>
  );

  if (memos === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!memos || memos.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="rounded-full bg-muted p-4">
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-medium">No voice memos yet</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Record a voice memo to see it appear in your timeline. AI will
            automatically extract and link people mentioned.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        {Object.entries(groupedMemos || {}).map(([dateGroup, dateMemos]) => (
          <div key={dateGroup}>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 sticky top-0 bg-background/95 backdrop-blur py-1">
              {dateGroup}
            </h3>
            <div className="space-y-3">
              {dateMemos.map((memo) => (
                <TimelineEntry
                  key={memo._id}
                  memo={memo}
                  isPlaying={playingMemoId === memo._id}
                  onPlayPause={() => handlePlayPause(memo)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
