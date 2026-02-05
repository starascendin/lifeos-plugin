import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useConvex, useQuery, useAction } from "convex/react";
import { api } from "@holaai/convex";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import {
  type VoiceMemo,
  type VoiceMemosSyncProgress,
  type TranscriptionProgress,
  type TranscriptionResult,
  type ConvexSyncProgress,
  initialSyncProgress,
  initialConvexSyncProgress,
  syncVoiceMemos,
  getVoiceMemos,
  transcribeVoiceMemosBatch,
  syncTranscriptsToConvex,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Cloud,
  Upload,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Lightbulb,
  Zap,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExtractionDialog } from "./extraction";

type ViewFilter = "all" | "transcribed" | "not_transcribed" | "cloud_only";

const PAGE_SIZE_OPTIONS = [10, 50, 100] as const;

// Check if running in Tauri (as a function to evaluate at runtime)
const checkIsTauri = () => typeof window !== "undefined" && "__TAURI__" in window;

// Detect if error is related to Full Disk Access permission
const isPermissionError = (error: string | undefined | null): boolean => {
  if (!error) return false;
  const lowerError = error.toLowerCase();
  return (
    lowerError.includes("operation not permitted") ||
    lowerError.includes("permission denied") ||
    lowerError.includes("full disk access") ||
    lowerError.includes("access denied") ||
    lowerError.includes("unable to open database") ||
    lowerError.includes("readonly database")
  );
};

// Open macOS System Preferences for Full Disk Access
const openFullDiskAccessSettings = async () => {
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles");
  } catch (error) {
    console.error("Failed to open settings:", error);
  }
};

