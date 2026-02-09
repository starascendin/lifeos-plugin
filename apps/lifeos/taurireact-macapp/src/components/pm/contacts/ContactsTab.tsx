import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@holaai/convex";
import type { Id } from "@holaai/convex";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Search,
  MessageSquare,
  User,
  Building2,
  NotebookPen,
  Video,
  ExternalLink,
  Sparkles,
  Link2,
  Clock3,
  Unlink2,
} from "lucide-react";

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatMeetingDate(dateString?: string): string {
  if (!dateString) return "Date unknown";
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return "Date unknown";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ContactsTab() {
  const contacts = useQuery(api.lifeos.beeper.getBusinessContacts, {});
  const autoLinkBusinessContacts = useAction(
    api.lifeos.beeper.autoLinkBusinessContacts,
  );
  const unlinkMeetingFromBusinessContact = useMutation(
    api.lifeos.beeper.unlinkMeetingFromBusinessContact,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    null,
  );
  const [isAutoLinking, setIsAutoLinking] = useState(false);
  const [unlinkingMeetingKey, setUnlinkingMeetingKey] = useState<string | null>(
    null,
  );
  const [autoLinkSummary, setAutoLinkSummary] = useState<{
    analysis?: string;
    appliedLinks: number;
    aiSuggestedLinks: number;
    autoCreatedPeople: number;
  } | null>(null);

  const autoRunTriggeredRef = useRef(false);

  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return contacts;

    return contacts.filter((contact) => {
      const searchable = [
        contact.threadName,
        contact.businessNote,
        contact.linkedPerson?.name,
        contact.linkedClient?.name,
        ...contact.linkedMeetings.map((meeting) => meeting.title),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(q);
    });
  }, [contacts, searchQuery]);

  useEffect(() => {
    if (filteredContacts.length === 0) {
      setSelectedContactId(null);
      return;
    }

    const hasSelection =
      selectedContactId &&
      filteredContacts.some((contact) => contact._id === selectedContactId);

    if (!hasSelection) {
      setSelectedContactId(filteredContacts[0]._id);
    }
  }, [filteredContacts, selectedContactId]);

  const selectedContact = useMemo(() => {
    if (!selectedContactId) return null;
    return (
      filteredContacts.find((contact) => contact._id === selectedContactId) ??
      null
    );
  }, [filteredContacts, selectedContactId]);

  const runAutoLink = useCallback(
    async (manual: boolean) => {
      setIsAutoLinking(true);
      try {
        const result = await autoLinkBusinessContacts({
          minConfidence: 0.65,
          maxGranolaMeetings: 120,
          maxFathomMeetings: 120,
          maxLinksToApply: 120,
        });

        if (!result.success) {
          toast.error(result.error || "Auto-linking failed");
          return;
        }

        setAutoLinkSummary({
          analysis: result.analysis,
          appliedLinks: result.appliedLinks,
          aiSuggestedLinks: result.aiSuggestedLinks,
          autoCreatedPeople: result.autoCreatedPeople,
        });

        if (manual || result.appliedLinks > 0 || result.autoCreatedPeople > 0) {
          toast.success(
            `AI linked ${result.appliedLinks} contacts and created ${result.autoCreatedPeople} contacts.`,
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Auto-linking failed";
        toast.error(message);
      } finally {
        setIsAutoLinking(false);
      }
    },
    [autoLinkBusinessContacts],
  );

  useEffect(() => {
    if (!contacts || autoRunTriggeredRef.current) return;
    autoRunTriggeredRef.current = true;
    void runAutoLink(false);
  }, [contacts, runAutoLink]);

  const handleUnlinkMeeting = useCallback(
    async (
      threadConvexId: string,
      meeting: {
        source: "granola" | "fathom";
        meetingId: string;
        title: string;
      },
    ) => {
      const key = `${meeting.source}-${meeting.meetingId}`;
      setUnlinkingMeetingKey(key);

      try {
        const result = await unlinkMeetingFromBusinessContact({
          threadConvexId: threadConvexId as Id<"lifeos_beeperThreads">,
          meetingSource: meeting.source,
          meetingId: meeting.meetingId,
        });

        if (result.totalDeleted > 0) {
          toast.success(`Unlinked "${meeting.title}" from this contact.`);
        } else {
          toast.message(`No existing link found for "${meeting.title}".`);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to unlink meeting";
        toast.error(message);
      } finally {
        setUnlinkingMeetingKey((current) => (current === key ? null : current));
      }
    },
    [unlinkMeetingFromBusinessContact],
  );

  const totalContacts = contacts?.length ?? 0;
  const contactsWithMeetings =
    contacts?.filter((contact) => contact.linkedAIMeetingCount > 0).length ?? 0;
  const totalMeetings =
    contacts?.reduce((sum, contact) => sum + contact.linkedAIMeetingCount, 0) ??
    0;

  if (contacts === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search contacts, clients, notes..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{totalContacts} contacts</Badge>
            <Badge variant="outline">
              {contactsWithMeetings} with AI notes
            </Badge>
            <Badge variant="outline">{totalMeetings} linked notes</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void runAutoLink(true)}
              disabled={isAutoLinking}
              className="gap-1.5"
            >
              {isAutoLinking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Auto-Link with AI
            </Button>
          </div>
        </div>

        {autoLinkSummary && (
          <div className="mt-3 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              AI linking summary:
            </span>{" "}
            {autoLinkSummary.appliedLinks} applied,{" "}
            {autoLinkSummary.aiSuggestedLinks} suggested,{" "}
            {autoLinkSummary.autoCreatedPeople} contacts auto-created.
            {autoLinkSummary.analysis ? ` ${autoLinkSummary.analysis}` : ""}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden p-4">
        {filteredContacts.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-center">
            <div>
              <p className="text-sm font-medium">
                {totalContacts === 0
                  ? "No business chats synced yet"
                  : "No contacts match your search"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {totalContacts === 0
                  ? "Mark business chats in Beeper and sync them to cloud."
                  : "Try a different keyword."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid h-full gap-4 lg:grid-cols-[360px_1fr]">
            <Card className="min-h-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Business Contacts</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-270px)] lg:h-[calc(100vh-320px)]">
                  <div className="space-y-1 px-2 pb-2">
                    {filteredContacts.map((contact) => {
                      const selected = contact._id === selectedContactId;
                      return (
                        <button
                          key={contact._id}
                          type="button"
                          onClick={() => setSelectedContactId(contact._id)}
                          className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-transparent hover:border-border hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {contact.threadName}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {contact.linkedPerson?.name ??
                                  "Unlinked contact"}
                                {contact.linkedClient?.name
                                  ? ` · ${contact.linkedClient.name}`
                                  : ""}
                              </p>
                            </div>
                            <Badge variant="outline" className="shrink-0">
                              {contact.linkedAIMeetingCount}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <NotebookPen className="h-3 w-3" />
                              {contact.granolaMeetingCount}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Video className="h-3 w-3" />
                              {contact.fathomMeetingCount}
                            </span>
                            <span className="ml-auto">
                              {formatRelativeTime(contact.lastMessageAt)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="min-h-0">
              {selectedContact ? (
                <>
                  <CardHeader className="border-b pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">
                        {selectedContact.threadName}
                      </CardTitle>
                      <Badge variant="secondary" className="uppercase">
                        {selectedContact.threadType}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Clock3 className="h-3 w-3" />
                        {formatRelativeTime(selectedContact.lastMessageAt)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedContact.messageCount} messages synced
                    </p>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md border px-3 py-2">
                        <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium uppercase text-muted-foreground">
                          <User className="h-3 w-3" /> Contact
                        </p>
                        <p className="text-sm font-medium">
                          {selectedContact.linkedPerson?.name ?? "Unlinked"}
                        </p>
                      </div>

                      <div className="rounded-md border px-3 py-2">
                        <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium uppercase text-muted-foreground">
                          <Building2 className="h-3 w-3" /> Client
                        </p>
                        <p className="text-sm font-medium">
                          {selectedContact.linkedClient?.name ?? "Unlinked"}
                        </p>
                      </div>
                    </div>

                    {selectedContact.businessNote ? (
                      <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
                        {selectedContact.businessNote}
                      </div>
                    ) : null}

                    <div className="rounded-md border p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">
                          Linked AI Notes
                        </h3>
                        <Badge variant="outline">
                          {selectedContact.linkedMeetings.length}
                        </Badge>
                      </div>

                      {selectedContact.linkedMeetings.length === 0 ? (
                        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          AI has not linked meetings for this contact yet.
                          Auto-link runs on load and can be triggered again.
                        </div>
                      ) : (
                        <ScrollArea className="h-[420px]">
                          <div className="space-y-2 pr-2">
                            {selectedContact.linkedMeetings.map((meeting) => {
                              const meetingKey = `${meeting.source}-${meeting.meetingId}`;
                              const isUnlinking =
                                unlinkingMeetingKey === meetingKey;

                              return (
                                <div
                                  key={meetingKey}
                                  className="rounded-md border px-3 py-2"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] uppercase"
                                        >
                                          {meeting.source}
                                        </Badge>
                                        <p className="truncate text-xs font-medium">
                                          {meeting.title}
                                        </p>
                                      </div>
                                      <p className="mt-1 text-[11px] text-muted-foreground">
                                        {formatMeetingDate(meeting.meetingDate)}{" "}
                                        · via{" "}
                                        {meeting.associatedVia.join(" + ")}
                                      </p>
                                      {meeting.aiReason ? (
                                        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                                          {meeting.aiReason}
                                        </p>
                                      ) : null}
                                    </div>

                                    <div className="flex shrink-0 items-center gap-1">
                                      {meeting.url ? (
                                        <Button
                                          asChild
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 px-2"
                                        >
                                          <a
                                            href={meeting.url}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                          </a>
                                        </Button>
                                      ) : (
                                        <span className="inline-flex h-7 items-center text-muted-foreground">
                                          <Link2 className="h-3.5 w-3.5" />
                                        </span>
                                      )}
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 gap-1 px-2 text-destructive hover:text-destructive"
                                        disabled={isUnlinking}
                                        onClick={() =>
                                          void handleUnlinkMeeting(
                                            selectedContact._id,
                                            {
                                              source: meeting.source,
                                              meetingId: meeting.meetingId,
                                              title: meeting.title,
                                            },
                                          )
                                        }
                                      >
                                        {isUnlinking ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Unlink2 className="h-3.5 w-3.5" />
                                        )}
                                        <span className="text-[11px]">
                                          Unlink
                                        </span>
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  </CardContent>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Select a contact to view details.
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
