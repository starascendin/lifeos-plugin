import { useEffect, useState, useRef, useCallback } from "react";
import { useBeeper } from "@/lib/contexts/BeeperContext";
import { useBeeperSync } from "@/lib/hooks/useBeeperSync";
import {
  syncBeeperDatabase,
  MESSAGE_SYNC_WINDOW_OPTIONS,
  getMessageSyncWindowSinceTimestamp,
  type MessageSyncWindow,
} from "@/lib/services/beeper";
import { ThreadsList } from "./ThreadsList";
import { ConversationView } from "./ConversationView";
import { ThreadDetailPanel } from "./ThreadDetailPanel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Search,
  X,
  MessageCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Cloud,
  CloudUpload,
  Briefcase,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Auto-refresh interval in milliseconds (3 minutes)
const AUTO_REFRESH_INTERVAL = 3 * 60 * 1000;
const SYNC_WINDOW_STORAGE_KEY = "beeper_cloud_sync_window";

function isValidSyncWindow(value: string): value is MessageSyncWindow {
  return MESSAGE_SYNC_WINDOW_OPTIONS.some((option) => option.value === value);
}

export function BeeperTab() {
  const {
    threads,
    selectedThread,
    searchResults,
    isLoadingThreads,
    isSearching,
    hasDatabaseSynced,
    loadThreads,
    search,
    clearSearch,
    searchQuery,
    setSearchQuery,
    checkDatabase,
    showBusinessOnly,
    setShowBusinessOnly,
    businessMarks,
  } = useBeeper();

  // Sync hook
  const { progress, isSyncing, syncAll, lastSyncResult } = useBeeperSync();

  // Count business threads
  const businessCount = businessMarks.size;

  const [searchInput, setSearchInput] = useState("");
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [syncWindow, setSyncWindow] = useState<MessageSyncWindow>(() => {
    if (typeof window === "undefined") return "since_2025";
    const stored = localStorage.getItem(SYNC_WINDOW_STORAGE_KEY);
    return stored && isValidSyncWindow(stored) ? stored : "since_2025";
  });

  const syncSinceTimestamp = getMessageSyncWindowSinceTimestamp(syncWindow);
  const selectedSyncWindowLabel =
    MESSAGE_SYNC_WINDOW_OPTIONS.find((option) => option.value === syncWindow)?.label ??
    "Since 2025";
  const hasAnySyncChanges = !!lastSyncResult && (
    lastSyncResult.threadsInserted > 0 ||
    lastSyncResult.threadsUpdated > 0 ||
    lastSyncResult.messagesInserted > 0 ||
    lastSyncResult.messagesUpdated > 0
  );

  // Timer refs
  const autoRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRefreshTimeRef = useRef<Date | null>(null);

  // Keep ref in sync
  useEffect(() => {
    lastRefreshTimeRef.current = lastRefreshTime;
  }, [lastRefreshTime]);

  useEffect(() => {
    localStorage.setItem(SYNC_WINDOW_STORAGE_KEY, syncWindow);
  }, [syncWindow]);

  // Show detail panel when thread is selected
  useEffect(() => {
    if (selectedThread) {
      setShowDetailPanel(true);
    }
  }, [selectedThread]);

  // Manual sync and refresh handler - syncs from Beeper source + cloud
  const handleSyncAndRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 1. Sync from Beeper source (runs pnpm sync && pnpm clean)
      const result = await syncBeeperDatabase();
      if (result.success) {
        // 2. Refresh UI from the updated database
        await checkDatabase();
        await loadThreads();
        // 3. Sync business threads to cloud (if any)
        if (businessMarks.size > 0) {
          await syncAll(syncSinceTimestamp);
        }
        setLastRefreshTime(new Date());
      } else {
        console.error("Beeper sync failed:", result.error);
        // Still try to refresh the UI even if sync failed
        await checkDatabase();
        await loadThreads();
        setLastRefreshTime(new Date());
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [checkDatabase, loadThreads, businessMarks.size, syncAll, syncSinceTimestamp]);

  // Calculate time until next refresh
  const calculateNextRefreshIn = useCallback(() => {
    if (!lastRefreshTimeRef.current) return null;
    const elapsed = Date.now() - lastRefreshTimeRef.current.getTime();
    const remaining = AUTO_REFRESH_INTERVAL - elapsed;
    return Math.max(0, Math.ceil(remaining / 1000));
  }, []);

  // Format time ago
  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Format countdown
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Check database and load threads on mount
  useEffect(() => {
    async function init() {
      await checkDatabase();
    }
    init();
  }, [checkDatabase]);

  // Load threads when database is synced (initial load)
  useEffect(() => {
    if (hasDatabaseSynced) {
      loadThreads();
      setLastRefreshTime(new Date());
    }
  }, [hasDatabaseSynced, loadThreads]);

  // Auto-refresh timer setup - performs full sync every 3 minutes
  useEffect(() => {
    if (!hasDatabaseSynced) {
      return;
    }

    // Auto-refresh function - does full sync from Beeper source + cloud sync
    const performAutoRefresh = async () => {
      const now = Date.now();
      const lastRefresh = lastRefreshTimeRef.current?.getTime() || 0;

      // Only refresh if enough time has passed
      if (now - lastRefresh >= AUTO_REFRESH_INTERVAL) {
        setIsRefreshing(true);
        try {
          // 1. Sync from Beeper source (updates local DuckDB)
          const result = await syncBeeperDatabase();
          if (result.success) {
            // 2. Refresh UI from updated database
            await checkDatabase();
            await loadThreads();
            // 3. Sync business threads to cloud (if any)
            if (businessMarks.size > 0) {
              await syncAll(syncSinceTimestamp);
            }
          } else {
            // Still try to refresh UI even if sync failed
            await checkDatabase();
            await loadThreads();
          }
          setLastRefreshTime(new Date());
        } finally {
          setIsRefreshing(false);
        }
      }
    };

    // Set up auto-refresh interval
    autoRefreshTimerRef.current = setInterval(performAutoRefresh, AUTO_REFRESH_INTERVAL);

    // Countdown timer - update every second
    countdownTimerRef.current = setInterval(() => {
      setNextRefreshIn(calculateNextRefreshIn());
    }, 1000);

    // Initial countdown
    setNextRefreshIn(calculateNextRefreshIn());

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [
    hasDatabaseSynced,
    checkDatabase,
    loadThreads,
    calculateNextRefreshIn,
    businessMarks.size,
    syncAll,
    syncSinceTimestamp,
  ]);

  // Handle search submit
  const handleSearch = () => {
    if (searchInput.trim()) {
      setSearchQuery(searchInput.trim());
      search(searchInput.trim());
    }
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchInput("");
    clearSearch();
  };

  // Handle keydown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    } else if (e.key === "Escape") {
      handleClearSearch();
    }
  };

  // Show database not synced state
  if (hasDatabaseSynced === false) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Database Not Synced</h2>
          <p className="text-muted-foreground mb-4">
            Your Beeper messages haven't been synced yet. Go to the Background
            Sync Jobs window and click "Sync Now" in the Beeper tab to import
            your WhatsApp messages.
          </p>
          <Button variant="outline" onClick={() => checkDatabase()}>
            Check Again
          </Button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (hasDatabaseSynced === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-muted-foreground">Checking database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Compact Header */}
      <div className="border-b px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Title and sync status */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <MessageCircle className="w-4 h-4 text-muted-foreground" />
            <h1 className="text-sm font-semibold">Beeper</h1>
            {businessCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                {businessCount}
              </span>
            )}
            {/* Last sync time display */}
            {lastRefreshTime && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {isRefreshing ? "Syncing..." : formatTimeAgo(lastRefreshTime)}
                {!isRefreshing && nextRefreshIn != null && nextRefreshIn > 0 && (
                  <span className="text-muted-foreground/60">
                    · {formatCountdown(nextRefreshIn)}
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Search inline */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search messages..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 pl-8 pr-8 text-sm"
            />
            {searchInput && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Business filter toggle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      id="business-filter"
                      checked={showBusinessOnly}
                      onCheckedChange={setShowBusinessOnly}
                      className="scale-90"
                    />
                    <Label
                      htmlFor="business-filter"
                      className="text-xs cursor-pointer"
                    >
                      <Briefcase className="w-3.5 h-3.5" />
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Show only business threads</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Sync to Cloud */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => syncAll(syncSinceTimestamp)}
                    disabled={isSyncing || businessCount === 0}
                  >
                    {isSyncing ? (
                      <CloudUpload className="w-4 h-4 animate-pulse" />
                    ) : (
                      <Cloud className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {businessCount === 0
                      ? "Mark threads as business first"
                      : `Sync ${businessCount} business thread(s) to cloud (${selectedSyncWindowLabel})`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Refresh/Sync button with status */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleSyncAndRefresh}
                    disabled={isRefreshing || isLoadingThreads}
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {isRefreshing
                      ? "Syncing..."
                      : lastRefreshTime
                        ? `Updated ${formatTimeAgo(lastRefreshTime)}${nextRefreshIn && nextRefreshIn > 0 ? ` · Next in ${formatCountdown(nextRefreshIn)}` : ""}`
                        : "Sync from Beeper"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Search results indicator */}
        {searchQuery && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Results for: <strong>"{searchQuery}"</strong>
            </span>
            <button
              onClick={handleClearSearch}
              className="text-primary hover:underline"
            >
              Clear
            </button>
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Cloud sync window:</span>
          <div className="flex items-center gap-1">
            {MESSAGE_SYNC_WINDOW_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={syncWindow === option.value ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => setSyncWindow(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Sync progress */}
        {isSyncing && (
          <div className="mt-2 p-2 rounded bg-muted/50 text-xs">
            <div className="flex items-center gap-2">
              <CloudUpload className="w-3.5 h-3.5 animate-pulse text-blue-500" />
              <span>{progress.currentStep || "Starting sync..."}</span>
            </div>
            {progress.threadsToSync > 0 && (
              <div className="mt-1 text-muted-foreground">
                Threads: {progress.threadsSynced}/{progress.threadsToSync}
                {progress.messagesTotal > 0 &&
                  ` | Messages: ${progress.messagesSynced}/${progress.messagesTotal}`}
              </div>
            )}
          </div>
        )}
        {/* Sync result */}
        {lastSyncResult && !isSyncing && progress.status === "complete" && (
          <div
            className={`mt-2 p-2 rounded text-xs ${
              hasAnySyncChanges
                ? "bg-green-500/10 text-green-600"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {hasAnySyncChanges ? (
              <span>
                Threads: {lastSyncResult.threadsInserted} new, {lastSyncResult.threadsUpdated} updated
                {" · "}
                Messages: {lastSyncResult.messagesInserted} new, {lastSyncResult.messagesUpdated} updated
              </span>
            ) : (
              <span>
                No new rows synced for {selectedSyncWindowLabel}. Data is already up to date for this range.
              </span>
            )}
          </div>
        )}
        {/* Sync error */}
        {progress.status === "error" && (
          <div className="mt-2 p-2 rounded bg-red-500/10 text-xs text-red-600">
            {progress.error || "Sync failed"}
          </div>
        )}
      </div>

      {/* Main content - three column layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Threads list */}
        <div className="w-72 border-r flex-shrink-0 overflow-hidden">
          <ThreadsList
            threads={searchQuery ? [] : threads}
            searchResults={searchQuery ? searchResults : []}
            isLoading={isLoadingThreads || isSearching}
            isSearchMode={!!searchQuery}
          />
        </div>

        {/* Conversation view */}
        <div className="flex-1 overflow-hidden">
          <ConversationView />
        </div>

        {/* Detail panel */}
        {showDetailPanel && selectedThread && (
          <div className="w-72 flex-shrink-0 overflow-hidden">
            <ThreadDetailPanel onClose={() => setShowDetailPanel(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
