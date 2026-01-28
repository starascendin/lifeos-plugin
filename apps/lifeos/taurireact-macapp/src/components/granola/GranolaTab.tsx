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
import {
  RefreshCw,
  Clock,
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
  Users,
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

  // Selected meeting for detail panel
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(
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

      {/* Split View: Meetings List + Detail Panel */}
      <div className="flex-1 min-h-0 flex gap-4">
        {/* Left Panel: Meetings List */}
        <div className="w-80 flex-shrink-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex-shrink-0 py-3 px-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Meetings ({localMeetings.length})
                </span>
                {isLoadingMeetings && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <ScrollArea className="h-full">
                <div className="px-2 pb-2">
                  {localMeetings.length === 0 && !isLoadingMeetings ? (
                    <div className="text-center py-8 text-muted-foreground px-4">
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No meetings synced yet.</p>
                    </div>
                  ) : (
                    localMeetings.map((meeting) => {
                      const convexMeeting = convexMeetings?.find(
                        (cm) => cm.granolaDocId === meeting.id
                      );
                      const isSelected = selectedMeetingId === meeting.id;
                      const hasTranscript = meeting.transcript && meeting.transcript.length > 0;
                      const hasResume = !!meeting.resume_markdown;
                      return (
                        <button
                          key={meeting.id}
                          onClick={() => setSelectedMeetingId(meeting.id)}
                          className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                            isSelected
                              ? "bg-primary/10 border-l-2 border-primary"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{meeting.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatMeetingDate(meeting.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {!convexMeeting && (
                                <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" title="Not synced" />
                              )}
                              {hasResume && <FileText className="h-3 w-3 text-muted-foreground" />}
                              {hasTranscript && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Meeting Detail */}
        <div className="flex-1 min-w-0">
          {selectedMeetingId ? (
            (() => {
              const meeting = localMeetings.find((m) => m.id === selectedMeetingId);
              const convexMeeting = convexMeetings?.find(
                (cm) => cm.granolaDocId === selectedMeetingId
              );
              if (!meeting) return null;
              return (
                <MeetingDetailPanel
                  meeting={meeting}
                  convexMeetingId={convexMeeting?._id}
                />
              );
            })()
          ) : (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Select a meeting to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

interface MeetingDetailPanelProps {
  meeting: GranolaMeeting;
  convexMeetingId?: Id<"life_granolaMeetings">;
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

// Calendar event attendee
interface CalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
  self?: boolean;
}

// Link with calendar event info
interface MeetingCalendarLink {
  _id: Id<"life_granolaCalendarLinks">;
  calendarEventId: Id<"lifeos_calendarEvents">;
  linkSource: "auto_time_match" | "ai_suggestion" | "manual";
  matchConfidence?: number;
  matchReason?: string;
  eventTitle?: string;
  eventStartTime?: number;
  eventEndTime?: number;
  eventLocation?: string;
  eventAttendees?: CalendarAttendee[];
  eventAttendeesCount?: number;
}

// Calendar event suggestion
interface CalendarEventSuggestion {
  event: {
    _id: Id<"lifeos_calendarEvents">;
    title: string;
    startTime: number;
    endTime: number;
    location?: string;
    attendees?: CalendarAttendee[];
    attendeesCount?: number;
  };
  confidence: number;
  reason: string;
}

function MeetingDetailPanel({ meeting, convexMeetingId }: MeetingDetailPanelProps) {
  const hasTranscript = meeting.transcript && meeting.transcript.length > 0;
  const hasResume = !!meeting.resume_markdown;
  const hasFolders = meeting.folders && meeting.folders.length > 0;

  // Content view state
  const [showTranscript, setShowTranscript] = useState(false);
  const [showFullNotes, setShowFullNotes] = useState(false);

  // Linking state (Beeper threads)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);
  const [suggestionsAnalysis, setSuggestionsAnalysis] = useState<string>("");
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [acceptingThreadId, setAcceptingThreadId] = useState<Id<"lifeos_beeperThreads"> | null>(null);
  const [hasFetchedSuggestions, setHasFetchedSuggestions] = useState(false);

  // Person linking state (FRM People)
  const [personSuggestions, setPersonSuggestions] = useState<PersonSuggestion[]>([]);
  const [personSuggestionsAnalysis, setPersonSuggestionsAnalysis] = useState<string>("");
  const [acceptingPersonId, setAcceptingPersonId] = useState<Id<"lifeos_frmPeople"> | null>(null);

  // Calendar linking state
  const [acceptingCalendarEventId, setAcceptingCalendarEventId] = useState<Id<"lifeos_calendarEvents"> | null>(null);

  // Sync to Convex state
  const [isSyncingToConvex, setIsSyncingToConvex] = useState(false);

  // Convex hooks for syncing individual meeting
  const upsertMeeting = useMutation(api.lifeos.granola.upsertMeeting);

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

  // Convex hooks for calendar linking
  const calendarSuggestionsResult = useQuery(
    api.lifeos.granola.findCalendarEventsForMeeting,
    convexMeetingId ? { meetingId: convexMeetingId, bufferMinutes: 60 } : "skip"
  ) as { meetingTimestamp: number; meetingTitle: string; suggestions: CalendarEventSuggestion[] } | undefined;
  const meetingCalendarLinks = useQuery(
    api.lifeos.granola.getMeetingCalendarLinks,
    convexMeetingId ? { meetingId: convexMeetingId } : "skip"
  ) as MeetingCalendarLink[] | undefined;
  const linkMeetingToCalendarEvent = useMutation(api.lifeos.granola.linkMeetingToCalendarEvent);
  const deleteMeetingCalendarLink = useMutation(api.lifeos.granola.deleteMeetingCalendarLink);

  // Get the first linked calendar event ID for Beeper suggestions
  const firstLinkedCalendarEventId = meetingCalendarLinks?.[0]?.calendarEventId;

  // Query for Beeper contact suggestions based on calendar event attendees
  const beeperFromCalendarResult = useQuery(
    api.lifeos.granola.suggestBeeperContactsFromCalendarEvent,
    firstLinkedCalendarEventId
      ? { calendarEventId: firstLinkedCalendarEventId, meetingId: convexMeetingId }
      : "skip"
  ) as {
    event: {
      title: string;
      startTime: number;
      endTime: number;
      attendeesCount: number;
      isOneOnOne: boolean;
      isGroupMeeting: boolean;
    };
    suggestions: Array<{
      threadId: string;
      threadName: string;
      threadType: "dm" | "group";
      matchedAttendee: { email: string; displayName?: string };
      confidence: number;
      reason: string;
    }>;
  } | undefined;

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
      setHasFetchedSuggestions(true);
    }
  }, [convexMeetingId, suggestContactLinks, suggestPersonLinks]);

  // Auto-fetch suggestions when synced to Convex
  useEffect(() => {
    if (convexMeetingId && !hasFetchedSuggestions && !isLoadingSuggestions) {
      handleGetSuggestions();
    }
  }, [convexMeetingId, hasFetchedSuggestions, isLoadingSuggestions, handleGetSuggestions]);

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

  // Accept a calendar event suggestion and create the link
  const handleAcceptCalendarSuggestion = useCallback(
    async (suggestion: CalendarEventSuggestion) => {
      if (!convexMeetingId) return;

      setAcceptingCalendarEventId(suggestion.event._id);
      try {
        await linkMeetingToCalendarEvent({
          meetingId: convexMeetingId,
          calendarEventId: suggestion.event._id,
          linkSource: "auto_time_match",
          matchConfidence: suggestion.confidence,
          matchReason: suggestion.reason,
        });
      } catch (error) {
        console.error("Failed to link calendar event:", error);
      } finally {
        setAcceptingCalendarEventId(null);
      }
    },
    [convexMeetingId, linkMeetingToCalendarEvent]
  );

  // Delete a calendar link
  const handleDeleteCalendarLink = useCallback(
    async (linkId: Id<"life_granolaCalendarLinks">) => {
      try {
        await deleteMeetingCalendarLink({ linkId });
      } catch (error) {
        console.error("Failed to delete calendar link:", error);
      }
    },
    [deleteMeetingCalendarLink]
  );

  // Sync individual meeting to Convex
  const handleSyncToConvex = useCallback(async () => {
    if (convexMeetingId) return; // Already synced

    setIsSyncingToConvex(true);
    try {
      await upsertMeeting({
        granolaDocId: meeting.id,
        title: meeting.title,
        workspaceId: meeting.workspace_id,
        workspaceName: meeting.workspace_name,
        resumeMarkdown: meeting.resume_markdown,
        hasTranscript: !!(meeting.transcript && meeting.transcript.length > 0),
        folders: meeting.folders?.map((f) => ({ id: f.id, name: f.name })) || null,
        granolaCreatedAt: meeting.created_at,
        granolaUpdatedAt: meeting.updated_at,
      });
      // convexMeetingId will update automatically via the query
    } catch (error) {
      console.error("Failed to sync meeting to Convex:", error);
    } finally {
      setIsSyncingToConvex(false);
    }
  }, [convexMeetingId, meeting, upsertMeeting]);

  // Count total linked items
  const linkedThreadCount = meetingLinks?.length || 0;
  const linkedPersonCount = meetingPersonLinks?.length || 0;
  const linkedCalendarCount = meetingCalendarLinks?.length || 0;
  const linkedCount = linkedThreadCount + linkedPersonCount;

  // Calendar suggestions
  const calendarSuggestions = calendarSuggestionsResult?.suggestions || [];

  // Check if notes are long enough to need truncation
  const notesPreviewLength = 500;
  const isNotesLong = hasResume && (meeting.resume_markdown?.length || 0) > notesPreviewLength;
  const notesPreview = hasResume
    ? meeting.resume_markdown?.slice(0, notesPreviewLength) + (isNotesLong ? "..." : "")
    : "";

  // Check if there are pending suggestions (contacts or calendar)
  const hasSuggestions = suggestions.length > 0 || personSuggestions.length > 0;
  const hasCalendarSuggestions = calendarSuggestions.length > 0;

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <CardHeader className="flex-shrink-0 pb-3 border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-lg">{meeting.title}</h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <span>{formatMeetingDate(meeting.created_at)}</span>
              {meeting.workspace_name && (
                <>
                  <span>·</span>
                  <span>{meeting.workspace_name}</span>
                </>
              )}
              {hasFolders && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <FolderOpen className="h-3.5 w-3.5" />
                    {meeting.folders!.length}
                  </span>
                </>
              )}
            </div>
          </div>
          {/* Sync status & button */}
          {!convexMeetingId ? (
            <Button
              size="sm"
              onClick={handleSyncToConvex}
              disabled={isSyncingToConvex}
              className="flex-shrink-0"
            >
              {isSyncingToConvex ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Sync to Convex
                </>
              )}
            </Button>
          ) : (
            <Badge variant="secondary" className="bg-green-500/10 text-green-700">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Synced
            </Badge>
          )}
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {/* Notes section */}
            {hasResume && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    Notes
                  </span>
                  {hasTranscript && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTranscript(!showTranscript)}
                      className="h-7"
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                      {showTranscript ? "Hide" : "Show"} Transcript ({meeting.transcript!.length})
                    </Button>
                  )}
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {showFullNotes || !isNotesLong ? meeting.resume_markdown : notesPreview}
                  </pre>
                  {isNotesLong && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFullNotes(!showFullNotes)}
                      className="mt-2 h-7"
                    >
                      {showFullNotes ? "Show less" : "Show more"}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Transcript section */}
            {showTranscript && hasTranscript && (
              <div>
                <span className="text-sm font-medium flex items-center gap-1.5 mb-2">
                  <MessageSquare className="h-4 w-4" />
                  Transcript
                </span>
                <div className="bg-muted/30 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                  <div className="space-y-2">
                    {meeting.transcript!.map((utterance, idx) => (
                      <div key={idx} className="flex gap-3 text-sm">
                        <span
                          className={`font-medium flex-shrink-0 w-12 ${
                            utterance.source === "microphone" ? "text-blue-600" : "text-green-600"
                          }`}
                        >
                          {utterance.source === "microphone" ? "You" : "Them"}
                        </span>
                        <span className="text-foreground/80">{utterance.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* No notes - show transcript directly */}
            {!hasResume && hasTranscript && !showTranscript && (
              <div>
                <span className="text-sm font-medium flex items-center gap-1.5 mb-2">
                  <MessageSquare className="h-4 w-4" />
                  Transcript ({meeting.transcript!.length} utterances)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTranscript(true)}
                  className="h-7"
                >
                  Show Transcript
                </Button>
              </div>
            )}

            {/* No content */}
            {!hasResume && !hasTranscript && (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notes or transcript available</p>
              </div>
            )}

            {/* AI Linking Section */}
            {convexMeetingId && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" />
                    AI Linking
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleGetSuggestions()}
                    disabled={isLoadingSuggestions}
                    className="h-7"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoadingSuggestions ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>

                {/* Linked items */}
                {(linkedCount > 0 || linkedCalendarCount > 0) && (
                  <div className="space-y-2 mb-4">
                    <span className="text-xs text-muted-foreground">Linked</span>
                    <div className="flex flex-wrap gap-1.5">
                      {meetingPersonLinks?.map((link) => (
                        <Badge
                          key={link._id}
                          variant="secondary"
                          className="gap-1 pr-1 bg-green-500/10 text-green-700 dark:text-green-400"
                        >
                          {link.avatarEmoji || <UserCircle className="h-3 w-3" />}
                          <span className="text-xs">{link.personName}</span>
                          <button
                            onClick={() => handleDeletePersonLink(link._id)}
                            className="ml-0.5 hover:bg-red-500/20 rounded p-0.5"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                      {meetingLinks?.map((link) => (
                        <Badge
                          key={link._id}
                          variant="secondary"
                          className="gap-1 pr-1 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                        >
                          <MessageSquare className="h-3 w-3" />
                          <span className="text-xs">{link.threadName}</span>
                          <button
                            onClick={() => handleDeleteLink(link._id)}
                            className="ml-0.5 hover:bg-red-500/20 rounded p-0.5"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                      {meetingCalendarLinks?.map((link) => {
                        const extAttendees = link.eventAttendees?.filter((a) => !a.self) || [];
                        const isOneOnOne = extAttendees.length === 1;
                        return (
                          <Badge
                            key={link._id}
                            variant="secondary"
                            className="gap-1 pr-1 bg-purple-500/10 text-purple-700 dark:text-purple-400"
                          >
                            <Calendar className="h-3 w-3" />
                            <span className="text-xs truncate max-w-[120px]">{link.eventTitle}</span>
                            {isOneOnOne ? (
                              <span className="text-[10px] bg-blue-500/20 px-1 rounded">1:1</span>
                            ) : extAttendees.length > 1 && (
                              <span className="text-[10px] bg-orange-500/20 px-1 rounded">
                                {extAttendees.length + 1}p
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteCalendarLink(link._id)}
                              className="ml-0.5 hover:bg-red-500/20 rounded p-0.5"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Loading */}
                {isLoadingSuggestions && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Finding related contacts and calendar events...
                  </div>
                )}

                {/* Error */}
                {suggestionsError && (
                  <div className="flex items-center gap-2 text-sm text-red-500 py-2">
                    <AlertCircle className="h-4 w-4" />
                    {suggestionsError}
                  </div>
                )}

                {/* Suggestions */}
                {!isLoadingSuggestions && (hasSuggestions || hasCalendarSuggestions) && (
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground">Suggestions</span>

                    {/* Person suggestions */}
                    {personSuggestions.map((s) => (
                      <div
                        key={s.personId}
                        className="flex items-center gap-3 p-2 rounded-lg bg-green-500/5 hover:bg-green-500/10"
                      >
                        <UserCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{s.contactName}</span>
                            <Badge variant="outline" className="h-5 text-[10px] font-mono">
                              {s.confidence.toFixed(2)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{s.reason}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAcceptPersonSuggestion(s)}
                          disabled={acceptingPersonId === s.personId}
                          className="text-green-600 hover:bg-green-500/20"
                        >
                          {acceptingPersonId === s.personId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Link2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}

                    {/* Thread suggestions */}
                    {suggestions.map((s) => (
                      <div
                        key={s.threadId}
                        className="flex items-center gap-3 p-2 rounded-lg bg-blue-500/5 hover:bg-blue-500/10"
                      >
                        <MessageSquare className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{s.contactName}</span>
                            <Badge variant="outline" className="h-5 text-[10px] font-mono">
                              {s.confidence.toFixed(2)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{s.reason}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAcceptSuggestion(s)}
                          disabled={acceptingThreadId === s.threadId}
                          className="text-blue-600 hover:bg-blue-500/20"
                        >
                          {acceptingThreadId === s.threadId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Link2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}

                    {/* Calendar suggestions */}
                    {linkedCalendarCount === 0 && calendarSuggestions.map((s) => {
                      const extAttendees = s.event.attendees?.filter((a) => !a.self) || [];
                      const isOneOnOne = extAttendees.length === 1;
                      return (
                        <div
                          key={s.event._id}
                          className="flex items-center gap-3 p-2 rounded-lg bg-purple-500/5 hover:bg-purple-500/10"
                        >
                          <Calendar className="h-5 w-5 text-purple-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">{s.event.title}</span>
                              <Badge variant="outline" className="h-5 text-[10px] font-mono">
                                {s.confidence.toFixed(2)}
                              </Badge>
                              {isOneOnOne ? (
                                <Badge variant="secondary" className="h-5 text-[10px] bg-blue-500/10 text-blue-700">
                                  1-on-1
                                </Badge>
                              ) : extAttendees.length > 1 && (
                                <Badge variant="secondary" className="h-5 text-[10px] bg-orange-500/10 text-orange-700">
                                  Group ({extAttendees.length + 1})
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(s.event.startTime).toLocaleString()}
                            </p>
                            {extAttendees.length > 0 && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {extAttendees
                                  .map((a) => a.displayName || a.email)
                                  .slice(0, 3)
                                  .join(", ")}
                                {extAttendees.length > 3 && "..."}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAcceptCalendarSuggestion(s)}
                            disabled={acceptingCalendarEventId === s.event._id}
                            className="text-purple-600 hover:bg-purple-500/20"
                          >
                            {acceptingCalendarEventId === s.event._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Link2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Beeper contacts from calendar attendees */}
                {beeperFromCalendarResult && beeperFromCalendarResult.suggestions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Beeper contacts from calendar attendees
                    </span>
                    {beeperFromCalendarResult.suggestions.map((s) => (
                      <div
                        key={s.threadId}
                        className="flex items-center gap-3 p-2 rounded-lg bg-cyan-500/5 hover:bg-cyan-500/10"
                      >
                        <MessageSquare className="h-5 w-5 text-cyan-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{s.threadName}</span>
                            <Badge variant="outline" className="h-5 text-[10px] font-mono">
                              {s.confidence.toFixed(2)}
                            </Badge>
                            <Badge variant="secondary" className="h-5 text-[10px]">
                              {s.threadType === "dm" ? "DM" : "Group"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            Matched: {s.matchedAttendee.displayName || s.matchedAttendee.email}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{s.reason}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            // Accept this as a thread suggestion
                            handleAcceptSuggestion({
                              threadId: s.threadId as Id<"lifeos_beeperThreads">,
                              contactName: s.threadName,
                              confidence: s.confidence,
                              reason: `Calendar attendee match: ${s.matchedAttendee.displayName || s.matchedAttendee.email}`,
                            });
                          }}
                          disabled={acceptingThreadId === (s.threadId as Id<"lifeos_beeperThreads">)}
                          className="text-cyan-600 hover:bg-cyan-500/20"
                        >
                          {acceptingThreadId === (s.threadId as Id<"lifeos_beeperThreads">) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Link2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* No suggestions */}
                {!isLoadingSuggestions && !hasSuggestions && !hasCalendarSuggestions && !suggestionsError && hasFetchedSuggestions && !beeperFromCalendarResult?.suggestions?.length && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    <UserCircle className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
                    No matching contacts or calendar events found
                  </div>
                )}
              </div>
            )}

            {/* Not synced message */}
            {!convexMeetingId && (
              <div className="border-t pt-4 text-center text-muted-foreground">
                <Sparkles className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sync this meeting to enable AI contact & calendar linking</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
