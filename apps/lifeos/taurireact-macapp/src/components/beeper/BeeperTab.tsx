import { useEffect, useState, useRef, useCallback } from "react";
import { useBeeper } from "@/lib/contexts/BeeperContext";
import { useBeeperSync } from "@/lib/hooks/useBeeperSync";
import { syncBeeperDatabase } from "@/lib/services/beeper";
import { ThreadsList } from "./ThreadsList";
import { ConversationView } from "./ConversationView";
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

  // Timer refs
  const autoRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRefreshTimeRef = useRef<Date | null>(null);

  // Keep ref in sync
  useEffect(() => {
    lastRefreshTimeRef.current = lastRefreshTime;
  }, [lastRefreshTime]);

  // Manual sync and refresh handler - actually syncs from Beeper source
  const handleSyncAndRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Actually sync from Beeper source (runs pnpm sync && pnpm clean)
      const result = await syncBeeperDatabase();
      if (result.success) {
        // Then refresh UI from the updated database
        await checkDatabase();
        await loadThreads();
        const now = new Date();
        setLastRefreshTime(now);
      } else {
        console.error("Beeper sync failed:", result.error);
        // Still try to refresh the UI even if sync failed
        await checkDatabase();
        await loadThreads();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [checkDatabase, loadThreads]);

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

  // Auto-refresh timer setup
  useEffect(() => {
    if (!hasDatabaseSynced) {
      return;
    }

    // Auto-refresh function
    const performAutoRefresh = async () => {
      const now = Date.now();
      const lastRefresh = lastRefreshTimeRef.current?.getTime() || 0;

      // Only refresh if enough time has passed
      if (now - lastRefresh >= AUTO_REFRESH_INTERVAL) {
        setIsRefreshing(true);
        try {
          await checkDatabase();
          await loadThreads();
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
  }, [hasDatabaseSynced, checkDatabase, loadThreads, calculateNextRefreshIn]);

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
      {/* Header with search */}
      <div className="border-b p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Beeper Messages</h1>
            {businessCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                {businessCount} business
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Business filter toggle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="business-filter"
                      checked={showBusinessOnly}
                      onCheckedChange={setShowBusinessOnly}
                    />
                    <Label
                      htmlFor="business-filter"
                      className="text-xs cursor-pointer flex items-center gap-1"
                    >
                      <Briefcase className="w-3 h-3" />
                      Business
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Show only business-marked threads</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Sync to Cloud button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={syncAll}
                    disabled={isSyncing || businessCount === 0}
                  >
                    {isSyncing ? (
                      <>
                        <CloudUpload className="w-4 h-4 mr-1 animate-pulse" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <Cloud className="w-4 h-4 mr-1" />
                        Sync to Cloud
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {businessCount === 0
                      ? "Mark threads as business first"
                      : `Sync ${businessCount} business thread(s) to Convex`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Refresh status */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {lastRefreshTime && (
                <span title={lastRefreshTime.toLocaleString()}>
                  Updated {formatTimeAgo(lastRefreshTime)}
                </span>
              )}
              {nextRefreshIn !== null && nextRefreshIn > 0 && !isRefreshing && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatCountdown(nextRefreshIn)}
                </span>
              )}
            </div>
            {/* Sync button - actually syncs from Beeper source */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncAndRefresh}
              disabled={isRefreshing || isLoadingThreads}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Syncing..." : "Sync"}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search messages..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9 pr-9"
            />
            {searchInput && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <Button onClick={handleSearch} disabled={!searchInput.trim()}>
            Search
          </Button>
        </div>
        {searchQuery && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Showing results for: <strong>"{searchQuery}"</strong>
            </span>
            <button
              onClick={handleClearSearch}
              className="text-primary hover:underline"
            >
              Clear
            </button>
          </div>
        )}
        {/* Sync progress */}
        {isSyncing && (
          <div className="mt-2 p-2 rounded bg-muted/50 text-sm">
            <div className="flex items-center gap-2">
              <CloudUpload className="w-4 h-4 animate-pulse text-blue-500" />
              <span>{progress.currentStep || "Starting sync..."}</span>
            </div>
            {progress.threadsToSync > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                Threads: {progress.threadsSynced}/{progress.threadsToSync}
                {progress.messagesTotal > 0 &&
                  ` | Messages: ${progress.messagesSynced}/${progress.messagesTotal}`}
              </div>
            )}
          </div>
        )}
        {/* Sync result */}
        {lastSyncResult && !isSyncing && progress.status === "complete" && (
          <div className="mt-2 p-2 rounded bg-green-500/10 text-sm text-green-600">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4" />
              <span>
                Synced {lastSyncResult.threadsInserted} new thread(s),{" "}
                {lastSyncResult.messagesInserted} new message(s)
              </span>
            </div>
          </div>
        )}
        {/* Sync error */}
        {progress.status === "error" && (
          <div className="mt-2 p-2 rounded bg-red-500/10 text-sm text-red-600">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{progress.error || "Sync failed"}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main content - two column layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Threads list */}
        <div className="w-80 border-r flex-shrink-0 overflow-hidden">
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
      </div>
    </div>
  );
}
