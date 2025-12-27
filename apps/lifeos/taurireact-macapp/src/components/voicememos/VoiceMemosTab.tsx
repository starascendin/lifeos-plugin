import { useState, useEffect, useCallback, useRef } from "react";
import {
  type VoiceMemo,
  type VoiceMemosSyncProgress,
  type TranscriptionProgress,
  initialSyncProgress,
  syncVoiceMemos,
  getVoiceMemos,
  transcribeVoiceMemosBatch,
  getMemoDisplayName,
  formatMemoDuration,
  formatMemoDate,
  formatFileSize,
  exceedsGroqLimit,
} from "../../lib/services/voicememos";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Loader2,
  Mic,
  Play,
  Pause,
  FileText,
  AlertTriangle,
  Clock,
  HardDrive,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { readFile } from "@tauri-apps/plugin-fs";

type ViewFilter = "all" | "transcribed" | "not_transcribed";

export function VoiceMemosTab() {
  const [memos, setMemos] = useState<VoiceMemo[]>([]);
  const [syncProgress, setSyncProgress] = useState<VoiceMemosSyncProgress>(initialSyncProgress);
  const [transcriptionProgress, setTranscriptionProgress] = useState<TranscriptionProgress | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Load memos on mount
  const loadMemos = useCallback(async () => {
    setIsLoading(true);
    try {
      const loadedMemos = await getVoiceMemos();
      setMemos(loadedMemos);
    } catch (error) {
      console.error("Failed to load voice memos:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMemos();
  }, [loadMemos]);

  // Handle sync
  const handleSync = async () => {
    setSyncProgress({ ...initialSyncProgress, status: "syncing" });
    await syncVoiceMemos(setSyncProgress);
    await loadMemos();
  };

  // Handle transcription
  const handleTranscribe = async () => {
    if (selectedIds.size === 0) return;

    setIsTranscribing(true);
    setTranscriptionProgress(null);

    try {
      const memoIds = Array.from(selectedIds);
      await transcribeVoiceMemosBatch(memoIds, setTranscriptionProgress);
      await loadMemos();
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Transcription error:", error);
    } finally {
      setIsTranscribing(false);
      setTranscriptionProgress(null);
    }
  };

  // Toggle selection
  const toggleSelection = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Select all eligible for transcription
  const selectAllEligible = () => {
    const eligible = filteredMemos
      .filter((m) => !m.transcription && m.local_path && !exceedsGroqLimit(m.file_size))
      .map((m) => m.id);
    setSelectedIds(new Set(eligible));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Filter memos
  const filteredMemos = memos.filter((memo) => {
    if (viewFilter === "transcribed") return memo.transcription;
    if (viewFilter === "not_transcribed") return !memo.transcription;
    return true;
  });

  const isSyncing = syncProgress.status === "syncing";

  // Calculate counts
  const transcribedCount = memos.filter((m) => m.transcription).length;
  const notTranscribedCount = memos.filter((m) => !m.transcription).length;

  // Calculate progress percentage
  const getSyncProgressPercentage = () => {
    if (syncProgress.total === 0) return 0;
    return Math.round((syncProgress.current / syncProgress.total) * 100);
  };

  return (
    <div className="space-y-4 overflow-y-auto h-full">
      {/* Sync Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Voice Memos</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    <div className="space-y-2">
                      <p>
                        <strong>How it works:</strong> Syncs voice memos from macOS Voice Memos app
                        and allows transcription using AI.
                      </p>
                      <p>
                        <strong>Storage:</strong> Audio files are copied locally to app data
                        directory. Metadata stored in local SQLite database. No cloud sync.
                      </p>
                      <p>
                        <strong>Transcription:</strong> Uses Groq&apos;s{" "}
                        <code className="bg-muted px-1 rounded">whisper-large-v3-turbo</code> model.
                        Max file size: 25 MB.
                      </p>
                      <p>
                        <strong>API Key:</strong> Reads{" "}
                        <code className="bg-muted px-1 rounded">GROQ_API_KEY</code> from{" "}
                        <code className="bg-muted px-1 rounded">.env</code> file in the app
                        directory.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge variant="secondary">{memos.length} synced</Badge>
            </div>

            <Button onClick={handleSync} disabled={isSyncing} size="sm">
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync from Mac
                </>
              )}
            </Button>
          </div>

          {/* Progress indicator */}
          {syncProgress.status !== "idle" && (
            <div className="mt-3 pt-3 border-t">
              {syncProgress.status === "syncing" && syncProgress.total > 0 && (
                <div className="mb-2 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {syncProgress.current} / {syncProgress.total}
                    </span>
                    <span>{getSyncProgressPercentage()}%</span>
                  </div>
                  <Progress value={getSyncProgressPercentage()} className="h-2" />
                </div>
              )}
              <p className="text-sm truncate">{syncProgress.currentMemo}</p>
              {syncProgress.status === "complete" && (
                <div className="flex items-center gap-2 text-green-600 mt-1">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs">
                    {syncProgress.exported} new, {syncProgress.skipped} existing
                  </span>
                </div>
              )}
              {syncProgress.status === "error" && (
                <div className="flex items-center gap-2 text-destructive mt-1">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs">Error: {syncProgress.error}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcription Controls */}
      {memos.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} selected for transcription`
                    : "Select memos to transcribe"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Clear
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllEligible}
                  disabled={isTranscribing}
                >
                  Select All Untranscribed
                </Button>
                <Button
                  onClick={handleTranscribe}
                  disabled={selectedIds.size === 0 || isTranscribing}
                  size="sm"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Transcribing...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Transcribe ({selectedIds.size})
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Transcription progress */}
            {transcriptionProgress && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>
                    {transcriptionProgress.current} / {transcriptionProgress.total}
                  </span>
                  <span>{transcriptionProgress.memo_name}</span>
                </div>
                <Progress
                  value={
                    transcriptionProgress.total > 0
                      ? (transcriptionProgress.current / transcriptionProgress.total) * 100
                      : 0
                  }
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-1 capitalize">
                  {transcriptionProgress.status}...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filter tabs */}
      {memos.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Badge
            variant={viewFilter === "all" ? "default" : "outline"}
            className="cursor-pointer flex-shrink-0"
            onClick={() => setViewFilter("all")}
          >
            All ({memos.length})
          </Badge>
          <Badge
            variant={viewFilter === "transcribed" ? "default" : "outline"}
            className="cursor-pointer flex-shrink-0"
            onClick={() => setViewFilter("transcribed")}
          >
            Transcribed ({transcribedCount})
          </Badge>
          <Badge
            variant={viewFilter === "not_transcribed" ? "default" : "outline"}
            className="cursor-pointer flex-shrink-0"
            onClick={() => setViewFilter("not_transcribed")}
          >
            Not Transcribed ({notTranscribedCount})
          </Badge>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading voice memos...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No memos state */}
      {!isLoading && memos.length === 0 && (
        <Alert>
          <Mic className="h-4 w-4" />
          <AlertDescription>
            No voice memos synced yet. Click "Sync from Mac" to import your Voice Memos.
          </AlertDescription>
        </Alert>
      )}

      {/* Memos list */}
      {!isLoading && filteredMemos.length > 0 && (
        <div className="space-y-2">
          {filteredMemos.map((memo) => (
            <VoiceMemoCard
              key={memo.id}
              memo={memo}
              isSelected={selectedIds.has(memo.id)}
              onToggleSelect={() => toggleSelection(memo.id)}
              isTranscribing={isTranscribing}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface VoiceMemoCardProps {
  memo: VoiceMemo;
  isSelected: boolean;
  onToggleSelect: () => void;
  isTranscribing: boolean;
}

function VoiceMemoCard({ memo, isSelected, onToggleSelect, isTranscribing }: VoiceMemoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const displayName = getMemoDisplayName(memo);
  const canTranscribe = memo.local_path && !memo.transcription && !exceedsGroqLimit(memo.file_size);
  const isTooLarge = exceedsGroqLimit(memo.file_size);

  // Load audio file and create blob URL
  const loadAudio = async () => {
    if (!memo.local_path || audioSrc || isLoadingAudio) return;

    setIsLoadingAudio(true);
    try {
      const data = await readFile(memo.local_path);
      const blob = new Blob([data], { type: "audio/m4a" });
      const url = URL.createObjectURL(blob);
      setAudioSrc(url);
    } catch (error) {
      console.error("Failed to load audio:", error);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (audioSrc) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [audioSrc]);

  const togglePlay = async () => {
    // Load audio on first play
    if (!audioSrc) {
      await loadAudio();
      // Audio will auto-play once loaded via useEffect
      return;
    }

    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  // Auto-play when audio source is first loaded
  useEffect(() => {
    if (audioSrc && audioRef.current && !isPlaying) {
      audioRef.current.play().catch(console.error);
    }
  }, [audioSrc]);

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  return (
    <Card className={`transition-colors ${isSelected ? "ring-2 ring-primary" : ""}`}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          {canTranscribe && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              disabled={isTranscribing}
              className="mt-1"
            />
          )}

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <h4 className="font-medium text-sm truncate flex-1">{displayName}</h4>
              <div className="flex items-center gap-2 flex-shrink-0">
                {memo.transcription && (
                  <Badge variant="secondary" className="text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Transcribed
                  </Badge>
                )}
                {isTooLarge && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Too Large
                  </Badge>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatMemoDuration(memo.duration)}
              </span>
              <span>{formatMemoDate(memo.date)}</span>
              {memo.file_size && (
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  {formatFileSize(memo.file_size)}
                </span>
              )}
            </div>

            {/* Audio player */}
            {memo.local_path && (
              <div className="mt-2 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePlay}
                  className="h-8 w-8 p-0"
                  disabled={isLoadingAudio}
                >
                  {isLoadingAudio ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                {audioSrc && (
                  <audio
                    ref={audioRef}
                    src={audioSrc}
                    onEnded={handleAudioEnded}
                    onPause={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                    className="hidden"
                  />
                )}
                <span className="text-xs text-muted-foreground">
                  {isLoadingAudio ? "Loading..." : isPlaying ? "Playing..." : "Click to play"}
                </span>
              </div>
            )}

            {/* Transcription */}
            {memo.transcription && (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="h-6 px-2 text-xs"
                >
                  {showTranscript ? "Hide" : "Show"} Transcript
                  {memo.transcription_language && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {memo.transcription_language}
                    </Badge>
                  )}
                </Button>
                {showTranscript && (
                  <div className="mt-2 p-2 bg-muted rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{memo.transcription}</p>
                  </div>
                )}
              </div>
            )}

            {/* Too large warning */}
            {isTooLarge && (
              <p className="mt-2 text-xs text-destructive">
                This file exceeds the 25 MB limit for transcription. Consider trimming it in the
                Voice Memos app.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
