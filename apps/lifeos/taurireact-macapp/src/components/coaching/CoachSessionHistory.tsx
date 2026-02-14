/**
 * CoachSessionHistory - View past coaching sessions with summaries
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
import {
  Calendar,
  ChevronDown,
  Clock,
  Lightbulb,
  CheckCircle2,
  Loader2,
} from "lucide-react";
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
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Calendar className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">
            No sessions yet with {coachName}.
          </p>
          <p className="mt-1 text-muted-foreground text-sm">
            Start a coaching session to see your history here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto">
      <p className="text-muted-foreground text-sm">
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
          <button className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-sm">
                  {session.title || "Untitled Session"}
                </p>
                <Badge
                  variant="secondary"
                  className={cn("text-xs", statusColors[session.status])}
                >
                  {session.status === "summarizing" && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  {session.status}
                </Badge>
              </div>
              <div className="mt-1 flex items-center gap-3 text-muted-foreground text-xs">
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
                "h-4 w-4 text-muted-foreground transition-transform",
                isOpen && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="border-t pt-3">
            {session.summary && (
              <div className="mb-3">
                <p className="mb-1 font-medium text-xs text-muted-foreground uppercase">
                  Summary
                </p>
                <p className="text-sm">{session.summary}</p>
              </div>
            )}

            {session.keyInsights && session.keyInsights.length > 0 && (
              <div>
                <p className="mb-1 font-medium text-xs text-muted-foreground uppercase">
                  Key Insights
                </p>
                <ul className="space-y-1">
                  {session.keyInsights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!session.summary && session.status === "completed" && (
              <p className="text-muted-foreground text-sm">
                No summary available for this session.
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
