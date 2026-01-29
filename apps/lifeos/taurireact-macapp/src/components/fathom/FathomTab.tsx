import { useState, useCallback } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@holaai/convex";
import { Doc } from "@holaai/convex/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  FileText,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  Search,
  Video,
  ExternalLink,
  ListChecks,
  Users,
} from "lucide-react";

type FathomMeeting = Doc<"life_fathomMeetings">;
type FathomTranscript = Doc<"life_fathomTranscripts">;

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatMeetingDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function FathomTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMeetingId, setSelectedMeetingId] = useState<
    FathomMeeting["_id"] | null
  >(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isFullSync, setIsFullSync] = useState(false);

  // Queries
  const meetings = useQuery(api.lifeos.fathom.getMeetings, { limit: 100 });
  const searchResults = useQuery(
    api.lifeos.fathom.searchMeetings,
    searchQuery.trim().length > 0 ? { query: searchQuery.trim() } : "skip"
  );
  const syncStatus = useQuery(api.lifeos.fathom.getSyncStatus);

  // Action
  const syncFathom = useAction(api.lifeos.fathom.syncFathomMeetings);

  // Use search results when searching, otherwise show all meetings
  const displayMeetings = searchQuery.trim().length > 0 ? searchResults : meetings;

  // Find selected meeting
  const selectedMeeting = displayMeetings?.find(
    (m) => m._id === selectedMeetingId
  );

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncFathom({ fullSync: isFullSync });
      if (result.success) {
        setSyncResult({
          type: "success",
          message: `Synced ${result.meetingsCount} meetings (${result.insertedCount} new, ${result.updatedCount} updated)`,
        });
      } else {
        setSyncResult({
          type: "error",
          message: result.error || "Sync failed",
        });
      }
    } catch (error) {
      setSyncResult({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSyncing(false);
    }
  }, [syncFathom, isFullSync]);

  return (
    <div className="h-full flex flex-col p-4 space-y-4 overflow-hidden">
      {/* Header with sync controls */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fathom AI</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {syncStatus?.lastSyncAt && (
              <span title={new Date(syncStatus.lastSyncAt).toLocaleString()}>
                Synced {formatTimeAgo(syncStatus.lastSyncAt)}
              </span>
            )}
            {syncStatus?.lastSyncMeetingCount != null && (
              <>
                <span>·</span>
                <span>{syncStatus.lastSyncMeetingCount} meetings</span>
              </>
            )}
            {syncResult?.type === "success" && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  {syncResult.message}
                </span>
              </>
            )}
            {(syncResult?.type === "error" || syncStatus?.lastSyncError) && (
              <>
                <span>·</span>
                <span
                  className="flex items-center gap-1 text-red-500 max-w-[400px] truncate"
                  title={syncResult?.message || syncStatus?.lastSyncError}
                >
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  {syncResult?.message || syncStatus?.lastSyncError}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Full sync toggle */}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={isFullSync}
              onChange={(e) => setIsFullSync(e.target.checked)}
              className="rounded"
            />
            Full sync
          </label>

          {/* Sync button */}
          <Button
            onClick={handleSync}
            disabled={isSyncing || syncStatus?.isSyncing}
            size="sm"
            variant={isSyncing ? "outline" : "default"}
          >
            {isSyncing || syncStatus?.isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Split View: Meetings List + Detail Panel */}
      <div className="flex-1 min-h-0 flex gap-4">
        {/* Left Panel: Meetings List */}
        <div className="w-80 flex-shrink-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex-shrink-0 py-3 px-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Meetings ({displayMeetings?.length ?? 0})
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search meetings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <ScrollArea className="h-full">
                <div className="px-2 pb-2">
                  {!displayMeetings ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : displayMeetings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground px-4">
                      <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        {searchQuery
                          ? "No meetings match your search."
                          : "No meetings synced yet. Click sync to fetch from Fathom."}
                      </p>
                    </div>
                  ) : (
                    displayMeetings.map((meeting) => {
                      const isSelected = selectedMeetingId === meeting._id;
                      const inviteeCount =
                        meeting.calendarInvitees?.length ?? 0;
                      const actionItemCount =
                        meeting.actionItems?.length ?? 0;

                      return (
                        <button
                          key={meeting._id}
                          onClick={() => setSelectedMeetingId(meeting._id)}
                          className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                            isSelected
                              ? "bg-primary/10 border-l-2 border-primary"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {meeting.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatMeetingDate(meeting.fathomCreatedAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {inviteeCount > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="h-5 text-[10px] px-1.5"
                                >
                                  <Users className="h-3 w-3 mr-0.5" />
                                  {inviteeCount}
                                </Badge>
                              )}
                              {actionItemCount > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="h-5 text-[10px] px-1.5"
                                >
                                  <ListChecks className="h-3 w-3 mr-0.5" />
                                  {actionItemCount}
                                </Badge>
                              )}
                              {meeting.hasTranscript && (
                                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                              )}
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
          {selectedMeeting ? (
            <MeetingDetailPanel meeting={selectedMeeting} />
          ) : (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
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
  meeting: FathomMeeting;
}

function MeetingDetailPanel({ meeting }: MeetingDetailPanelProps) {
  const transcript = useQuery(api.lifeos.fathom.getTranscript, {
    meetingId: meeting._id,
  });

  const hasSummary = !!meeting.summaryMarkdown;
  const hasActionItems =
    meeting.actionItems && meeting.actionItems.length > 0;
  const hasInvitees =
    meeting.calendarInvitees && meeting.calendarInvitees.length > 0;

  // Determine default tab
  const defaultTab = hasSummary
    ? "summary"
    : meeting.hasTranscript
      ? "transcript"
      : hasActionItems
        ? "actions"
        : "summary";

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <CardHeader className="flex-shrink-0 pb-3 border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-lg">{meeting.title}</h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatMeetingDate(meeting.fathomCreatedAt)}
              </span>
              {meeting.recordedByEmail && (
                <>
                  <span>·</span>
                  <span>by {meeting.recordedByEmail}</span>
                </>
              )}
              {hasInvitees && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {meeting.calendarInvitees!.length} attendees
                  </span>
                </>
              )}
            </div>
          </div>
          {meeting.fathomUrl && (
            <a
              href={meeting.fathomUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="flex-shrink-0">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Fathom
              </Button>
            </a>
          )}
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="flex-1 min-h-0 p-0">
        <Tabs defaultValue={defaultTab} className="h-full flex flex-col">
          <TabsList className="flex-shrink-0 mx-4 mt-3 w-fit">
            <TabsTrigger value="summary" className="text-xs">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="transcript" className="text-xs">
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Transcript
            </TabsTrigger>
            <TabsTrigger value="actions" className="text-xs">
              <ListChecks className="h-3.5 w-3.5 mr-1.5" />
              Actions
              {hasActionItems && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 h-4 text-[10px] px-1"
                >
                  {meeting.actionItems!.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0">
            {/* Summary Tab */}
            <TabsContent value="summary" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  {hasSummary ? (
                    <div className="bg-muted/50 rounded-lg p-4">
                      {meeting.summaryTemplateName && (
                        <Badge
                          variant="outline"
                          className="mb-3 text-[10px]"
                        >
                          {meeting.summaryTemplateName}
                        </Badge>
                      )}
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                        {meeting.summaryMarkdown}
                      </pre>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        No summary available for this meeting
                      </p>
                    </div>
                  )}

                  {/* Attendees section */}
                  {hasInvitees && (
                    <div className="mt-4">
                      <span className="text-sm font-medium flex items-center gap-1.5 mb-2">
                        <Users className="h-4 w-4" />
                        Attendees
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {meeting.calendarInvitees!.map((invitee, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-xs"
                          >
                            {invitee.name || invitee.email}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Transcript Tab */}
            <TabsContent value="transcript" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  {!meeting.hasTranscript ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        No transcript available for this meeting
                      </p>
                    </div>
                  ) : transcript === undefined ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : transcript === null ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Transcript not yet synced</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transcript.utterances.map((utterance, idx) => (
                        <div key={idx} className="flex gap-3 text-sm">
                          <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0 w-14 pt-0.5">
                            {utterance.timestamp}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-primary">
                              {utterance.speakerName}
                            </span>
                            <p className="text-foreground/80 mt-0.5">
                              {utterance.text}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Action Items Tab */}
            <TabsContent value="actions" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  {hasActionItems ? (
                    <ul className="space-y-2">
                      {meeting.actionItems!.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-sm"
                        >
                          <span className="flex-shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        No action items for this meeting
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
