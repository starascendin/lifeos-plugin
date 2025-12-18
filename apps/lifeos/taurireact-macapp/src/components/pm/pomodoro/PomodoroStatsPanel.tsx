import { Timer, Clock, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePomodoro, formatDuration } from "@/lib/contexts/PomodoroContext";
import { cn } from "@/lib/utils";
import { QuickStartButton } from "./StartPomodoroButton";

/**
 * PomodoroStatsPanel - Shows today's pomodoro stats
 *
 * Displays:
 * - Completed pomodoros count with tomato icons
 * - Total focus time
 * - Issue breakdown (what you worked on)
 */
export function PomodoroStatsPanel({ className }: { className?: string }) {
  const { todayStats, state } = usePomodoro();

  const completedCount = todayStats?.completedCount ?? 0;
  const totalFocusTimeMs = todayStats?.totalFocusTimeMs ?? 0;
  const issueBreakdown = todayStats?.issueBreakdown ?? [];

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="h-4 w-4 text-red-500" />
            Today's Focus
          </CardTitle>
          {state.status === "idle" && <QuickStartButton />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Completed Count */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
              <Target className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedCount}</p>
              <p className="text-xs text-muted-foreground">Pomodoros</p>
            </div>
          </div>

          {/* Total Focus Time */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {formatDuration(totalFocusTimeMs)}
              </p>
              <p className="text-xs text-muted-foreground">Focus Time</p>
            </div>
          </div>
        </div>

        {/* Tomato Icons */}
        {completedCount > 0 && (
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: Math.min(completedCount, 12) }).map(
              (_, i) => (
                <span key={i} className="text-lg">
                  🍅
                </span>
              )
            )}
            {completedCount > 12 && (
              <span className="text-sm text-muted-foreground">
                +{completedCount - 12} more
              </span>
            )}
          </div>
        )}

        {/* Issue Breakdown */}
        {issueBreakdown.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              What you worked on
            </p>
            <div className="space-y-1">
              {issueBreakdown.slice(0, 5).map((item) => (
                <div
                  key={item.issueId}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.issueIdentifier}
                    </span>
                    <span className="truncate">{item.issueTitle}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {item.completedCount}x
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(item.totalFocusTimeMs)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {completedCount === 0 && state.status === "idle" && (
          <p className="text-center text-sm text-muted-foreground py-4">
            Start a pomodoro to begin tracking your focus time
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * PomodoroStatsMini - Compact stats for sidebar/header
 */
export function PomodoroStatsMini({ className }: { className?: string }) {
  const { todayStats, isLoading } = usePomodoro();

  // Don't show while loading or if no stats
  if (isLoading) {
    return null;
  }

  const completedCount = todayStats?.completedCount ?? 0;
  const totalFocusTimeMs = todayStats?.totalFocusTimeMs ?? 0;

  if (completedCount === 0 && totalFocusTimeMs === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-3 text-sm", className)}>
      <div className="flex items-center gap-1">
        <span>🍅</span>
        <span className="font-medium">{completedCount}</span>
      </div>
      <div className="h-3 w-px bg-border" />
      <div className="flex items-center gap-1">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">
          {formatDuration(totalFocusTimeMs)}
        </span>
      </div>
    </div>
  );
}
