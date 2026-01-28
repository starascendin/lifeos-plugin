import { useState, useRef, useEffect } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { useFRM } from "@/lib/contexts/FRMContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Search,
  Users,
  Mic,
  Plus,
  Square,
  Loader2,
  ChevronRight,
  ChevronDown,
  X,
  MessageSquare,
} from "lucide-react";
import type { Id } from "@holaai/convex";
import { AddPersonDialog } from "./AddPersonDialog";
import { VoiceMemosPanel, type ProcessingMemo, type ProcessingStage } from "./VoiceMemosPanel";
import { BeeperContactsPanel } from "./BeeperContactsPanel";
import { cn } from "@/lib/utils";

// Detect if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

// Format duration as MM:SS
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Format relative time
function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return "";
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / 86400000);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(timestamp).toLocaleDateString();
}

interface PeopleListProps {
  onPersonSelect: (personId: Id<"lifeos_frmPeople">) => void;
}

export function PeopleList({ onPersonSelect }: PeopleListProps) {
  const {
    people,
    isLoadingPeople,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
  } = useFRM();

  const [showAddPersonDialog, setShowAddPersonDialog] = useState(false);
  const [showMobileMemosPanel, setShowMobileMemosPanel] = useState(false);
  const [memosOpen, setMemosOpen] = useState(false);

  // Fetch memo count for collapsible badge
  const memos = useQuery(api.lifeos.frm_memos.getAllMemosWithLinks, { limit: 50 });
  const memoCount = memos?.length ?? 0;

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [processingMemo, setProcessingMemo] = useState<ProcessingMemo | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingFormatRef = useRef<{ mimeType: string; extension: string }>({
    mimeType: "",
    extension: "webm",
  });

  // Convex mutations/actions
  const generateUploadUrl = useMutation(api.lifeos.voicememo.generateUploadUrl);
  const createMemo = useMutation(api.lifeos.voicememo.createMemo);
  const transcribeMemo = useAction(api.lifeos.voicememo.transcribeMemo);
  const extractPeopleFromMemo = useAction(api.lifeos.frm_extraction.extractPeopleFromMemo);

  // Use search results if searching, otherwise use all people
  const displayPeople = searchQuery.trim() ? searchResults : people;
  const isLoading = searchQuery.trim() ? isSearching : isLoadingPeople;

  // Auto-dismiss complete state after 3 seconds
  useEffect(() => {
    if (processingMemo?.stage === "complete" || processingMemo?.stage === "error") {
      const timeout = setTimeout(() => {
        setProcessingMemo(null);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [processingMemo?.stage]);

  // Update processing memo duration while recording
  useEffect(() => {
    if (isRecording && processingMemo) {
      setProcessingMemo((prev) =>
        prev ? { ...prev, duration } : null
      );
    }
  }, [duration, isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Get supported MIME type for recording
  const getSupportedMimeType = (): { mimeType: string; extension: string } => {
    const types: Array<{ mime: string; ext: string }> = [
      { mime: "audio/webm;codecs=opus", ext: "webm" },
      { mime: "audio/ogg;codecs=opus", ext: "ogg" },
      { mime: "audio/webm", ext: "webm" },
      { mime: "audio/mp4", ext: "m4a" },
    ];
    for (const { mime, ext } of types) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return { mimeType: mime, extension: ext };
      }
    }
    return { mimeType: "", extension: "webm" };
  };

  // Start recording
  const startRecording = async () => {
    try {
      // Check/request macOS microphone permission in Tauri
      if (isTauri) {
        try {
          const { checkMicrophonePermission, requestMicrophonePermission } =
            await import("tauri-plugin-macos-permissions-api");

          const hasPermission = await checkMicrophonePermission();
          if (!hasPermission) {
            const granted = await requestMicrophonePermission();
            if (!granted) {
              setProcessingMemo({
                id: `error_${Date.now()}`,
                name: "Recording",
                stage: "error",
                duration: 0,
                error: "Microphone access denied",
              });
              return;
            }
          }
        } catch (pluginError) {
          console.warn("Could not check macOS permissions:", pluginError);
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const format = getSupportedMimeType();
      recordingFormatRef.current = format;

      const options: MediaRecorderOptions = {
        ...(format.mimeType ? { mimeType: format.mimeType } : {}),
        audioBitsPerSecond: 48000,
      };

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      const now = Date.now();
      const memoName = `Voice Note ${new Date(now).toLocaleTimeString()}`;

      mediaRecorder.start(100);
      setIsRecording(true);
      setDuration(0);
      setProcessingMemo({
        id: `recording_${now}`,
        name: memoName,
        stage: "recording",
        duration: 0,
      });

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Recording error:", err);
      setProcessingMemo({
        id: `error_${Date.now()}`,
        name: "Recording",
        stage: "error",
        duration: 0,
        error: "Failed to access microphone",
      });
    }
  };

  // Stop recording and process
  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;

    const recordedDuration = duration;
    const mimeType = mediaRecorderRef.current.mimeType || recordingFormatRef.current.mimeType;

    return new Promise<{ blob: Blob; duration: number; mimeType: string } | null>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || "audio/webm",
        });
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
        resolve({
          blob: audioBlob,
          duration: recordedDuration,
          mimeType: mimeType || "audio/webm",
        });
      };

      mediaRecorder.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });
  };

  // Update processing stage
  const updateStage = (stage: ProcessingStage, extras?: Partial<ProcessingMemo>) => {
    setProcessingMemo((prev) =>
      prev ? { ...prev, stage, ...extras } : null
    );
  };

  // Handle the full recording flow
  const handleStopAndProcess = async () => {
    updateStage("saving");

    try {
      const result = await stopRecording();
      if (!result || result.duration === 0) {
        updateStage("error", { error: "Recording too short" });
        return;
      }

      const { blob, duration: recordedDuration, mimeType } = result;
      const now = Date.now();

      // 1. Upload audio to Convex storage
      const uploadUrl = await generateUploadUrl();
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": mimeType },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const { storageId } = await uploadResponse.json();
      if (!storageId) {
        throw new Error("No storageId returned from upload");
      }

      // 2. Create memo record
      const memoId = await createMemo({
        localId: `frm_voice_${now}`,
        name: processingMemo?.name || `Voice Note ${new Date(now).toLocaleTimeString()}`,
        storageId,
        duration: recordedDuration * 1000,
        clientCreatedAt: now,
        clientUpdatedAt: now,
      });

      // 3. Transcribe the memo
      updateStage("transcribing");
      const transcribeResult = await transcribeMemo({ memoId });

      if (!transcribeResult.success) {
        console.warn("Transcription failed:", transcribeResult.error);
      }

      // 4. Extract people from the memo
      updateStage("extracting");
      const extractResult = await extractPeopleFromMemo({ voiceMemoId: memoId });

      if (extractResult.success) {
        updateStage("complete", { linkedPeople: extractResult.linkedPeople || [] });
      } else {
        console.warn("Extraction failed:", extractResult.error);
        updateStage("complete", { linkedPeople: [] });
      }
    } catch (err) {
      console.error("Processing error:", err);
      updateStage("error", { error: err instanceof Error ? err.message : "Processing failed" });
    }
  };

  // Handle record button click
  const handleRecordClick = async () => {
    if (isRecording) {
      await handleStopAndProcess();
    } else {
      setDuration(0);
      await startRecording();
    }
  };

  // Cancel recording
  const handleCancel = () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    setIsRecording(false);
    setProcessingMemo(null);
  };

  return (
    <div className="flex h-full">
      {/* Left Panel - People List */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with Search and Record */}
        <div className="border-b border-border px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Recording UI */}
            {isRecording ? (
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md">
                  <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs font-mono tabular-nums text-red-600 dark:text-red-400">
                    {formatDuration(duration)}
                  </span>
                </div>
                <Button
                  onClick={handleRecordClick}
                  variant="destructive"
                  size="sm"
                  className="h-8 gap-1"
                >
                  <Square className="h-3 w-3" />
                  <span className="hidden sm:inline">Stop</span>
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <Button onClick={handleRecordClick} size="sm" className="h-8 gap-1.5">
                  <Mic className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Record</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddPersonDialog(true)}
                  className="h-8 gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Add</span>
                </Button>
                {/* Mobile: Show memos panel toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMobileMemosPanel(true)}
                  className="h-8 gap-1.5 lg:hidden"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Memos</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Voice Memos (desktop only) */}
        <div className="hidden lg:block border-b">
          <Collapsible open={memosOpen} onOpenChange={setMemosOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/50 transition-colors text-left">
              {memosOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <Mic className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Voice Memos</span>
              {memoCount > 0 && (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {memoCount}
                </span>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="max-h-64 overflow-y-auto">
                <VoiceMemosPanel processingMemo={processingMemo} hideHeader />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* People List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !displayPeople || displayPeople.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-medium">
                  {searchQuery.trim() ? "No results found" : "No people yet"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {searchQuery.trim()
                    ? "Try a different search term"
                    : "Add someone to start tracking"}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {displayPeople.map((person) => (
                  <button
                    key={person._id}
                    onClick={() => onPersonSelect(person._id)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    {/* Avatar */}
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-lg shrink-0"
                      style={{
                        backgroundColor: person.color
                          ? `${person.color}20`
                          : "hsl(var(--muted))",
                      }}
                    >
                      {person.avatarEmoji || person.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{person.name}</span>
                        {person.nickname && (
                          <span className="text-xs text-muted-foreground truncate">
                            ({person.nickname})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {person.relationshipType && (
                          <span className="capitalize">{person.relationshipType}</span>
                        )}
                        {person.memoCount > 0 && (
                          <>
                            <span>•</span>
                            <span>{person.memoCount} memos</span>
                          </>
                        )}
                        {person.lastInteractionAt && (
                          <>
                            <span>•</span>
                            <span>{formatRelativeTime(person.lastInteractionAt)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Beeper Business Contacts (desktop only) */}
      <div className="hidden lg:block w-80 shrink-0">
        <BeeperContactsPanel />
      </div>

      {/* Mobile Memos Panel (as a slide-over) */}
      {showMobileMemosPanel && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileMemosPanel(false)}
          />
          {/* Panel */}
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-background shadow-xl animate-in slide-in-from-right">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Voice Memos
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMobileMemosPanel(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="h-[calc(100%-57px)]">
              <VoiceMemosPanel processingMemo={processingMemo} />
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AddPersonDialog
        open={showAddPersonDialog}
        onOpenChange={setShowAddPersonDialog}
      />
    </div>
  );
}
