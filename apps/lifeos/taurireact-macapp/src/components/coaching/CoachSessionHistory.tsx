/**
 * CoachSessionHistory - View past coaching sessions with summaries
 * Mobile-friendly: tighter spacing, full-width cards.
 */

import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Calendar, ChevronDown, Clock, Lightbulb, Loader2 } from "lucide-react";
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
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="text-center">
          <Calendar className="mx-auto mb-2 h-7 w-7 text-muted-foreground md:mb-3 md:h-8 md:w-8" />
          <p className="text-muted-foreground text-sm">
            No sessions yet with {coachName}.
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            Start a coaching session to see your history here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-2 overflow-y-auto md:space-y-3">
      <p className="text-muted-foreground text-xs md:text-sm">
        {sessions.length} session{sessions.length !== 1 ? "s" : ""}
      </p>

      {sessions.map((session) => (
        <SessionCard key={session._id} session={session} />
      ))}
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

  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-600",
    summarizing: "bg-yellow-500/10 text-yellow-600",
    completed: "bg-blue-500/10 text-blue-600",
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center gap-2 p-3 text-left transition-colors hover:bg-muted/50 md:gap-3 md:p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 md:gap-2">
                <p className="truncate font-medium text-xs md:text-sm">
                  {session.title || "Untitled Session"}
                </p>
                <Badge
                  variant="secondary"
                  className={cn(
                    "flex-shrink-0 text-[10px] md:text-xs",
                    statusColors[session.status],
                  )}
                >
                  {session.status === "summarizing" && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  {session.status}
                </Badge>
              </div>
              <div className="mt-1 flex items-center gap-2 text-muted-foreground text-[10px] md:gap-3 md:text-xs">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(session.startedAt).toLocaleDateString()}
                </span>
                {duration !== null && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {duration} min
                  </span>
                )}
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
          <CardContent className="border-t px-3 pt-2 pb-3 md:px-6 md:pt-3 md:pb-4">
            {session.summary && (
              <div className="mb-2 md:mb-3">
                <p className="mb-1 font-medium text-[10px] uppercase text-muted-foreground md:text-xs">
                  Summary
                </p>
                <p className="text-xs md:text-sm">{session.summary}</p>
              </div>
            )}

            {session.keyInsights && session.keyInsights.length > 0 && (
              <div>
                <p className="mb-1 font-medium text-[10px] uppercase text-muted-foreground md:text-xs">
                  Key Insights
                </p>
                <ul className="space-y-1">
                  {session.keyInsights.map((insight, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-xs md:gap-2 md:text-sm"
                    >
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-yellow-500 md:h-4 md:w-4" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!session.summary && session.status === "completed" && (
              <p className="text-muted-foreground text-xs md:text-sm">
                No summary available for this session.
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
