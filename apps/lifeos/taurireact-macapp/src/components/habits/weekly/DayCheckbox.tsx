import { cn } from "@/lib/utils";
import { Check, SkipForward, X, MessageSquare, Circle, Timer } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

// Habit states:
// - pending: no record exists (show empty circle)
// - complete: completed=true (green checkmark)
// - incomplete: completed=false, skipped=false, record exists (red X)
// - skipped: skipped=true (yellow skip icon)
type HabitState = "pending" | "complete" | "incomplete" | "skipped";

interface DayCheckboxProps {
  checked: boolean;
  scheduled: boolean;
  skipped?: boolean;
  incomplete?: boolean; // explicitly marked as incomplete
  onToggle: () => void;
  onCheck?: () => void;
  onUncheck?: () => void;
  onMarkIncomplete?: () => void;
  onSkip?: () => void;
  onSkipWithReason?: () => void;
  onStartPomodoro?: () => void;
  pomodoroDisabled?: boolean;
}

export function DayCheckbox({
  checked,
  scheduled,
  skipped,
  incomplete,
  onToggle,
  onCheck,
  onUncheck,
  onMarkIncomplete,
  onSkip,
  onSkipWithReason,
  onStartPomodoro,
  pomodoroDisabled,
}: DayCheckboxProps) {
  if (!scheduled) {
    // Render a disabled/greyed out circle for non-scheduled days
    return (
      <div className="w-7 h-7 rounded-full bg-muted/30 flex items-center justify-center">
        <span className="text-muted-foreground/30 text-xs">-</span>
      </div>
    );
  }

  // Determine state: complete > skipped > incomplete > pending
  const getState = (): HabitState => {
    if (checked) return "complete";
    if (skipped) return "skipped";
    if (incomplete) return "incomplete";
    return "pending";
  };

  const state = getState();

  const buttonContent = (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all",
        state === "complete" && "bg-primary border-primary text-primary-foreground",
        state === "skipped" && "border-yellow-500 bg-yellow-500/20 hover:bg-yellow-500/30",
        state === "incomplete" && "border-red-500 bg-red-500/20 hover:bg-red-500/30",
        state === "pending" && "border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/10"
      )}
    >
      {state === "complete" && <Check className="h-4 w-4" />}
      {state === "skipped" && <SkipForward className="h-3.5 w-3.5 text-yellow-600" />}
      {state === "incomplete" && <X className="h-3.5 w-3.5 text-red-600" />}
      {state === "pending" && null}
    </button>
  );

  // If no context menu handlers provided, just return the button
  if (!onCheck && !onUncheck && !onMarkIncomplete && !onSkip && !onSkipWithReason && !onStartPomodoro) {
    return buttonContent;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {buttonContent}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {onStartPomodoro && (
          <ContextMenuItem
            onSelect={(e) => { e.preventDefault(); onStartPomodoro(); }}
            disabled={pomodoroDisabled}
          >
            <Timer className="h-4 w-4 mr-2 text-red-500" />
            {pomodoroDisabled ? "Pomodoro active" : "Start Pomodoro"}
          </ContextMenuItem>
        )}
        {onStartPomodoro && (onCheck || onMarkIncomplete || onUncheck) && <ContextMenuSeparator />}
        {onCheck && (
          <ContextMenuItem onSelect={(e) => { e.preventDefault(); onCheck(); }}>
            <Check className="h-4 w-4 mr-2 text-green-600" />
            Mark complete
          </ContextMenuItem>
        )}
        {onMarkIncomplete && (
          <ContextMenuItem onSelect={(e) => { e.preventDefault(); onMarkIncomplete(); }}>
            <X className="h-4 w-4 mr-2 text-red-600" />
            Mark incomplete
          </ContextMenuItem>
        )}
        {onUncheck && (
          <ContextMenuItem onSelect={(e) => { e.preventDefault(); onUncheck(); }}>
            <Circle className="h-4 w-4 mr-2 text-muted-foreground" />
            Reset to pending
          </ContextMenuItem>
        )}
        {(onSkip || onSkipWithReason) && <ContextMenuSeparator />}
        {onSkip && (
          <ContextMenuItem onSelect={(e) => { e.preventDefault(); onSkip(); }}>
            <SkipForward className="h-4 w-4 mr-2 text-yellow-600" />
            Skip
          </ContextMenuItem>
        )}
        {onSkipWithReason && (
          <ContextMenuItem onSelect={(e) => { e.preventDefault(); onSkipWithReason(); }}>
            <MessageSquare className="h-4 w-4 mr-2 text-yellow-600" />
            Skip with reason
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
