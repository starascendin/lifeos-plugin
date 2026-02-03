import { useState, useRef, useEffect, useMemo } from "react";
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
  Bot,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Archive,
  ArchiveRestore,
  GitMerge,
} from "lucide-react";
import type { Id } from "@holaai/convex";
import { AddPersonDialog } from "./AddPersonDialog";
import { VoiceMemosPanel, type ProcessingMemo, type ProcessingStage } from "./VoiceMemosPanel";
import { BeeperContactsPanel } from "./BeeperContactsPanel";
import { MergeSuggestionsPanel } from "./MergeSuggestionsPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    showArchived,
    setShowArchived,
    archivePerson,
    restorePerson,
  } = useFRM();

  const [showAddPersonDialog, setShowAddPersonDialog] = useState(false);
  const [showMobileMemosPanel, setShowMobileMemosPanel] = useState(false);
  const [memosOpen, setMemosOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  // Query merge suggestions count for badge
  const mergeSuggestions = useQuery(api.lifeos.frm_contact_merge.getMergeSuggestions);
  const mergeCount = mergeSuggestions?.filter(Boolean).length ?? 0;

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

  // Sort state
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        // Clear sort, revert to default
        setSortKey(null);
        setSortDir("desc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedPeople = useMemo(() => {
    if (!displayPeople) return [];
    const list = [...displayPeople];
    const key = sortKey ?? "updatedAt";
    const dir = sortKey ? sortDir : "desc";

    list.sort((a, b) => {
      let aVal: string | number | undefined;
      let bVal: string | number | undefined;

      switch (key) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "relationshipType":
          aVal = a.relationshipType?.toLowerCase() ?? "";
          bVal = b.relationshipType?.toLowerCase() ?? "";
          break;
        case "memoCount":
          aVal = a.memoCount ?? 0;
          bVal = b.memoCount ?? 0;
          break;
        case "updatedAt":
          aVal = a.updatedAt ?? 0;
          bVal = b.updatedAt ?? 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return dir === "asc" ? -1 : 1;
      if (aVal > bVal) return dir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [displayPeople, sortKey, sortDir]);

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

            {/* Show archived toggle */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
                className="scale-75"
              />
              <Label htmlFor="show-archived" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                Archived
              </Label>
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

        {/* Collapsible Merge Suggestions (desktop only) */}
        <div className="hidden lg:block border-b">
          <Collapsible open={mergeOpen} onOpenChange={setMergeOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/50 transition-colors text-left">
              {mergeOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <GitMerge className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Unify Contacts</span>
              {mergeCount > 0 && (
                <span className="text-xs text-white bg-primary px-1.5 py-0.5 rounded-full">
                  {mergeCount}
                </span>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="max-h-80 overflow-y-auto">
                <MergeSuggestionsPanel hideHeader />
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort("name")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Name
                        {sortKey === "name" ? (
                          sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort("relationshipType")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Type
                        {sortKey === "relationshipType" ? (
                          sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort("memoCount")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Memos
                        {sortKey === "memoCount" ? (
                          sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </span>
                    </TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort("updatedAt")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Updated
                        {sortKey === "updatedAt" ? (
                          sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                        ) : !sortKey ? (
                          <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </span>
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPeople.map((person) => {
                    const isArchived = !!person.archivedAt;
                    return (
                      <TableRow
                        key={person._id}
                        className={`cursor-pointer ${isArchived ? "opacity-50" : ""}`}
                        onClick={() => onPersonSelect(person._id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div
                              className="h-8 w-8 rounded-full flex items-center justify-center text-sm shrink-0"
                              style={{
                                backgroundColor: person.color
                                  ? `${person.color}20`
                                  : "hsl(var(--muted))",
                              }}
                            >
                              {person.avatarEmoji || person.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium truncate block">{person.name}</span>
                              {person.nickname && (
                                <span className="text-xs text-muted-foreground truncate block">
                                  {person.nickname}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground capitalize">
                          {person.relationshipType ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {person.memoCount > 0 ? person.memoCount : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {person.autoCreatedFrom ? (
                            <span className="inline-flex items-center gap-1">
                              <Bot className="h-3.5 w-3.5" />
                              {person.autoCreatedFrom}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {formatRelativeTime(person.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isArchived ? (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    restorePerson({ personId: person._id });
                                  }}
                                >
                                  <ArchiveRestore className="h-4 w-4 mr-2" />
                                  Restore
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    archivePerson({ personId: person._id });
                                  }}
                                >
                                  <Archive className="h-4 w-4 mr-2" />
                                  Archive
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
