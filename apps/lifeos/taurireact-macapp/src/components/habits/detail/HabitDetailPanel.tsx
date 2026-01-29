import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { useHabits } from "@/lib/contexts/HabitsContext";
import { usePomodoro, formatTime, formatDuration } from "@/lib/contexts/PomodoroContext";
import { HabitStats } from "./HabitStats";
import { HabitCalendar } from "./HabitCalendar";
import { Button } from "@/components/ui/button";
import { X, MoreHorizontal, Archive, Trash2, Play, Pause, Square, Timer } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Id } from "@holaai/convex";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface HabitDetailPanelProps {
  habitId: Id<"lifeos_habits">;
  onClose: () => void;
}

export function HabitDetailPanel({ habitId, onClose }: HabitDetailPanelProps) {
  const { archiveHabit, deleteHabit, categories } = useHabits();
  const {
    state: pomodoroState,
    startPomodoro,
    pausePomodoro,
    resumePomodoro,
    abandonPomodoro,
    isLoading: pomodoroLoading,
  } = usePomodoro();
  const [isDeleting, setIsDeleting] = useState(false);

  const pomodoroHistory = useQuery(
    api.lifeos.pm_pomodoro.getHabitPomodoroHistory,
    { habitId }
  );

  const isThisHabitActive = pomodoroState.habitId === habitId;
  const hasOtherActive =
    (pomodoroState.status === "active" || pomodoroState.status === "paused") &&
    !isThisHabitActive;
  const pomodoroIdle = pomodoroState.status === "idle";

  const handleStartPomodoro = async () => {
    if (pomodoroIdle && !pomodoroLoading) {
      await startPomodoro({ habitId });
    }
  };

  const habitWithStats = useQuery(api.lifeos.habits.getHabitWithStats, {
    habitId,
  });

  if (!habitWithStats) {
    return (
      <div className="w-80 border-l border-border bg-background p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-32 bg-muted animate-pulse rounded" />
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4">
          <div className="h-20 bg-muted animate-pulse rounded" />
          <div className="h-48 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  const category = categories?.find((c) => c._id === habitWithStats.categoryId);

  const handleArchive = async () => {
    try {
      await archiveHabit({ habitId });
      onClose();
    } catch (error) {
      console.error("Failed to archive habit:", error);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this habit? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteHabit({ habitId });
      onClose();
    } catch (error) {
      console.error("Failed to delete habit:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-80 border-l border-border bg-background flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">{habitWithStats.icon || "✅"}</span>
          <h2 className="font-semibold truncate">{habitWithStats.name}</h2>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive"
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? "Deleting..." : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Pomodoro Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5" />
            Pomodoro
          </h3>

          {isThisHabitActive ? (
            <div className={cn(
              "rounded-lg border px-3 py-3 space-y-2",
              pomodoroState.status === "paused"
                ? "border-yellow-500/30 bg-yellow-500/10"
                : "border-red-500/30 bg-red-500/10"
            )}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg font-semibold tabular-nums text-red-500">
                  {formatTime(pomodoroState.remainingMs)}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={pomodoroState.status === "paused" ? resumePomodoro : pausePomodoro}
                  >
                    {pomodoroState.status === "paused" ? (
                      <Play className="h-3.5 w-3.5" />
                    ) : (
                      <Pause className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={abandonPomodoro}
                  >
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-red-500 transition-all duration-1000"
                  style={{
                    width: `${pomodoroState.totalDurationMs > 0 ? (1 - pomodoroState.remainingMs / pomodoroState.totalDurationMs) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleStartPomodoro}
              disabled={hasOtherActive || pomodoroLoading}
            >
              <Play className="h-4 w-4" />
              {hasOtherActive ? "Another pomodoro active" : "Start Pomodoro"}
            </Button>
          )}

          {/* Pomodoro History */}
          {pomodoroHistory && pomodoroHistory.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Recent sessions ({pomodoroHistory.filter((s) => s.status === "completed").length} completed)
              </p>
              <div className="space-y-1">
                {pomodoroHistory.slice(0, 5).map((session) => (
                  <div
                    key={session._id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground">
                      {new Date(session.startedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {session.durationMinutes}min
                      </span>
                      <span
                        className={cn(
                          "capitalize",
                          session.status === "completed"
                            ? "text-green-500"
                            : session.status === "abandoned"
                              ? "text-red-500"
                              : "text-muted-foreground"
                        )}
                      >
                        {session.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <HabitStats habit={habitWithStats} />

        {/* Calendar */}
        <HabitCalendar habitId={habitId} />

        {/* Properties */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Properties</h3>

          {category && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Category</span>
              <span>
                {category.icon} {category.name}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Frequency</span>
            <span className="capitalize">{habitWithStats.frequency}</span>
          </div>

          {habitWithStats.frequency === "weekly" && habitWithStats.targetDays && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Days</span>
              <span className="text-right">
                {habitWithStats.targetDays
                  .map((d) => d.slice(0, 3))
                  .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
                  .join(", ")}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Best Streak</span>
            <span>{habitWithStats.longestStreak} days</span>
          </div>

          {habitWithStats.description && (
            <div className="pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground">
                {habitWithStats.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
