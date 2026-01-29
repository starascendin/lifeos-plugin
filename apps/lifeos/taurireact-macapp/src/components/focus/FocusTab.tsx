import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { usePomodoro, formatTime, formatDuration } from "@/lib/contexts/PomodoroContext";
import { PomodoroStatsPanel } from "@/components/pm/pomodoro/PomodoroStatsPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  Square,
  Coffee,
  Timer,
  SkipForward,
} from "lucide-react";

/**
 * FocusTab - Dedicated pomodoro focus page (like TickTick's Focus tab)
 *
 * Shows:
 * - Large timer display when active
 * - Quick-start options (free focus, or pick a habit)
 * - Today's stats
 */
export function FocusTab() {
  const {
    state,
    startPomodoro,
    pausePomodoro,
    resumePomodoro,
    abandonPomodoro,
    skipBreak,
    isLoading,
  } = usePomodoro();

  const habits = useQuery(api.lifeos.habits.getHabits, {});
  const activeHabits = habits?.filter((h) => h.isActive && !h.archivedAt) ?? [];

  const isIdle = state.status === "idle";
  const isActive = state.status === "active";
  const isPaused = state.status === "paused";
  const isBreak = state.status === "break";
  const isRunning = isActive || isPaused || isBreak;

  const displayTime = isBreak ? state.breakRemainingMs : state.remainingMs;
  const totalMs = isBreak ? state.breakMinutes * 60 * 1000 : state.totalDurationMs;
  const progress = totalMs > 0 ? 1 - displayTime / totalMs : 0;

  // Label for what's being focused on
  const focusLabel = state.issue?.identifier ??
    state.issue?.title ??
    (state.habit ? `${state.habit.icon || "✅"} ${state.habit.name}` : null);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Timer className="h-5 w-5 text-red-500" />
          Focus
        </h1>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
          {/* Main Timer Area */}
          <div className="flex flex-col items-center space-y-6">
            {/* Circular progress + timer */}
            <div className="relative flex items-center justify-center w-64 h-64">
              {/* Background circle */}
              <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  strokeWidth="4"
                  className="stroke-muted"
                />
                {isRunning && (
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${progress * 283} 283`}
                    className={cn(
                      "transition-all duration-1000",
                      isBreak ? "stroke-green-500" : "stroke-red-500"
                    )}
                  />
                )}
              </svg>

              {/* Timer text */}
              <div className="flex flex-col items-center z-10">
                {isRunning ? (
                  <>
                    <span
                      className={cn(
                        "font-mono text-5xl font-bold tabular-nums",
                        isBreak ? "text-green-500" : "text-foreground"
                      )}
                    >
                      {formatTime(displayTime)}
                    </span>
                    <span className="text-sm text-muted-foreground mt-1">
                      {isBreak ? "Break Time" : isPaused ? "Paused" : "Focusing"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-5xl font-bold tabular-nums text-muted-foreground">
                      {state.durationMinutes}:00
                    </span>
                    <span className="text-sm text-muted-foreground mt-1">
                      Ready to focus
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* What's being focused on */}
            {isRunning && focusLabel && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {isBreak ? "Just finished" : "Working on"}
                </p>
                <p className="text-base font-medium mt-0.5">{focusLabel}</p>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-3">
              {isIdle && (
                <Button
                  size="lg"
                  className="gap-2 bg-red-500 hover:bg-red-600 text-white px-8"
                  onClick={() => startPomodoro({})}
                  disabled={isLoading}
                >
                  <Play className="h-5 w-5" />
                  Start Focus
                </Button>
              )}

              {(isActive || isPaused) && (
                <>
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 px-6"
                    onClick={isPaused ? resumePomodoro : pausePomodoro}
                  >
                    {isPaused ? (
                      <Play className="h-5 w-5" />
                    ) : (
                      <Pause className="h-5 w-5" />
                    )}
                    {isPaused ? "Resume" : "Pause"}
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    className="gap-2 text-muted-foreground hover:text-destructive"
                    onClick={abandonPomodoro}
                  >
                    <Square className="h-5 w-5" />
                    Stop
                  </Button>
                </>
              )}

              {isBreak && (
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 px-6"
                  onClick={skipBreak}
                >
                  <SkipForward className="h-5 w-5" />
                  Skip Break
                </Button>
              )}
            </div>
          </div>

          {/* Quick Start for Habits */}
          {isIdle && activeHabits.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Focus on a habit
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {activeHabits.slice(0, 8).map((habit) => (
                  <Button
                    key={habit._id}
                    variant="outline"
                    className="justify-start gap-2 h-auto py-2.5"
                    onClick={() => startPomodoro({ habitId: habit._id })}
                    disabled={isLoading}
                  >
                    <span className="text-lg">{habit.icon || "✅"}</span>
                    <span className="truncate text-sm">{habit.name}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Today's Stats */}
          <PomodoroStatsPanel />
        </div>
      </div>
    </div>
  );
}
