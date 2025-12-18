import { Play, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePomodoro } from "@/lib/contexts/PomodoroContext";
import type { Id } from "@holaai/convex";
import { cn } from "@/lib/utils";

interface StartPomodoroButtonProps {
  issueId: Id<"lifeos_pmIssues">;
  size?: "sm" | "md";
  className?: string;
}

/**
 * StartPomodoroButton - Button to start a pomodoro for a specific issue
 *
 * Shows:
 * - Play icon when idle
 * - Active indicator (timer icon) if this issue has the running pomodoro
 * - Disabled if another pomodoro is already active
 */
export function StartPomodoroButton({
  issueId,
  size = "sm",
  className,
}: StartPomodoroButtonProps) {
  const { state, startPomodoro, isLoading } = usePomodoro();

  // Debug: log on every render
  console.log("[StartPomodoroButton] Rendering", { issueId, isLoading, status: state.status });

  const isThisIssueActive = state.issueId === issueId;
  const hasOtherActive =
    (state.status === "active" || state.status === "paused") &&
    !isThisIssueActive;
  const isIdle = state.status === "idle";

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (isIdle && !isLoading) {
      try {
        await startPomodoro(issueId);
      } catch (error) {
        console.error("[Pomodoro] Failed to start:", error);
      }
    }
  };

  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const buttonSize = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const isDisabled = hasOtherActive || isLoading;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              buttonSize,
              isThisIssueActive && "bg-red-500/20 text-red-500",
              isDisabled && "opacity-50",
              className
            )}
            onClick={(e) => {
              console.log("[StartPomodoroButton] onClick fired");
              handleClick(e);
            }}
            onMouseDown={(e) => {
              console.log("[StartPomodoroButton] onMouseDown fired");
            }}
            onPointerDown={(e) => {
              console.log("[StartPomodoroButton] onPointerDown fired");
              e.stopPropagation();
            }}
            disabled={isDisabled}
          >
            {isThisIssueActive ? (
              <Timer className={cn(iconSize, "animate-pulse")} />
            ) : (
              <Play className={iconSize} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isLoading
            ? "Loading..."
            : isThisIssueActive
              ? "Pomodoro in progress"
              : hasOtherActive
                ? "Another pomodoro is active"
                : "Start Pomodoro"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * QuickStartButton - Button to start a free pomodoro (not linked to an issue)
 */
export function QuickStartButton({ className }: { className?: string }) {
  const { state, startPomodoro, isLoading } = usePomodoro();

  const isActive = state.status !== "idle";

  const handleClick = async () => {
    if (!isActive) {
      await startPomodoro();
    }
  };

  const isDisabled = isActive || isLoading;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-2",
              isDisabled && "opacity-50 cursor-not-allowed",
              className
            )}
            onClick={handleClick}
            disabled={isDisabled}
          >
            <Play className="h-4 w-4" />
            Start Focus
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isLoading
            ? "Loading..."
            : isActive
              ? "A pomodoro is already active"
              : "Start a 25-minute focus session"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
