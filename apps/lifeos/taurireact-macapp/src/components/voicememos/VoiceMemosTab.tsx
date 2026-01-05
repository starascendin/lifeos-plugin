import { useState, useEffect, useCallback, useRef } from "react";
import { useConvex, useQuery } from "convex/react";
import { api } from "@holaai/convex";
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
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const convex = useConvex();

  // Query synced local IDs from Convex to show cloud sync status
  const syncedLocalIds = useQuery(api.lifeos.voicememo.getSyncedLocalIds, {});
  const syncedUuidSet = new Set(syncedLocalIds ?? []);

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

    setIsTranscribing(true);
    setTranscriptionProgress(null);
    setTranscriptionErrors([]);

    try {
      const memoIds = Array.from(selectedIds);
      const results = await transcribeVoiceMemosBatch(memoIds, setTranscriptionProgress);

      // Capture any failed transcriptions
      const failed = results.filter(r => !r.success && r.error);
      if (failed.length > 0) {
        setTranscriptionErrors(failed);
        console.error("Transcription errors:", failed);
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
      setTranscriptionErrors([{
        memo_id: 0,
        transcription: "",
        language: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }]);
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

  const eligibleOnPage = paginatedMemos.filter(eligibleForTranscription);
  const eligibleOnPageIds = new Set(eligibleOnPage.map(m => m.id));
  const allEligible = filteredMemos.filter(eligibleForTranscription);
  const allEligibleIds = new Set(allEligible.map(m => m.id));

  const selectedOnPage = paginatedMemos.filter(m => selectedIds.has(m.id) && eligibleForTranscription(m));
  const isAllPageSelected = eligibleOnPage.length > 0 && eligibleOnPage.every(m => selectedIds.has(m.id));
  const isSomePageSelected = selectedOnPage.length > 0 && !isAllPageSelected;

  // Select all eligible on current page
  const selectAllOnPage = () => {
    const newSelected = new Set(selectedIds);
    eligibleOnPage.forEach(m => newSelected.add(m.id));
    setSelectedIds(newSelected);
  };

  // Select all eligible across all pages
  const selectAllEligible = () => {
    setSelectedIds(new Set(allEligibleIds));
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
  const isAnyOperationInProgress = isSyncing || isTranscribing ||
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
                    onClick={handleTranscribe}
                    disabled={!isTauri || selectedIds.size === 0 || isAnyOperationInProgress}
                    size="sm"
                  >
                    {isTranscribing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    <span className="ml-2">Transcribe{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Transcribe selected memos using AI</p>
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
            </div>
          </div>

          {/* Progress indicators */}
          {(syncProgress.status !== "idle" || transcriptionProgress || convexSyncProgress.status !== "idle" || transcriptionErrors.length > 0) && (
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
                    {transcriptionProgress.status}: {transcriptionProgress.memo_name}
                  </p>
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
                            disabled={isTranscribing || eligibleOnPage.length === 0}
                            aria-label="Select all"
                          />
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onClick={selectAllOnPage}
                        disabled={eligibleOnPage.length === 0}
                      >
                        Select page ({eligibleOnPage.length} eligible)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={selectAllEligible}
                        disabled={allEligible.length === 0}
                      >
                        Select all untranscribed ({allEligible.length})
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
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[80px]">Play</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMemos.map((memo) => (
                <VoiceMemoRow
                  key={memo.id}
                  memo={memo}
                  isSelected={selectedIds.has(memo.id)}
                  onToggleSelect={() => toggleSelection(memo.id)}
                  isTranscribing={isTranscribing}
                  isTauri={isTauri}
                  isSyncedToCloud={syncedUuidSet.has(memo.uuid)}
                />
              ))}
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
    </div>
  );
}

interface VoiceMemoRowProps {
  memo: VoiceMemo;
  isSelected: boolean;
  onToggleSelect: () => void;
  isTranscribing: boolean;
  isTauri: boolean;
  isSyncedToCloud: boolean;
}

function VoiceMemoRow({ memo, isSelected, onToggleSelect, isTranscribing, isTauri, isSyncedToCloud }: VoiceMemoRowProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
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
          {canTranscribe ? (
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
            {memo.transcription && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTranscript(!showTranscript)}
                className="h-6 px-2 text-xs justify-start w-fit"
              >
                {showTranscript ? "Hide" : "Show"} Transcript
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
          {isCloudOnly ? (
            <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
              <Cloud className="h-3 w-3 mr-1" />
              iCloud
            </Badge>
          ) : memo.transcription ? (
            <Badge variant="secondary" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Done
            </Badge>
          ) : isTooLarge ? (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Too Large
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              Pending
            </Badge>
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
      </TableRow>
      {showTranscript && memo.transcription && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/50">
            <div className="p-3">
              <p className="text-sm whitespace-pre-wrap">{memo.transcription}</p>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
