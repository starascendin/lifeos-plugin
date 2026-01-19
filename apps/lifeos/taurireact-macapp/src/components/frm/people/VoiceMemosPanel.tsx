import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import {
  Mic,
  Play,
  Users,
  Loader2,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MemoDetailDialog } from "./MemoDetailDialog";
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

export type ProcessingStage =
  | "recording"
  | "saving"
  | "transcribing"
  | "extracting"
  | "complete"
  | "error";

export interface ProcessingMemo {
  id: string;
  name: string;
  stage: ProcessingStage;
  duration: number; // in seconds
  error?: string;
  linkedPeople?: string[];
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
  labels?: string[];
  summary?: string;
}

interface VoiceMemosPanelProps {
  processingMemo: ProcessingMemo | null;
}

interface MemoCardProps {
  memo: MemoWithLinks;
  onClick: () => void;
}

function MemoCard({ memo, onClick }: MemoCardProps) {
  const timestamp = memo.clientCreatedAt || memo.createdAt;
  const hasLinkedPeople = memo.linkedPeople.length > 0;
  const hasTranscript = Boolean(memo.transcript);

  return (
    <button
      onClick={onClick}
      className="w-full text-left border rounded-lg p-3 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Play className="h-3.5 w-3.5 text-primary ml-0.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{memo.name}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground font-mono">
              {formatDuration(memo.duration)}
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(timestamp)}
            </span>
          </div>
        </div>
      </div>

      {/* Quick info badges */}
      <div className="flex items-center gap-2 mt-2">
        {hasLinkedPeople && (
          <span className="text-xs text-primary flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 rounded">
            <Users className="h-3 w-3" />
            {memo.linkedPeople.length}
          </span>
        )}
        {hasTranscript && (
          <span className="text-xs text-muted-foreground">
            {memo.transcript!.length > 50
              ? memo.transcript!.substring(0, 50) + "..."
              : memo.transcript}
          </span>
        )}
        {!hasTranscript && (
          <span className="text-xs text-muted-foreground italic">
            No transcript
          </span>
        )}
      </div>
    </button>
  );
}

function ProcessingMemoCard({ memo }: { memo: ProcessingMemo }) {
  const getStageDisplay = () => {
    switch (memo.stage) {
      case "recording":
        return {
          icon: <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />,
          text: "Recording...",
          color: "text-red-600 dark:text-red-400",
        };
      case "saving":
        return {
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
          text: "Saving...",
          color: "text-muted-foreground",
        };
      case "transcribing":
        return {
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
          text: "Transcribing...",
          color: "text-muted-foreground",
        };
      case "extracting":
        return {
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
          text: "Finding people...",
          color: "text-muted-foreground",
        };
      case "complete":
        return {
          icon: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
          text: memo.linkedPeople?.length
            ? `Linked ${memo.linkedPeople.length} ${memo.linkedPeople.length === 1 ? "person" : "people"}`
            : "Saved",
          color: "text-green-600 dark:text-green-400",
        };
      case "error":
        return {
          icon: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
          text: memo.error || "Error",
          color: "text-destructive",
        };
    }
  };

  const stage = getStageDisplay();

  return (
    <div className="border rounded-lg p-3 bg-muted/30 border-primary/20">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
          <Mic className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{memo.name}</span>
            {memo.stage === "recording" && (
              <span className="text-xs text-muted-foreground font-mono">
                {formatDuration(memo.duration * 1000)}
              </span>
            )}
          </div>
          <div className={cn("flex items-center gap-1.5 text-xs mt-0.5", stage.color)}>
            {stage.icon}
            <span>{stage.text}</span>
          </div>
        </div>
      </div>

      {/* Show linked people on complete */}
      {memo.stage === "complete" && memo.linkedPeople && memo.linkedPeople.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {memo.linkedPeople.map((name) => (
            <span
              key={name}
              className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded"
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function VoiceMemosPanel({ processingMemo }: VoiceMemosPanelProps) {
  const memos = useQuery(api.lifeos.frm_memos.getAllMemosWithLinks, {
    limit: 50,
  });

  const [selectedMemo, setSelectedMemo] = useState<MemoWithLinks | null>(null);

  const isLoading = memos === undefined;
  const isEmpty = !memos || memos.length === 0;

  return (
    <>
      <div className="flex flex-col h-full lg:border-l">
        {/* Header - hidden on mobile when in slide-over (parent provides it) */}
        <div className="hidden lg:block px-4 py-3 border-b">
          <h3 className="font-medium flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Voice Memos
          </h3>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {/* Processing memo at top */}
            {processingMemo && <ProcessingMemoCard memo={processingMemo} />}

            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Empty state */}
            {!isLoading && isEmpty && !processingMemo && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <Clock className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No voice memos yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click Record to create one
                </p>
              </div>
            )}

            {/* Memo list */}
            {!isLoading &&
              memos?.map((memo) => (
                <MemoCard
                  key={memo._id}
                  memo={memo}
                  onClick={() => setSelectedMemo(memo)}
                />
              ))}
          </div>
        </ScrollArea>
      </div>

      {/* Detail Modal */}
      <MemoDetailDialog
        memo={selectedMemo}
        open={selectedMemo !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedMemo(null);
        }}
      />
    </>
  );
}
