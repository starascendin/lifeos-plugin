import { useState, useEffect, useCallback, useRef } from "react";
import { useConvexAuth, useMutation, useQuery, useAction } from "convex/react";
import { api } from "@holaai/convex";
import { Id, Doc } from "@holaai/convex/convex/_generated/dataModel";
import {
  checkGranolaAvailable,
  checkGranolaTokenStatus,
  runGranolaSync,
  runGranolaAuth,
  readSyncedMeetings,
  getGranolaAutoSyncEnabled,
  saveGranolaAutoSyncEnabled,
  getGranolaSyncInterval,
  saveGranolaSyncInterval,
  getGranolaLastSync,
  saveGranolaLastSync,
  formatTimeAgo,
  formatCountdown,
  formatMeetingDate,
  isAuthError,
  SYNC_INTERVAL_OPTIONS,
  type GranolaMeeting,
  type GranolaSyncProgress,
  type GranolaTokenStatus,
  initialSyncProgress,
} from "@/lib/services/granola";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronRight,
  FileText,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  FolderOpen,
  KeyRound,
  Link2,
  Sparkles,
  UserCircle,
  X,
} from "lucide-react";

export function GranolaTab() {
  const { isAuthenticated } = useConvexAuth();

  // Availability state
  const [isGranolaAvailable, setIsGranolaAvailable] = useState<boolean | null>(
    null
  );

  // Sync state
  const [syncProgress, setSyncProgress] =
    useState<GranolaSyncProgress>(initialSyncProgress);

  // Last sync timestamp
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() =>
    getGranolaLastSync()
  );

  // Auto-sync state
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() =>
    getGranolaAutoSyncEnabled()
  );
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(() =>
    getGranolaSyncInterval()
  );

  // Countdown to next sync
  const [nextSyncIn, setNextSyncIn] = useState<number | null>(null);

  // Local meetings (from file system)
  const [localMeetings, setLocalMeetings] = useState<GranolaMeeting[]>([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);

  // Expanded meeting for viewing details
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(
    null
  );

  // Auth state
  const [needsAuth, setNeedsAuth] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<GranolaTokenStatus | null>(null);

  // Timer refs
  const autoSyncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncTimeRef = useRef<Date | null>(lastSyncTime);

  // Convex mutations
  const upsertMeetingsBatch = useMutation(
    api.lifeos.granola.upsertMeetingsBatch
  );
  const upsertTranscript = useMutation(api.lifeos.granola.upsertTranscript);
  const updateSyncStatus = useMutation(api.lifeos.granola.updateSyncStatus);

  // Convex queries
  const syncStatus = useQuery(api.lifeos.granola.getSyncStatus);
  const convexMeetings = useQuery(api.lifeos.granola.getMeetings, { limit: 50 });

  // Keep ref in sync
  useEffect(() => {
    lastSyncTimeRef.current = lastSyncTime;
  }, [lastSyncTime]);

  // Calculate interval in milliseconds
  const autoSyncInterval = syncIntervalMinutes * 60 * 1000;

  // Check availability and token status on mount
  useEffect(() => {
    async function checkAvailability() {
      const available = await checkGranolaAvailable();
      setIsGranolaAvailable(available);

      if (available) {
        await loadLocalMeetings();
        // Check token status
        const status = await checkGranolaTokenStatus();
        setTokenStatus(status);
        // If token is expired/missing, show auth prompt
        if (!status.is_valid && status.has_token) {
          setNeedsAuth(true);
        }
      }
    }
    checkAvailability();
  }, []);

  // Load local meetings from file system
  const loadLocalMeetings = useCallback(async () => {
    setIsLoadingMeetings(true);
    try {
      const meetings = await readSyncedMeetings();
      setLocalMeetings(meetings);
    } catch (error) {
      console.error("Failed to load meetings:", error);
    } finally {
      setIsLoadingMeetings(false);
    }
  }, []);

  // Sync to Convex
  const syncToConvex = useCallback(
    async (meetings: GranolaMeeting[]) => {
      if (!isAuthenticated || meetings.length === 0) return;

      try {
        // Prepare meetings for batch upsert
        const meetingsData = meetings.map((m) => ({
          granolaDocId: m.id,
          title: m.title,
          workspaceId: m.workspace_id,
          workspaceName: m.workspace_name,
          resumeMarkdown: m.resume_markdown,
          hasTranscript: !!m.transcript && m.transcript.length > 0,
          folders: m.folders,
          granolaCreatedAt: m.created_at,
          granolaUpdatedAt: m.updated_at,
        }));

        // Batch upsert meetings
        const result = await upsertMeetingsBatch({ meetings: meetingsData });
        console.log(
          `Synced ${result.insertedCount} new, ${result.updatedCount} updated meetings to Convex`
        );

        // Update sync status
        await updateSyncStatus({
          lastSyncAt: Date.now(),
          lastSyncMeetingCount: meetings.length,
          isSyncing: false,
        });
      } catch (error) {
        console.error("Failed to sync to Convex:", error);
        await updateSyncStatus({
          lastSyncError: String(error),
          isSyncing: false,
        });
      }
    },
    [isAuthenticated, upsertMeetingsBatch, updateSyncStatus]
  );

  // Handle sync
  const handleSync = useCallback(
    async (isAutoSync = false) => {
      if (!isAutoSync) {
        setSyncProgress({
          status: "checking",
          currentStep: "Checking Granola availability...",
        });
      }

      const available = await checkGranolaAvailable();
      if (!available) {
        if (!isAutoSync) {
          setSyncProgress({
            status: "error",
            currentStep: "",
            error:
              "Granola CLI not found. Check that the CLI is built and config.json exists.",
          });
        }
        return;
      }

      if (isAuthenticated) {
        await updateSyncStatus({ isSyncing: true });
      }

      const result = await runGranolaSync((progress) => {
        if (!isAutoSync || progress.status === "error") {
          setSyncProgress(progress);
        }
      });

      if (result.success) {
        const now = new Date();
        setLastSyncTime(now);
        saveGranolaLastSync(now);

        setSyncProgress({
          status: "complete",
          currentStep: result.message || "Sync complete!",
        });

        // Reload local meetings
        const meetings = await readSyncedMeetings();
        setLocalMeetings(meetings);

        // Sync to Convex
        if (isAuthenticated) {
          await syncToConvex(meetings);
        }
      } else {
        // Check if this is an auth error
        if (isAuthError(result.error)) {
          setNeedsAuth(true);
          // Refresh token status to show current state
          const status = await checkGranolaTokenStatus();
          setTokenStatus(status);
        }

        setSyncProgress({
          status: "error",
          currentStep: "",
          error: result.error || "Unknown error",
        });

        if (isAuthenticated) {
          await updateSyncStatus({
            lastSyncError: result.error,
            isSyncing: false,
          });
        }
      }
    },
    [isAuthenticated, syncToConvex, updateSyncStatus]
  );

  // Handle re-authentication
  const handleAuth = useCallback(async () => {
    setIsAuthenticating(true);
    setSyncProgress({
      status: "syncing",
      currentStep: "Importing tokens from Granola app...",
    });

    const result = await runGranolaAuth();

    setIsAuthenticating(false);

    if (result.success) {
      setNeedsAuth(false);
      // Refresh token status
      const status = await checkGranolaTokenStatus();
      setTokenStatus(status);
      setSyncProgress({
        status: "complete",
        currentStep: result.message || "Tokens imported successfully! Starting sync...",
      });
      // Auto-sync after successful auth
      setTimeout(() => handleSync(false), 1000);
    } else {
      // Check if it's a "not logged in" error
      const errorMsg = result.error || "Authentication failed";
      const needsGranolaLogin = errorMsg.toLowerCase().includes("log in") ||
                                errorMsg.toLowerCase().includes("not found") ||
                                errorMsg.toLowerCase().includes("no workos tokens");

      setSyncProgress({
        status: "error",
        currentStep: "",
        error: needsGranolaLogin
          ? "Please open Granola app and log in first, then try again."
          : errorMsg,
      });
    }
  }, [handleSync]);

  // Calculate time until next sync
  const calculateNextSyncIn = useCallback(() => {
    if (!lastSyncTimeRef.current || !autoSyncEnabled) return null;
    const elapsed = Date.now() - lastSyncTimeRef.current.getTime();
    const remaining = autoSyncInterval - elapsed;
    return Math.max(0, Math.ceil(remaining / 1000));
  }, [autoSyncEnabled, autoSyncInterval]);

  // Auto-sync timer setup
  useEffect(() => {
    if (!autoSyncEnabled || !isGranolaAvailable) {
      if (autoSyncTimerRef.current) {
        clearInterval(autoSyncTimerRef.current);
        autoSyncTimerRef.current = null;
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setNextSyncIn(null);
      return;
    }

    const performAutoSync = async () => {
      const now = Date.now();
      const lastSync = lastSyncTimeRef.current?.getTime() || 0;

      if (now - lastSync >= autoSyncInterval) {
        await handleSync(true);
      }
    };

    const timeSinceLastSync = lastSyncTimeRef.current
      ? Date.now() - lastSyncTimeRef.current.getTime()
      : Infinity;

    if (timeSinceLastSync >= autoSyncInterval) {
      performAutoSync();
    }

    autoSyncTimerRef.current = setInterval(performAutoSync, autoSyncInterval);

    countdownTimerRef.current = setInterval(() => {
      setNextSyncIn(calculateNextSyncIn());
    }, 1000);

    setNextSyncIn(calculateNextSyncIn());

    return () => {
      if (autoSyncTimerRef.current) {
        clearInterval(autoSyncTimerRef.current);
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [
    autoSyncEnabled,
    isGranolaAvailable,
    handleSync,
    calculateNextSyncIn,
    autoSyncInterval,
  ]);

  const isSyncing =
    syncProgress.status === "syncing" || syncProgress.status === "checking";

  return (
    <div className="h-full flex flex-col p-4 space-y-4 overflow-hidden">
      {/* Header with sync controls */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">GranolaAI</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {lastSyncTime && (
              <span title={lastSyncTime.toLocaleString()}>
                Synced {formatTimeAgo(lastSyncTime)}
              </span>
            )}
            {/* Token status indicator */}
            {tokenStatus && (
              <>
                <span>·</span>
                <span
                  className={`flex items-center gap-1 ${
                    tokenStatus.is_valid
                      ? tokenStatus.minutes_remaining && tokenStatus.minutes_remaining < 30
                        ? "text-orange-500"
                        : "text-green-600"
                      : "text-red-500"
                  }`}
                  title={tokenStatus.expires_at ? `Expires: ${tokenStatus.expires_at}` : ""}
                >
                  <KeyRound className="h-3 w-3" />
                  {tokenStatus.is_valid ? tokenStatus.message : "Token expired"}
                </span>
              </>
            )}
            {autoSyncEnabled && nextSyncIn !== null && nextSyncIn > 0 && !isSyncing && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatCountdown(nextSyncIn)}
                </span>
              </>
            )}
            {syncProgress.status === "complete" && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  {syncProgress.currentStep}
                </span>
              </>
            )}
            {syncProgress.status === "error" && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-red-500 max-w-[300px] truncate" title={syncProgress.error}>
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  {syncProgress.error}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-sync toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="auto-sync"
              checked={autoSyncEnabled}
              onCheckedChange={(checked) => {
                setAutoSyncEnabled(checked);
                saveGranolaAutoSyncEnabled(checked);
              }}
            />
            <Select
              value={String(syncIntervalMinutes)}
              onValueChange={(value) => {
                const interval = parseInt(value, 10);
                setSyncIntervalMinutes(interval);
                saveGranolaSyncInterval(interval);
              }}
              disabled={!autoSyncEnabled}
            >
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYNC_INTERVAL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sync button */}
          <Button
            onClick={() => handleSync(false)}
            disabled={isSyncing}
            size="sm"
            variant={isSyncing ? "outline" : "default"}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Auth Required Card */}
      {needsAuth && (
        <Card className="flex-shrink-0 border-orange-500/30 bg-orange-500/10">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <KeyRound className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-500">
                    Session Expired
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    1. Open <strong>Granola app</strong> and log in
                  </p>
                  <p className="text-sm text-muted-foreground">
                    2. Click Re-authenticate to import fresh tokens
                  </p>
                </div>
              </div>
              <Button
                onClick={handleAuth}
                disabled={isAuthenticating}
                variant="default"
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 flex-shrink-0"
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Re-authenticate
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Availability Warning */}
      {isGranolaAvailable === false && (
        <Card className="flex-shrink-0 border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-500">
                  Granola CLI Not Found
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Make sure the Granola CLI is built and config.json is set up
                  with valid credentials.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meetings List */}
      <div className="flex-1 min-h-0">
        <Card className="h-full flex flex-col">
          <CardHeader className="flex-shrink-0 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Meetings ({localMeetings.length})
              </CardTitle>
              {isLoadingMeetings && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0">
            <ScrollArea className="h-full">
              <div className="px-6 pb-6 space-y-2">
                {localMeetings.length === 0 && !isLoadingMeetings ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No meetings synced yet.</p>
                    <p className="text-sm mt-1">
                      Click "Sync Now" to import your Granola meetings.
                    </p>
                  </div>
                ) : (
                  localMeetings.map((meeting) => {
                    // Find corresponding Convex meeting ID
                    const convexMeeting = convexMeetings?.find(
                      (cm) => cm.granolaDocId === meeting.id
                    );
                    return (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        convexMeetingId={convexMeeting?._id}
                        isExpanded={expandedMeetingId === meeting.id}
                        onToggle={() =>
                          setExpandedMeetingId(
                            expandedMeetingId === meeting.id ? null : meeting.id
                          )
                        }
                      />
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface MeetingCardProps {
  meeting: GranolaMeeting;
  convexMeetingId?: Id<"life_granolaMeetings">;
  isExpanded: boolean;
  onToggle: () => void;
}

// Contact suggestion type from the AI action (for Beeper threads)
interface ContactSuggestion {
  threadId: Id<"lifeos_beeperThreads">;
  contactName: string;
  confidence: number;
  reason: string;
}

// Person suggestion type from the AI action (for FRM People)
interface PersonSuggestion {
  personId: Id<"lifeos_frmPeople">;
  contactName: string;
  confidence: number;
  reason: string;
}

// Link with thread info (Beeper)
interface MeetingLink {
  _id: Id<"life_granolaMeetingLinks">;
  beeperThreadId: Id<"lifeos_beeperThreads">;
  linkSource: "ai_suggestion" | "manual";
  aiConfidence?: number;
  aiReason?: string;
  threadName?: string;
  threadType?: "dm" | "group";
}

// Link with person info (FRM)
interface MeetingPersonLink {
  _id: Id<"life_granolaMeetingPersonLinks">;
  personId: Id<"lifeos_frmPeople">;
  linkSource: "ai_suggestion" | "manual";
  aiConfidence?: number;
  aiReason?: string;
  personName?: string;
  personNickname?: string;
  relationshipType?: string;
  avatarEmoji?: string;
}

function MeetingCard({ meeting, convexMeetingId, isExpanded, onToggle }: MeetingCardProps) {
  const hasTranscript = meeting.transcript && meeting.transcript.length > 0;
  const hasResume = !!meeting.resume_markdown;
  const hasFolders = meeting.folders && meeting.folders.length > 0;

  // Linking state (Beeper threads)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);
  const [suggestionsAnalysis, setSuggestionsAnalysis] = useState<string>("");
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [acceptingThreadId, setAcceptingThreadId] = useState<Id<"lifeos_beeperThreads"> | null>(null);
  const [showLinkSection, setShowLinkSection] = useState(false);

  // Person linking state (FRM People)
  const [personSuggestions, setPersonSuggestions] = useState<PersonSuggestion[]>([]);
  const [personSuggestionsAnalysis, setPersonSuggestionsAnalysis] = useState<string>("");
  const [acceptingPersonId, setAcceptingPersonId] = useState<Id<"lifeos_frmPeople"> | null>(null);

  // Convex hooks for thread linking
  const suggestContactLinks = useAction(api.lifeos.granola_linking.suggestContactLinks);
  const acceptSuggestion = useAction(api.lifeos.granola_linking.acceptSuggestion);
  const meetingLinks = useQuery(
    api.lifeos.granola.getMeetingLinks,
    convexMeetingId ? { meetingId: convexMeetingId } : "skip"
  ) as MeetingLink[] | undefined;
  const deleteMeetingLink = useMutation(api.lifeos.granola.deleteMeetingLink);

  // Convex hooks for person linking
  const suggestPersonLinks = useAction(api.lifeos.granola_linking.suggestPersonLinks);
  const acceptPersonSuggestion = useAction(api.lifeos.granola_linking.acceptPersonSuggestion);
  const meetingPersonLinks = useQuery(
    api.lifeos.granola.getMeetingPersonLinks,
    convexMeetingId ? { meetingId: convexMeetingId } : "skip"
  ) as MeetingPersonLink[] | undefined;
  const deleteMeetingPersonLink = useMutation(api.lifeos.granola.deleteMeetingPersonLink);

  // Get AI suggestions for linking (both thread and person)
  const handleGetSuggestions = useCallback(async () => {
    if (!convexMeetingId) return;

    setIsLoadingSuggestions(true);
    setSuggestionsError(null);
    setSuggestions([]);
    setPersonSuggestions([]);

    try {
      // Fetch both types of suggestions in parallel
      const [threadResult, personResult] = await Promise.all([
        suggestContactLinks({ meetingId: convexMeetingId }),
        suggestPersonLinks({ meetingId: convexMeetingId }),
      ]);

      // Handle thread suggestions
      if (threadResult.success) {
        setSuggestions(threadResult.suggestions || []);
        setSuggestionsAnalysis(threadResult.analysis || "");
      }

      // Handle person suggestions
      if (personResult.success) {
        setPersonSuggestions(personResult.suggestions || []);
        setPersonSuggestionsAnalysis(personResult.analysis || "");
      }

      // Set error only if both failed
      if (!threadResult.success && !personResult.success) {
        setSuggestionsError(threadResult.error || personResult.error || "Failed to get suggestions");
      }
    } catch (error) {
      setSuggestionsError(String(error));
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [convexMeetingId, suggestContactLinks, suggestPersonLinks]);

  // Accept a suggestion and create the link
  const handleAcceptSuggestion = useCallback(
    async (suggestion: ContactSuggestion) => {
      if (!convexMeetingId) return;

      setAcceptingThreadId(suggestion.threadId);
      try {
        const result = await acceptSuggestion({
          meetingId: convexMeetingId,
          beeperThreadId: suggestion.threadId,
          confidence: suggestion.confidence,
          reason: suggestion.reason,
        });

        if (result.success) {
          // Remove from suggestions list
          setSuggestions((prev) => prev.filter((s) => s.threadId !== suggestion.threadId));
        }
      } catch (error) {
        console.error("Failed to accept suggestion:", error);
      } finally {
        setAcceptingThreadId(null);
      }
    },
    [convexMeetingId, acceptSuggestion]
  );

  // Delete a thread link
  const handleDeleteLink = useCallback(
    async (linkId: Id<"life_granolaMeetingLinks">) => {
      try {
        await deleteMeetingLink({ linkId });
      } catch (error) {
        console.error("Failed to delete link:", error);
      }
    },
    [deleteMeetingLink]
  );

  // Accept a person suggestion and create the link
  const handleAcceptPersonSuggestion = useCallback(
    async (suggestion: PersonSuggestion) => {
      if (!convexMeetingId) return;

      setAcceptingPersonId(suggestion.personId);
      try {
        const result = await acceptPersonSuggestion({
          meetingId: convexMeetingId,
          personId: suggestion.personId,
          confidence: suggestion.confidence,
          reason: suggestion.reason,
        });

        if (result.success) {
          // Remove from suggestions list
          setPersonSuggestions((prev) => prev.filter((s) => s.personId !== suggestion.personId));
        }
      } catch (error) {
        console.error("Failed to accept person suggestion:", error);
      } finally {
        setAcceptingPersonId(null);
      }
    },
    [convexMeetingId, acceptPersonSuggestion]
  );

  // Delete a person link
  const handleDeletePersonLink = useCallback(
    async (linkId: Id<"life_granolaMeetingPersonLinks">) => {
      try {
        await deleteMeetingPersonLink({ linkId });
      } catch (error) {
        console.error("Failed to delete person link:", error);
      }
    },
    [deleteMeetingPersonLink]
  );

  // Determine default tab
  const defaultTab = hasResume ? "notes" : hasTranscript ? "transcript" : "notes";

  // Count total linked contacts (both thread and person links)
  const linkedThreadCount = meetingLinks?.length || 0;
  const linkedPersonCount = meetingPersonLinks?.length || 0;
  const linkedCount = linkedThreadCount + linkedPersonCount;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 text-left hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  )}
                  <h3 className="font-medium truncate">{meeting.title}</h3>
                </div>
                <div className="flex items-center gap-3 mt-1 ml-6 text-sm text-muted-foreground">
                  <span>{formatMeetingDate(meeting.created_at)}</span>
                  {meeting.workspace_name && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <FolderOpen className="h-3 w-3" />
                        {meeting.workspace_name}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {linkedCount > 0 && (
                  <Badge variant="default" className="text-xs bg-blue-500">
                    <Link2 className="h-3 w-3 mr-1" />
                    {linkedCount}
                  </Badge>
                )}
                {hasResume && (
                  <Badge variant="secondary" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    Notes
                  </Badge>
                )}
                {hasTranscript && (
                  <Badge variant="outline" className="text-xs">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Transcript
                  </Badge>
                )}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t bg-muted/30">
            {/* Folders row */}
            {hasFolders && (
              <div className="px-4 pt-3 pb-2 border-b border-border/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Folders:</span>
                  {meeting.folders!.map((folder) => (
                    <Badge key={folder.id} variant="outline" className="text-xs">
                      {folder.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs for Notes / Transcript */}
            {(hasResume || hasTranscript) && (
              <Tabs defaultValue={defaultTab} className="w-full">
                <div className="px-4 pt-3">
                  <TabsList className="grid w-full max-w-[300px] grid-cols-2">
                    <TabsTrigger value="notes" disabled={!hasResume} className="gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      Notes
                    </TabsTrigger>
                    <TabsTrigger value="transcript" disabled={!hasTranscript} className="gap-2">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Transcript
                      {hasTranscript && (
                        <span className="text-xs text-muted-foreground">
                          ({meeting.transcript!.length})
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="notes" className="px-4 pb-4 mt-0">
                  {hasResume ? (
                    <div className="bg-background rounded-md p-4 mt-3 max-h-[400px] overflow-y-auto">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                          {meeting.resume_markdown}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No notes available for this meeting</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="transcript" className="px-4 pb-4 mt-0">
                  {hasTranscript ? (
                    <div className="bg-background rounded-md p-4 mt-3 max-h-[400px] overflow-y-auto">
                      <div className="space-y-3">
                        {meeting.transcript!.map((utterance, idx) => (
                          <div key={idx} className="flex gap-3 text-sm">
                            <span
                              className={`font-medium flex-shrink-0 min-w-[60px] ${
                                utterance.source === "microphone"
                                  ? "text-blue-500"
                                  : "text-green-500"
                              }`}
                            >
                              {utterance.source === "microphone" ? "You" : "Them"}
                            </span>
                            <span className="text-foreground/90">{utterance.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No transcript available for this meeting</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}

            {/* No content message */}
            {!hasResume && !hasTranscript && (
              <div className="px-4 py-8 text-center text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notes or transcript available</p>
              </div>
            )}

            {/* Contact Linking Section */}
            {convexMeetingId && (
              <div className="border-t px-4 py-3">
                {/* Linked contacts (both threads and people) */}
                {linkedCount > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Linked Contacts
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {/* Thread links (Beeper chats) */}
                      {meetingLinks?.map((link) => (
                        <Badge
                          key={link._id}
                          variant="secondary"
                          className="gap-1 pr-1"
                        >
                          <MessageSquare className="h-3 w-3" />
                          {link.threadName || "Unknown"}
                          {link.linkSource === "ai_suggestion" && (
                            <Sparkles className="h-3 w-3 text-yellow-500" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLink(link._id);
                            }}
                            className="ml-1 hover:bg-destructive/20 rounded p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      {/* Person links (FRM contacts) */}
                      {meetingPersonLinks?.map((link) => (
                        <Badge
                          key={link._id}
                          variant="secondary"
                          className="gap-1 pr-1 bg-green-500/10 text-green-700 dark:text-green-400"
                        >
                          {link.avatarEmoji ? (
                            <span className="text-xs">{link.avatarEmoji}</span>
                          ) : (
                            <UserCircle className="h-3 w-3" />
                          )}
                          {link.personName || "Unknown"}
                          {link.linkSource === "ai_suggestion" && (
                            <Sparkles className="h-3 w-3 text-yellow-500" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePersonLink(link._id);
                            }}
                            className="ml-1 hover:bg-destructive/20 rounded p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Link section toggle */}
                {!showLinkSection ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowLinkSection(true);
                      if (suggestions.length === 0 && personSuggestions.length === 0 && !suggestionsError) {
                        handleGetSuggestions();
                      }
                    }}
                    className="w-full"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Find Related Contacts
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-muted-foreground">
                        AI Suggestions
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGetSuggestions();
                          }}
                          disabled={isLoadingSuggestions}
                          className="h-7 px-2"
                        >
                          {isLoadingSuggestions ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowLinkSection(false);
                          }}
                          className="h-7 px-2"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Loading state */}
                    {isLoadingSuggestions && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing meeting content...
                      </div>
                    )}

                    {/* Error state */}
                    {suggestionsError && (
                      <div className="text-sm text-red-500 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        {suggestionsError}
                      </div>
                    )}

                    {/* Person suggestions (FRM Contacts) */}
                    {personSuggestions.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-green-600 dark:text-green-400">
                          Contacts
                        </div>
                        {personSuggestionsAnalysis && !isLoadingSuggestions && (
                          <div className="text-xs text-muted-foreground bg-green-500/5 rounded p-2">
                            {personSuggestionsAnalysis}
                          </div>
                        )}
                        {personSuggestions.map((suggestion) => (
                          <div
                            key={suggestion.personId}
                            className="flex items-center justify-between bg-green-500/10 rounded-lg p-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <UserCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <span className="font-medium text-sm">
                                  {suggestion.contactName}
                                </span>
                                <Badge
                                  variant={
                                    suggestion.confidence >= 0.8
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {Math.round(suggestion.confidence * 100)}%
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {suggestion.reason}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptPersonSuggestion(suggestion);
                              }}
                              disabled={acceptingPersonId === suggestion.personId}
                              className="ml-3 flex-shrink-0 bg-green-600 hover:bg-green-700"
                            >
                              {acceptingPersonId === suggestion.personId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Link2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Thread suggestions (Beeper Business Chats) */}
                    {suggestions.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          Business Chats
                        </div>
                        {suggestionsAnalysis && !isLoadingSuggestions && (
                          <div className="text-xs text-muted-foreground bg-blue-500/5 rounded p-2">
                            {suggestionsAnalysis}
                          </div>
                        )}
                        {suggestions.map((suggestion) => (
                          <div
                            key={suggestion.threadId}
                            className="flex items-center justify-between bg-blue-500/10 rounded-lg p-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <span className="font-medium text-sm">
                                  {suggestion.contactName}
                                </span>
                                <Badge
                                  variant={
                                    suggestion.confidence >= 0.8
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {Math.round(suggestion.confidence * 100)}%
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {suggestion.reason}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptSuggestion(suggestion);
                              }}
                              disabled={acceptingThreadId === suggestion.threadId}
                              className="ml-3 flex-shrink-0"
                            >
                              {acceptingThreadId === suggestion.threadId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Link2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* No suggestions state */}
                    {!isLoadingSuggestions &&
                      suggestions.length === 0 &&
                      personSuggestions.length === 0 &&
                      !suggestionsError &&
                      (suggestionsAnalysis || personSuggestionsAnalysis) && (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          <UserCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          No matching contacts found
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