export function VoiceMemosTab() {
  const [memos, setMemos] = useState<VoiceMemo[]>([]);
  const [syncProgress, setSyncProgress] = useState<VoiceMemosSyncProgress>(initialSyncProgress);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [isTauri, setIsTauri] = useState(false);

  // Check if running in Tauri on mount
  useEffect(() => {
    setIsTauri(checkIsTauri());
  }, []);
  const [convexSyncProgress, setConvexSyncProgress] = useState<ConvexSyncProgress>(initialConvexSyncProgress);
  const [transcriptionProgress, setTranscriptionProgress] = useState<TranscriptionProgress | null>(null);
  const [transcriptionErrors, setTranscriptionErrors] = useState<TranscriptionResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRunningAllSteps, setIsRunningAllSteps] = useState(false);
  const [allStepsProgress, setAllStepsProgress] = useState<{
    step: "transcribe" | "sync" | "extract";
    extractCurrent: number;
    extractTotal: number;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const convex = useConvex();

  // Query synced memos from Convex with extraction status
  const syncedMemos = useQuery(api.lifeos.voicememo.getSyncedMemosWithStatus, {});
  const syncedMemoMap = new Map(
    (syncedMemos ?? []).map((m) => [m.localId, m])
  );
  const syncedUuidSet = new Set(syncedMemos?.map((m) => m.localId) ?? []);

  // Query GROQ API key from Convex
  const groqApiKey = useQuery(api.lifeos.voicememo.getGroqApiKey, {});

  // Action for AI extraction
  const extractVoiceMemo = useAction(api.lifeos.voicememo_extraction.extractVoiceMemo);

  // Extraction dialog state
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);
  const [extractionMemo, setExtractionMemo] = useState<{
    convexId: Id<"life_voiceMemos">;
    name: string;
    transcript: string;
  } | null>(null);

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

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [viewFilter, pageSize]);

  // Handle sync from macOS Voice Memos
  const handleSync = async () => {
    setHasPermissionError(false);
    setSyncProgress({ ...initialSyncProgress, status: "syncing" });
    const result = await syncVoiceMemos(setSyncProgress);

    // Check for permission error
    if (result.error && isPermissionError(result.error)) {
      setHasPermissionError(true);
    }

    await loadMemos();
  };

  // Handle sync transcripts to Convex cloud
  const handleSyncToConvex = async () => {
    setConvexSyncProgress({ ...initialConvexSyncProgress, status: "preparing" });
    await syncTranscriptsToConvex(convex, setConvexSyncProgress);
  };

  // Handle transcription with auto-sync to cloud
  const handleTranscribe = async () => {
    if (selectedIds.size === 0) return;

    // Check for API key first
    if (!groqApiKey) {
      toast.error("GROQ API Key Not Configured", {
        description: "Please set GROQ_API_KEY in your Convex environment variables.",
        duration: 10000,
      });
      return;
    }

    setIsTranscribing(true);
    setTranscriptionProgress(null);
    setTranscriptionErrors([]);

    try {
      const memoIds = Array.from(selectedIds);
      const results = await transcribeVoiceMemosBatch(memoIds, groqApiKey, setTranscriptionProgress);

      // Capture any failed transcriptions
      const failed = results.filter(r => !r.success && r.error);
      if (failed.length > 0) {
        setTranscriptionErrors(failed);
        console.error("Transcription errors:", failed);

        // Show toast for each failed transcription (or summarize if many)
        if (failed.length === 1) {
          toast.error("Transcription Failed", {
            description: failed[0].error,
            duration: 10000,
          });
        } else {
          toast.error(`${failed.length} Transcriptions Failed`, {
            description: failed[0].error,
            duration: 10000,
          });
        }
      }

      // Count successful transcriptions
      const successful = results.filter(r => r.success);

      await loadMemos();
      setSelectedIds(new Set());

      // Auto-sync to Convex cloud if any transcriptions succeeded
      if (successful.length > 0) {
        // Small delay to ensure local DB is updated
        await new Promise(resolve => setTimeout(resolve, 500));
        setConvexSyncProgress({ ...initialConvexSyncProgress, status: "preparing" });
        await syncTranscriptsToConvex(convex, setConvexSyncProgress);
      }
    } catch (error) {
      console.error("Transcription error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setTranscriptionErrors([{
        memo_id: 0,
        transcription: "",
        language: null,
        success: false,
        error: errorMessage,
      }]);
      toast.error("Transcription Failed", {
        description: errorMessage,
        duration: 10000,
      });
    } finally {
      setIsTranscribing(false);
      setTranscriptionProgress(null);
    }
  };

  // Run all steps: Transcribe → Sync to Cloud → Extract AI Insights
  // Handles memos at different stages — only runs the steps each memo still needs
  const handleRunAllSteps = async () => {
    if (selectedIds.size === 0) return;

    const selectedMemos = memos.filter((m) => selectedIds.has(m.id));
    const selectedMemoUuids = selectedMemos.map((m) => m.uuid);

    // Split selected memos by what they need
    const needsTranscription = selectedMemos.filter(
      (m) => m.local_path && !m.transcription && !exceedsGroqLimit(m.file_size),
    );

    if (needsTranscription.length > 0 && !groqApiKey) {
      toast.error("GROQ API Key Not Configured", {
        description: "Please set GROQ_API_KEY in your Convex environment variables.",
        duration: 10000,
      });
      return;
    }

    setIsRunningAllSteps(true);
    setTranscriptionProgress(null);
    setTranscriptionErrors([]);

    let transcribedCount = 0;

    try {
      // Step 1: Transcribe (only memos that need it)
      if (needsTranscription.length > 0) {
        setAllStepsProgress({ step: "transcribe", extractCurrent: 0, extractTotal: 0 });
        setIsTranscribing(true);
        const memoIds = needsTranscription.map((m) => m.id);
        const results = await transcribeVoiceMemosBatch(memoIds, groqApiKey!, setTranscriptionProgress);

        const failed = results.filter((r) => !r.success && r.error);
        if (failed.length > 0) {
          setTranscriptionErrors(failed);
        }
        transcribedCount = results.filter((r) => r.success).length;
        await loadMemos();
        setIsTranscribing(false);
        setTranscriptionProgress(null);
      }

      setSelectedIds(new Set());

      // Step 2: Sync to Convex (syncs all transcribed memos, not just selected)
      setAllStepsProgress({ step: "sync", extractCurrent: 0, extractTotal: 0 });
      await new Promise((resolve) => setTimeout(resolve, 500));
      setConvexSyncProgress({ ...initialConvexSyncProgress, status: "preparing" });
      await syncTranscriptsToConvex(convex, setConvexSyncProgress);

      // Step 3: Extract AI insights for selected memos that don't have extraction
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const freshSyncedMemos = await convex.query(api.lifeos.voicememo.getSyncedMemosWithStatus, {});
      const freshMap = new Map(freshSyncedMemos.map((m) => [m.localId, m]));

      const memosToExtract = selectedMemoUuids
        .map((uuid) => freshMap.get(uuid))
        .filter((m): m is NonNullable<typeof m> => !!m && !m.hasExtraction);

      let extractedCount = 0;
      if (memosToExtract.length > 0) {
        setAllStepsProgress({ step: "extract", extractCurrent: 0, extractTotal: memosToExtract.length });

        for (const memoToExtract of memosToExtract) {
          try {
            setAllStepsProgress({ step: "extract", extractCurrent: extractedCount + 1, extractTotal: memosToExtract.length });
            await extractVoiceMemo({ voiceMemoId: memoToExtract.convexId });
            extractedCount++;
          } catch (err) {
            console.error(`Failed to extract insights for ${memoToExtract.name}:`, err);
          }
        }
      }

      // Summary toast
      const parts: string[] = [];
      if (transcribedCount > 0) parts.push(`${transcribedCount} transcribed`);
      if (extractedCount > 0) parts.push(`${extractedCount} AI insights extracted`);
      if (parts.length > 0) {
        toast.success("All Steps Complete", { description: parts.join(", ") + "." });
      } else {
        toast.success("Pipeline Complete", { description: "All selected memos are up to date." });
      }
    } catch (error) {
      console.error("Run all steps error:", error);
      toast.error("Pipeline Failed", {
        description: error instanceof Error ? error.message : String(error),
        duration: 10000,
      });
    } finally {
      setIsRunningAllSteps(false);
      setIsTranscribing(false);
      setTranscriptionProgress(null);
      setAllStepsProgress(null);
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

  // Filter memos
  const filteredMemos = memos.filter((memo) => {
    if (viewFilter === "transcribed") return memo.transcription;
    if (viewFilter === "not_transcribed") return !memo.transcription;
    if (viewFilter === "cloud_only") return !memo.local_path;
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredMemos.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedMemos = filteredMemos.slice(startIndex, endIndex);

  // Selection helpers
  const eligibleForTranscription = (memo: VoiceMemo) =>
    memo.local_path && !memo.transcription && !exceedsGroqLimit(memo.file_size);

  // Memo has incomplete pipeline steps: Transcribe → AI Extract → Sync
  const hasIncompleteSteps = (memo: VoiceMemo) => {
    // 1. Needs transcription
    if (memo.local_path && !memo.transcription && !exceedsGroqLimit(memo.file_size)) return true;
    // 2. Needs AI extraction (synced to cloud but no extraction)
    const synced = syncedMemoMap.get(memo.uuid);
    if (synced && !synced.hasExtraction) return true;
    // 3. Has transcript but not synced to cloud yet
    if (memo.transcription && !syncedUuidSet.has(memo.uuid)) return true;
    return false;
  };

  const incompleteOnPage = paginatedMemos.filter(hasIncompleteSteps);
  const allIncomplete = filteredMemos.filter(hasIncompleteSteps);

  const selectedOnPage = paginatedMemos.filter(m => selectedIds.has(m.id));
  const isAllPageSelected = incompleteOnPage.length > 0 && incompleteOnPage.every(m => selectedIds.has(m.id));
  const isSomePageSelected = selectedOnPage.length > 0 && !isAllPageSelected;

  // Select all with incomplete steps on current page
  const selectAllOnPage = () => {
    const newSelected = new Set(selectedIds);
    incompleteOnPage.forEach(m => newSelected.add(m.id));
    setSelectedIds(newSelected);
  };

  // Select all with incomplete steps across all pages
  const selectAllIncomplete = () => {
    setSelectedIds(new Set(allIncomplete.map(m => m.id)));
  };

  // Deselect all on current page
  const deselectAllOnPage = () => {
    const newSelected = new Set(selectedIds);
    paginatedMemos.forEach(m => newSelected.delete(m.id));
    setSelectedIds(newSelected);
  };

  // Clear all selection
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Toggle header checkbox
  const toggleHeaderCheckbox = () => {
    if (isAllPageSelected) {
      deselectAllOnPage();
    } else {
      selectAllOnPage();
    }
  };

  // Check if a memo can be selected (has any incomplete step)
  const canSelect = (memo: VoiceMemo) => hasIncompleteSteps(memo);

  const isSyncing = syncProgress.status === "syncing";

  // Calculate counts
  const transcribedCount = memos.filter((m) => m.transcription).length;
  const notTranscribedCount = memos.filter((m) => !m.transcription).length;
  const cloudOnlyCount = memos.filter((m) => !m.local_path).length;

  // Calculate progress percentage
  const getSyncProgressPercentage = () => {
    if (syncProgress.total === 0) return 0;
    return Math.round((syncProgress.current / syncProgress.total) * 100);
  };

  // Check if any operation is in progress
  const isAnyOperationInProgress = isSyncing || isTranscribing || isRunningAllSteps ||
    convexSyncProgress.status === "syncing" || convexSyncProgress.status === "preparing";

  return (
    <div className="space-y-4 overflow-y-auto h-full">
      {/* Unified Action Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            {/* Left side - Title and stats */}
            <div className="flex items-center gap-3">
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
                          <strong>Sync:</strong> Import voice memos from macOS Voice Memos app.
                        </p>
                        <p>
                          <strong>Transcribe:</strong> Uses Groq Whisper AI. Max 100 MB per file.
                        </p>
                        <p>
                          <strong>Cloud:</strong> Upload transcripts to Convex (no audio).
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{memos.length} total</Badge>
                <Badge variant="outline">{transcribedCount} transcribed</Badge>
                {selectedIds.size > 0 && (
                  <Badge variant="default">{selectedIds.size} selected</Badge>
                )}
              </div>
            </div>

            {/* Right side - Action buttons */}
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              )}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleSync}
                      disabled={!isTauri || isAnyOperationInProgress}
                      size="sm"
                      variant="outline"
                    >
                      {isSyncing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-2 hidden sm:inline">Sync</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sync voice memos from Mac</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleRunAllSteps}
                      disabled={!isTauri || selectedIds.size === 0 || isAnyOperationInProgress}
                      size="sm"
                    >
                      {isRunningAllSteps ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      <span className="ml-2">Run All Steps{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Transcribe → AI Extract → Sync</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleSyncToConvex}
                      disabled={transcribedCount === 0 || isAnyOperationInProgress}
                      size="sm"
                      variant="outline"
                    >
                      {convexSyncProgress.status === "syncing" || convexSyncProgress.status === "preparing" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Cloud className="h-4 w-4" />
                      )}
                      <span className="ml-2 hidden sm:inline">Cloud</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sync transcriptions to cloud</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Progress indicators */}
          {(syncProgress.status !== "idle" || transcriptionProgress || convexSyncProgress.status !== "idle" || allStepsProgress || transcriptionErrors.length > 0) && (
            <div className="mt-3 pt-3 border-t space-y-2">
              {/* Sync progress */}
              {syncProgress.status !== "idle" && (
                <div className="space-y-1">
                  {syncProgress.status === "syncing" && syncProgress.total > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16">Sync:</span>
                      <Progress value={getSyncProgressPercentage()} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {syncProgress.current}/{syncProgress.total}
                      </span>
                    </div>
                  )}
                  {syncProgress.status === "complete" && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      <span className="text-xs">
                        Sync complete: {syncProgress.exported} new, {syncProgress.skipped} existing
                      </span>
                    </div>
                  )}
                  {syncProgress.status === "error" && (
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span className="text-xs">Sync error: {syncProgress.error}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Transcription progress */}
              {transcriptionProgress && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16">Transcribe:</span>
                    <Progress
                      value={transcriptionProgress.total > 0 ? (transcriptionProgress.current / transcriptionProgress.total) * 100 : 0}
                      className="h-2 flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {transcriptionProgress.current}/{transcriptionProgress.total}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-[72px] truncate">
                    {transcriptionProgress.status === "preprocessing" ? "Converting" : transcriptionProgress.status}: {transcriptionProgress.memo_name}
                  </p>
                  {/* Format conversion info */}
                  {transcriptionProgress.original_format && transcriptionProgress.converted_format && (
                    <p className="text-xs text-muted-foreground pl-[72px]">
                      <span className="font-mono">{transcriptionProgress.original_format.toUpperCase()}</span>
                      {transcriptionProgress.original_size && (
                        <span className="text-muted-foreground/70"> ({formatFileSize(transcriptionProgress.original_size)})</span>
                      )}
                      <span className="mx-1">→</span>
                      <span className="font-mono">{transcriptionProgress.converted_format.toUpperCase()}</span>
                      {transcriptionProgress.converted_size && (
                        <span className="text-green-600"> ({formatFileSize(transcriptionProgress.converted_size)})</span>
                      )}
                      {transcriptionProgress.original_size && transcriptionProgress.converted_size && (
                        <span className="text-green-600 ml-1">
                          ({Math.round((1 - transcriptionProgress.converted_size / transcriptionProgress.original_size) * 100)}% smaller)
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Cloud sync progress */}
              {convexSyncProgress.status !== "idle" && (
                <div className="space-y-1">
                  {(convexSyncProgress.status === "syncing" || convexSyncProgress.status === "preparing") && convexSyncProgress.total > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16">Cloud:</span>
                      <Progress value={(convexSyncProgress.current / convexSyncProgress.total) * 100} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {convexSyncProgress.current}/{convexSyncProgress.total}
                      </span>
                    </div>
                  )}
                  {convexSyncProgress.status === "complete" && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      <span className="text-xs">
                        Cloud sync: {convexSyncProgress.synced} synced, {convexSyncProgress.skipped} existing
                      </span>
                    </div>
                  )}
                  {convexSyncProgress.status === "error" && (
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span className="text-xs">Cloud error: {convexSyncProgress.error}</span>
                    </div>
                  )}
                </div>
              )}

              {/* All Steps pipeline indicator */}
              {allStepsProgress && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16">Pipeline:</span>
                    <div className="flex items-center gap-1 flex-1">
                      {(["transcribe", "extract", "sync"] as const).map((step, i) => {
                        const labels = { transcribe: "Transcribe", extract: "AI Extract", sync: "Synced" };
                        const icons = { transcribe: FileText, extract: Sparkles, sync: Cloud };
                        const Icon = icons[step];
                        const current = allStepsProgress.step;
                        // Execution: transcribe → sync → extract.
                        // Display: Transcribe → AI Extract → Synced.
                        // Treat internal "sync" step as part of "AI Extract" visually.
                        const isActive =
                          (step === "transcribe" && current === "transcribe") ||
                          (step === "extract" && (current === "sync" || current === "extract")) ||
                          false; // "sync" display step is never independently active
                        const isDone =
                          (step === "transcribe" && current !== "transcribe") ||
                          (step === "extract" && false) || // last real step
                          (step === "sync" && false); // only green when pipeline completes
                        return (
                          <div key={step} className="flex items-center">
                            {i > 0 && <div className={`w-4 h-px mx-1 ${isDone ? "bg-green-400" : "bg-border"}`} />}
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                              isActive ? "bg-primary/10 text-primary font-medium" :
                              isDone ? "bg-green-500/10 text-green-600" :
                              "bg-muted text-muted-foreground/50"
                            }`}>
                              {isActive ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
                              {labels[step]}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {allStepsProgress.step === "extract" && allStepsProgress.extractTotal > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16">Extract:</span>
                      <Progress
                        value={(allStepsProgress.extractCurrent / allStepsProgress.extractTotal) * 100}
                        className="h-2 flex-1"
                      />
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {allStepsProgress.extractCurrent}/{allStepsProgress.extractTotal}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Transcription errors */}
              {transcriptionErrors.length > 0 && !isTranscribing && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-destructive" />
                  <span className="text-xs text-destructive">
                    {transcriptionErrors.length} transcription{transcriptionErrors.length > 1 ? "s" : ""} failed
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-xs"
                    onClick={() => setTranscriptionErrors([])}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Disk Access Permission Error */}
      {hasPermissionError && isTauri && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Full Disk Access is required to sync Voice Memos from macOS.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={openFullDiskAccessSettings}
              className="ml-4 shrink-0"
            >
              Open System Settings
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filter tabs and pagination controls */}
      {memos.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto">
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
            {cloudOnlyCount > 0 && (
              <Badge
                variant={viewFilter === "cloud_only" ? "default" : "outline"}
                className="cursor-pointer flex-shrink-0"
                onClick={() => setViewFilter("cloud_only")}
              >
                <Cloud className="h-3 w-3 mr-1" />
                iCloud Only ({cloudOnlyCount})
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm text-muted-foreground">Show</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => setPageSize(Number(value))}
            >
              <SelectTrigger className="w-[70px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            {isTauri
              ? 'No voice memos synced yet. Click "Sync from Mac" to import your Voice Memos.'
              : "Voice Memos sync is only available in the desktop app. Download the macOS app to sync and transcribe your Voice Memos."}
          </AlertDescription>
        </Alert>
      )}

      {/* Memos table */}
      {!isLoading && filteredMemos.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 p-0 hover:bg-transparent">
                        <div className="flex items-center gap-1">
                          <Checkbox
                            checked={isAllPageSelected}
                            ref={(el) => {
                              if (el) {
                                (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = isSomePageSelected;
                              }
                            }}
                            onCheckedChange={toggleHeaderCheckbox}
                            disabled={isTranscribing || incompleteOnPage.length === 0}
                            aria-label="Select all"
                          />
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onClick={selectAllOnPage}
                        disabled={incompleteOnPage.length === 0}
                      >
                        Select page ({incompleteOnPage.length} incomplete)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={selectAllIncomplete}
                        disabled={allIncomplete.length === 0}
                      >
                        Select all incomplete ({allIncomplete.length})
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={deselectAllOnPage}
                        disabled={selectedOnPage.length === 0}
                      >
                        Deselect page
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={clearSelection}
                        disabled={selectedIds.size === 0}
                      >
                        Clear all selection
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-[100px]">Duration</TableHead>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead className="w-[80px]">Size</TableHead>
                <TableHead className="w-[80px]">Play</TableHead>
                <TableHead className="w-[180px]">Steps</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMemos.map((memo) => {
                const syncedMemo = syncedMemoMap.get(memo.uuid);
                return (
                  <VoiceMemoRow
                    key={memo.id}
                    memo={memo}
                    isSelected={selectedIds.has(memo.id)}
                    canSelect={canSelect(memo)}
                    onToggleSelect={() => toggleSelection(memo.id)}
                    isTranscribing={isTranscribing}
                    isTauri={isTauri}
                    isSyncedToCloud={syncedUuidSet.has(memo.uuid)}
                    convexId={syncedMemo?.convexId}
                    hasExtraction={syncedMemo?.hasExtraction ?? false}
                    onExtract={syncedMemo && memo.transcription ? () => {
                      setExtractionMemo({
                        convexId: syncedMemo.convexId,
                        name: memo.custom_label || memo.original_path?.split('/').pop() || 'Voice Memo',
                        transcript: memo.transcription!,
                      });
                      setExtractionDialogOpen(true);
                    } : undefined}
                  />
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredMemos.length)} of {filteredMemos.length}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-3 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Extraction Dialog */}
      {extractionMemo && (
        <ExtractionDialog
          open={extractionDialogOpen}
          onOpenChange={setExtractionDialogOpen}
          memoId={extractionMemo.convexId}
          memoName={extractionMemo.name}
          transcript={extractionMemo.transcript}
          onSuccess={() => {
            // Optionally refresh data
          }}
        />
      )}
    </div>
  );
}

// Tabbed details panel shown when "Show Details" is clicked
function MemoDetailsPanel({
  memo,
  convexId,
  hasExtraction,
  onExtract,
}: {
  memo: VoiceMemo;
  convexId?: Id<"life_voiceMemos">;
  hasExtraction: boolean;
  onExtract?: () => void;
}) {
  const extraction = useQuery(
    api.lifeos.voicememo_extraction.getLatestExtraction,
    hasExtraction && convexId ? { voiceMemoId: convexId } : "skip",
  );

  const defaultTab = hasExtraction ? "ai-insight" : "transcript";

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <div className="border-b px-4 pt-2">
        <TabsList className="h-8">
          {memo.transcription && (
            <TabsTrigger value="transcript" className="text-xs gap-1.5">
              <FileText className="h-3 w-3" />
              Raw Transcript
            </TabsTrigger>
          )}
          <TabsTrigger value="ai-insight" className="text-xs gap-1.5">
            <Sparkles className="h-3 w-3" />
            AI Insight
          </TabsTrigger>
        </TabsList>
      </div>

      {memo.transcription && (
        <TabsContent value="transcript" className="mt-0 p-4">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{memo.transcription}</p>
        </TabsContent>
      )}

      <TabsContent value="ai-insight" className="mt-0 p-4">
        {hasExtraction && extraction ? (
          <div className="space-y-4">
            {/* Summary */}
            <p className="text-sm text-muted-foreground">{extraction.summary}</p>

            {/* Labels */}
            {extraction.labels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {extraction.labels.map((label, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
            )}

            {/* Action Items */}
            {extraction.actionItems.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  Action Items
                </h4>
                <ul className="space-y-1">
                  {extraction.actionItems.map((item, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-muted-foreground/50 mt-0.5">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key Points */}
            {extraction.keyPoints.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                  <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                  Key Points
                </h4>
                <ul className="space-y-1">
                  {extraction.keyPoints.map((point, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-muted-foreground/50 mt-0.5">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : hasExtraction && !extraction ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading insights...</span>
          </div>
        ) : onExtract ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Sparkles className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No AI insights extracted yet.</p>
            <Button variant="outline" size="sm" onClick={onExtract} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Extract Insights
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6">
            <Sparkles className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Transcribe this memo first to extract AI insights.</p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

// Visual pipeline showing the 3 processing steps for each memo
function PipelineSteps({
  memo,
  isCloudOnly,
  isTooLarge,
  isSyncedToCloud,
  hasExtraction,
  onExtract,
}: {
  memo: VoiceMemo;
  isCloudOnly: boolean;
  isTooLarge: boolean;
  isSyncedToCloud: boolean;
  hasExtraction: boolean;
  onExtract?: () => void;
}) {
  if (isCloudOnly) {
    return (
      <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
        <Cloud className="h-3 w-3 mr-1" />
        iCloud
      </Badge>
    );
  }

  if (isTooLarge) {
    return (
      <Badge variant="destructive" className="text-xs">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Too Large
      </Badge>
    );
  }

  const hasTranscript = !!memo.transcription;

  const steps = [
    { label: "Transcribed", icon: FileText, done: hasTranscript },
    { label: "AI Insight", icon: Sparkles, done: hasExtraction, action: onExtract },
    { label: "Synced", icon: Cloud, done: isSyncedToCloud && hasExtraction },
  ];

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center">
            {i > 0 && (
              <div className={`w-3 h-px mx-0.5 ${
                steps[i - 1].done ? "bg-green-400" : "bg-border"
              }`} />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center transition-colors ${
                    step.done
                      ? "bg-green-500/15 text-green-600"
                      : "bg-muted text-muted-foreground/40"
                  } ${step.action ? "cursor-pointer hover:bg-accent" : ""}`}
                  onClick={step.action}
                >
                  <step.icon className="h-3 w-3" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {step.label}: {step.done ? "Done" : "Pending"}
                  {step.action && !step.done ? " — click to run" : ""}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}

interface VoiceMemoRowProps {
  memo: VoiceMemo;
  isSelected: boolean;
  canSelect: boolean;
  onToggleSelect: () => void;
  isTranscribing: boolean;
  isTauri: boolean;
  isSyncedToCloud: boolean;
  convexId?: Id<"life_voiceMemos">;
  hasExtraction: boolean;
  onExtract?: () => void;
}

function VoiceMemoRow({ memo, isSelected, canSelect, onToggleSelect, isTranscribing, isTauri, isSyncedToCloud, convexId, hasExtraction, onExtract }: VoiceMemoRowProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const displayName = getMemoDisplayName(memo);
  const isCloudOnly = !memo.local_path;
  const canTranscribe = memo.local_path && !memo.transcription && !exceedsGroqLimit(memo.file_size);
  const isTooLarge = exceedsGroqLimit(memo.file_size);

  // Extract file format from original path
  const fileFormat = memo.original_path?.split('.').pop()?.toUpperCase() || 'Unknown';

  // Load audio file and create blob URL
  const loadAudio = async () => {
    if (!memo.local_path || audioSrc || isLoadingAudio || !isTauri) return;

    setIsLoadingAudio(true);
    try {
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const data = await readFile(memo.local_path);
      const blob = new Blob([data], { type: "audio/mp4" });
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
    if (!audioSrc) {
      await loadAudio();
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
    <>
      <TableRow data-state={isSelected ? "selected" : undefined}>
        <TableCell>
          {canSelect ? (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              disabled={isTranscribing}
              aria-label={`Select ${displayName}`}
            />
          ) : (
            <div className="w-4" />
          )}
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <span className="font-medium truncate max-w-[300px]">{displayName}</span>
            {(memo.transcription || hasExtraction) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="h-6 px-2 text-xs justify-start w-fit"
              >
                {showDetails ? "Hide" : "Show"} Details
                {memo.transcription_language && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {memo.transcription_language}
                  </Badge>
                )}
              </Button>
            )}
            {isCloudOnly && (
              <p className="text-xs text-blue-600">
                Stored in iCloud - download in Voice Memos app first
              </p>
            )}
            {isTooLarge && !isCloudOnly && (
              <p className="text-xs text-destructive">
                Exceeds 100 MB limit
              </p>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="text-sm">{formatMemoDuration(memo.duration)}</span>
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground">{formatMemoDate(memo.date)}</span>
        </TableCell>
        <TableCell>
          {memo.file_size && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <HardDrive className="h-3 w-3" />
              <span className="text-sm">{formatFileSize(memo.file_size)}</span>
            </div>
          )}
        </TableCell>
        <TableCell>
          {memo.local_path && (
            <>
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
            </>
          )}
        </TableCell>
        <TableCell>
          <PipelineSteps
            memo={memo}
            isCloudOnly={isCloudOnly}
            isTooLarge={isTooLarge}
            isSyncedToCloud={isSyncedToCloud}
            hasExtraction={hasExtraction}
            onExtract={onExtract}
          />
        </TableCell>
      </TableRow>
      {showDetails && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/50 p-0">
            <MemoDetailsPanel
              memo={memo}
              convexId={convexId}
              hasExtraction={hasExtraction}
              onExtract={onExtract}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
