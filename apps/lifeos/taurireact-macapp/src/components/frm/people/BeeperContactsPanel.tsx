import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import {
  MessageSquare,
  Users,
  Briefcase,
  Loader2,
  Link2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

// Format relative time
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

export function BeeperContactsPanel() {
  const threads = useQuery(api.lifeos.beeper.getBusinessThreads);
  const people = useQuery(api.lifeos.frm_people.getPeople, {});
  const clients = useQuery(api.lifeos.pm_clients.getClients, {});

  const isLoading = threads === undefined;

  // Build lookup maps
  const personMap = new Map(
    (people ?? []).map((p) => [p._id, p.name])
  );
  const clientMap = new Map(
    (clients ?? []).map((c) => [c._id, c.name])
  );

  return (
    <div className="flex flex-col h-full border-l">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <h3 className="font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Beeper Business
        </h3>
        {threads && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {threads.length} thread{threads.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Empty */}
          {!isLoading && threads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No business threads</p>
              <p className="text-xs text-muted-foreground mt-1">
                Mark threads as business in Beeper
              </p>
            </div>
          )}

          {/* Thread list */}
          {!isLoading &&
            threads.map((thread) => {
              const personName = thread.linkedPersonId
                ? personMap.get(thread.linkedPersonId)
                : undefined;
              const clientName = thread.linkedClientId
                ? clientMap.get(thread.linkedClientId)
                : undefined;

              return (
                <div
                  key={thread._id}
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  {/* Thread name + type */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate flex-1">
                      {thread.threadName}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                      {thread.threadType}
                    </Badge>
                  </div>

                  {/* Message count + last message */}
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{thread.messageCount} msgs</span>
                    <span>·</span>
                    <span>{formatRelativeTime(thread.lastMessageAt)}</span>
                  </div>

                  {/* Link badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {personName && (
                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-green-500/10 text-green-700 dark:text-green-400 rounded">
                        <Users className="h-3 w-3" />
                        {personName}
                      </span>
                    )}
                    {clientName && (
                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded">
                        <Briefcase className="h-3 w-3" />
                        {clientName}
                      </span>
                    )}
                    {!personName && !clientName && (
                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                        <Link2 className="h-3 w-3" />
                        Unlinked
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </ScrollArea>
    </div>
  );
}
