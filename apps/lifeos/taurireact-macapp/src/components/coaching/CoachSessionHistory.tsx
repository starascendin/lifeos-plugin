/**
 * CoachSessionHistory - View past coaching sessions.
 * Simple list with expandable summaries.
 */

import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Calendar, ChevronDown, Lightbulb, Loader2 } from "lucide-react";
import { useState } from "react";

interface CoachSessionHistoryProps {
  coachProfileId: Id<"lifeos_coachingProfiles">;
  coachName: string;
}

export function CoachSessionHistory({
  coachProfileId,
  coachName,
}: CoachSessionHistoryProps) {
  const sessions =
    useQuery(api.lifeos.coaching.getCoachingSessions, {
      coachProfileId,
      limit: 30,
    }) ?? [];

  if (sessions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="text-center">
          <Calendar className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No sessions yet with {coachName}.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start a session to see history here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 md:px-6 md:py-4">
      <div className="mx-auto max-w-3xl">
        <p className="mb-3 text-xs text-muted-foreground">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        </p>
        <div className="space-y-1">
          {sessions.map((session) => (
            <SessionCard key={session._id} session={session} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SessionCard({
  session,
}: {
  session: {
    _id: Id<"lifeos_coachingSessions">;
    title?: string;
    summary?: string;
    keyInsights?: string[];
    status: string;
    startedAt: number;
    endedAt?: number;
    moodAtStart?: string;
    createdAt: number;
  };
}) {
  const [isOpen, setIsOpen] = useState(false);

  const duration = session.endedAt
    ? Math.round((session.endedAt - session.startedAt) / 60000)
    : null;

  const statusConfig: Record<string, { className: string; label: string }> = {
    active: { className: "bg-green-500/10 text-green-600", label: "Active" },
    summarizing: {
      className: "bg-yellow-500/10 text-yellow-600",
      label: "Summarizing",
    },
    completed: { className: "bg-blue-500/10 text-blue-600", label: "Done" },
  };

  const status = statusConfig[session.status] ?? {
    className: "",
    label: session.status,
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50 active:bg-muted/70">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium">
                {session.title || "Untitled Session"}
              </p>
              <Badge
                variant="secondary"
                className={cn("flex-shrink-0 text-[10px]", status.className)}
              >
                {session.status === "summarizing" && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                {status.label}
              </Badge>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{new Date(session.startedAt).toLocaleDateString()}</span>
              {duration !== null && <span>{duration} min</span>}
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="rounded-b-lg bg-muted/30 px-3 pb-3 pt-1">
          {session.summary && (
            <p className="text-sm leading-relaxed">{session.summary}</p>
          )}

          {session.keyInsights && session.keyInsights.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Key Insights
              </p>
              <ul className="space-y-1">
                {session.keyInsights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-yellow-500" />
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!session.summary && session.status === "completed" && (
            <p className="text-sm text-muted-foreground">
              No summary available.
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
