import { Play, Pause, Square, Coffee, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePomodoro, formatTime } from "@/lib/contexts/PomodoroContext";
import { cn } from "@/lib/utils";

/**
 * PomodoroWidget - Compact timer widget for the header bar
 *
 * Shows:
 * - Timer countdown (MM:SS)
 * - Issue identifier (if linked) or "Focus"
 * - Play/Pause button
 * - Stop/Abandon button
 * - Visual indicator for break vs work
 *
 * Only visible when a pomodoro is active/paused/break.
 */
export function PomodoroWidget() {
  const { state, pausePomodoro, resumePomodoro, abandonPomodoro, skipBreak, isLoading } =
    usePomodoro();

  // Don't show if loading or idle
  if (isLoading || state.status === "idle") {
    return null;
  }

  const isBreak = state.status === "break";
  const isPaused = state.status === "paused";
  const isActive = state.status === "active";

  const displayTime = isBreak ? state.breakRemainingMs : state.remainingMs;

  // Safe progress calculation to avoid NaN
  const breakTotalMs = state.breakMinutes * 60 * 1000;
  const progress = isBreak
    ? breakTotalMs > 0 ? 1 - state.breakRemainingMs / breakTotalMs : 0
    : state.totalDurationMs > 0 ? 1 - state.remainingMs / state.totalDurationMs : 0;

  const handlePlayPause = async () => {
    if (isPaused) {
      await resumePomodoro();
    } else if (isActive) {
      await pausePomodoro();
    }
  };

  const handleStop = async () => {
    if (isBreak) {
      skipBreak();
    } else {
      await abandonPomodoro();
    }
  };

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors",
          isBreak
            ? "border-green-500/30 bg-green-500/10"
            : "border-red-500/30 bg-red-500/10"
        )}
      >
        {/* Status Icon */}
        {isBreak ? (
          <Coffee className="h-4 w-4 text-green-500" />
        ) : (
          <Timer className="h-4 w-4 text-red-500" />
        )}

        {/* Timer Display */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-mono text-sm font-semibold tabular-nums",
              isBreak ? "text-green-500" : "text-red-500"
            )}
          >
            {formatTime(displayTime)}
          </span>

          {/* Progress indicator */}
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all duration-1000",
                isBreak ? "bg-green-500" : "bg-red-500"
              )}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* Issue/Habit/Label */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="max-w-[100px] truncate text-xs text-muted-foreground">
              {isBreak
                ? "Break"
                : state.issue?.identifier ??
                  state.issue?.title ??
                  (state.habit
                    ? `${state.habit.icon || "✅"} ${state.habit.name}`
                    : "Focus")}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {isBreak
              ? "Take a break! You've earned it."
              : state.issue?.title ??
                state.habit?.name ??
                "Free focus session"}
          </TooltipContent>
        </Tooltip>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {!isBreak && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handlePlayPause}
                >
                  {isPaused ? (
                    <Play className="h-3.5 w-3.5" />
                  ) : (
                    <Pause className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isPaused ? "Resume" : "Pause"}
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={handleStop}
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isBreak ? "Skip Break" : "Abandon"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
