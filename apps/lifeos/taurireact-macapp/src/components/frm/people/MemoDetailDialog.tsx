import { useState, useRef, useEffect } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@holaai/convex";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  Pause,
  Users,
  FileText,
  Clock,
  Calendar,
  Tag,
  RefreshCw,
  Loader2,
  Sparkles,
  History,
  CheckCircle,
  XCircle,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Id } from "@holaai/convex";

// Format duration as MM:SS
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Format full date and time
function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Format relative time for history
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

interface MemoDetailDialogProps {
  memo: MemoWithLinks | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemoDetailDialog({ memo, open, onOpenChange }: MemoDetailDialogProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const extractPeopleFromMemo = useAction(api.lifeos.frm_extraction.extractPeopleFromMemo);

  // Fetch extraction history
  const extractionHistory = useQuery(
    api.lifeos.frm_memos.getMemoExtractionHistory,
    memo?._id ? { voiceMemoId: memo._id as Id<"life_voiceMemos"> } : "skip"
  );

  // Reset state when dialog opens/closes or memo changes
  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setCurrentTime(0);
      setIsRegenerating(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    }
  }, [open, memo?._id]);

  if (!memo) return null;

  const timestamp = memo.clientCreatedAt || memo.createdAt;
  const hasTranscript = Boolean(memo.transcript);
  const hasLinkedPeople = memo.linkedPeople.length > 0;
  const hasLabels = memo.labels && memo.labels.length > 0;
  const hasSummary = Boolean(memo.summary);
  const hasHistory = extractionHistory && extractionHistory.length > 0;

  const handleRegenerate = async () => {
    if (!memo._id || isRegenerating) return;
    setIsRegenerating(true);
    try {
      await extractPeopleFromMemo({
        voiceMemoId: memo._id as Id<"life_voiceMemos">,
        regenerate: true,
      });
    } catch (error) {
      console.error("Regeneration failed:", error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handlePlayPause = () => {
    if (!memo.audioUrl) return;

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (!audioRef.current) {
        const audio = new Audio(memo.audioUrl);
        audioRef.current = audio;

        audio.ontimeupdate = () => {
          setCurrentTime(audio.currentTime * 1000);
        };

        audio.onended = () => {
          setIsPlaying(false);
          setCurrentTime(0);
        };
      }

      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !memo.audioUrl) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = (percentage * memo.duration) / 1000;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime * 1000);
  };

  const progress = memo.duration > 0 ? (currentTime / memo.duration) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            {memo.name}
          </DialogTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={isRegenerating || !hasTranscript}
            className="gap-2"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Regenerate AI
              </>
            )}
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-6">
          {/* Left Column - Memo Content */}
          <div className="flex-1 min-w-0 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4">
                {/* Audio Player */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 shrink-0"
                      onClick={handlePlayPause}
                      disabled={!memo.audioUrl}
                    >
                      {isPlaying ? (
                        <Pause className="h-5 w-5" />
                      ) : (
                        <Play className="h-5 w-5 ml-0.5" />
                      )}
                    </Button>

                    <div className="flex-1 space-y-2">
                      <div
                        className="h-2 bg-muted rounded-full cursor-pointer overflow-hidden"
                        onClick={handleSeek}
                      >
                        <div
                          className="h-full bg-primary transition-all duration-100"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground font-mono">
                        <span>{formatDuration(currentTime)}</span>
                        <span>{formatDuration(memo.duration)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {formatDateTime(timestamp)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {formatDuration(memo.duration)}
                  </div>
                </div>

                {/* Transcript */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Transcript
                  </h4>
                  {hasTranscript ? (
                    <div className="rounded-lg border bg-muted/30 p-4 max-h-[300px] overflow-y-auto">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {memo.transcript}
                      </p>
                    </div>
                  ) : (
                    <div className="h-24 rounded-lg border bg-muted/30 flex items-center justify-center">
                      <p className="text-sm text-muted-foreground italic">
                        No transcript available
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Right Column - AI Extraction Results */}
          <div className="w-[380px] shrink-0 flex flex-col border-l pl-6">
            <Tabs defaultValue="current" className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="current" className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Current
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="current" className="flex-1 mt-4">
                <ScrollArea className="h-[calc(70vh-200px)]">
                  <div className="space-y-5 pr-4">
                    {/* Summary */}
                    {hasSummary && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-amber-500" />
                          AI Summary
                        </h4>
                        <div className="rounded-lg border bg-amber-500/5 border-amber-500/20 p-3">
                          <p className="text-sm">
                            {memo.summary}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Labels */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Tag className="h-4 w-4 text-blue-500" />
                        Labels
                      </h4>
                      {hasLabels ? (
                        <div className="flex flex-wrap gap-2">
                          {memo.labels!.map((label) => (
                            <span
                              key={label}
                              className="px-2.5 py-1 bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 rounded-md text-sm"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No labels extracted
                        </p>
                      )}
                    </div>

                    {/* Linked People */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-green-500" />
                        Linked People
                      </h4>
                      {hasLinkedPeople ? (
                        <div className="space-y-2">
                          {memo.linkedPeople.map((person) => (
                            <div
                              key={person.personId}
                              className="flex items-center gap-3 p-2.5 bg-green-500/5 border border-green-500/20 rounded-lg"
                            >
                              <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {person.personName}
                                </p>
                                {person.context && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {person.context}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No people linked
                        </p>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="history" className="flex-1 mt-4">
                <ScrollArea className="h-[calc(70vh-200px)]">
                  <div className="space-y-3 pr-4">
                    {!hasHistory ? (
                      <p className="text-sm text-muted-foreground italic text-center py-8">
                        No extraction history yet
                      </p>
                    ) : (
                      extractionHistory?.map((entry) => (
                        <div
                          key={entry._id}
                          className={cn(
                            "rounded-lg border p-3 space-y-2",
                            entry.isLatest
                              ? "border-primary/30 bg-primary/5"
                              : "border-border bg-muted/30"
                          )}
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted">
                                v{entry.version}
                              </span>
                              {entry.isLatest && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/20 text-primary">
                                  Current
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeTime(entry.extractedAt)}
                            </span>
                          </div>

                          {/* Summary */}
                          {entry.summary && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {entry.summary}
                            </p>
                          )}

                          {/* Labels */}
                          {entry.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {entry.labels.map((label) => (
                                <span
                                  key={label}
                                  className="px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs rounded"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Extracted People */}
                          {entry.extractedPeople.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">
                                People ({entry.extractedPeople.length})
                              </p>
                              <div className="space-y-1">
                                {entry.extractedPeople.map((person, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 text-xs"
                                  >
                                    {person.matched ? (
                                      <CheckCircle className="h-3 w-3 text-green-500" />
                                    ) : person.personId ? (
                                      <CheckCircle className="h-3 w-3 text-blue-500" />
                                    ) : (
                                      <XCircle className="h-3 w-3 text-muted-foreground" />
                                    )}
                                    <span className="truncate">
                                      {person.name}
                                      {person.context && (
                                        <span className="text-muted-foreground">
                                          {" "}({person.context})
                                        </span>
                                      )}
                                    </span>
                                    <span
                                      className={cn(
                                        "ml-auto text-[10px] px-1 rounded",
                                        person.confidence === "high"
                                          ? "bg-green-500/20 text-green-600"
                                          : person.confidence === "medium"
                                          ? "bg-amber-500/20 text-amber-600"
                                          : "bg-muted text-muted-foreground"
                                      )}
                                    >
                                      {person.confidence}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Model */}
                          <p className="text-[10px] text-muted-foreground pt-1 border-t">
                            Model: {entry.model.split("/").pop()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
