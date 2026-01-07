import { useState } from "react";
import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, CheckCircle2, SkipForward, MessageSquare, Check, X, Circle } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { SkipHabitDialog } from "@/components/habits/SkipHabitDialog";
import type { Doc, Id } from "@holaai/convex";

// Habit states: pending, complete, incomplete, skipped
type HabitState = "pending" | "complete" | "incomplete" | "skipped";

interface HabitCheckItemProps {
  habit: Doc<"lifeos_habits">;
  state: HabitState;
  onToggle: () => void;
  onCheck: () => void;
  onUncheck: () => void;
  onMarkIncomplete: () => void;
  onSkip: () => void;
  onSkipWithReason: () => void;
}

function HabitCheckItem({ habit, state, onToggle, onCheck, onUncheck, onMarkIncomplete, onSkip, onSkipWithReason }: HabitCheckItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    // Prevent double-triggering when clicking the checkbox
    e.stopPropagation();
    onToggle();
  };

  const isChecked = state === "complete";
  const isSkipped = state === "skipped";
  const isIncomplete = state === "incomplete";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={handleClick}
        >
          <Checkbox
            checked={isChecked}
            onCheckedChange={() => onToggle()}
            onClick={(e) => e.stopPropagation()}
            className="h-5 w-5"
          />
          <span className="text-lg">{habit.icon}</span>
          <span
            className={`flex-1 ${isChecked ? "line-through text-muted-foreground" : ""} ${isSkipped ? "line-through text-muted-foreground italic" : ""} ${isIncomplete ? "text-red-500/70" : ""}`}
          >
            {habit.name}
          </span>
          {isChecked && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {isIncomplete && <X className="h-4 w-4 text-red-500" />}
          {isSkipped && <SkipForward className="h-4 w-4 text-yellow-500" />}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={(e) => { e.preventDefault(); onCheck(); }}>
          <Check className="h-4 w-4 mr-2 text-green-600" />
          Mark complete
        </ContextMenuItem>
        <ContextMenuItem onSelect={(e) => { e.preventDefault(); onMarkIncomplete(); }}>
          <X className="h-4 w-4 mr-2 text-red-600" />
          Mark incomplete
        </ContextMenuItem>
        <ContextMenuItem onSelect={(e) => { e.preventDefault(); onUncheck(); }}>
          <Circle className="h-4 w-4 mr-2 text-muted-foreground" />
          Reset to pending
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={(e) => { e.preventDefault(); onSkip(); }}>
          <SkipForward className="h-4 w-4 mr-2 text-yellow-600" />
          Skip
        </ContextMenuItem>
        <ContextMenuItem onSelect={(e) => { e.preventDefault(); onSkipWithReason(); }}>
          <MessageSquare className="h-4 w-4 mr-2 text-yellow-600" />
          Skip with reason
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function HabitsSection() {
  const {
    todaysHabits,
    todaysCheckIns,
    isLoadingHabits,
    toggleHabitCheckIn,
    skipHabitCheckIn,
    checkHabit,
    uncheckHabit,
    markIncomplete,
    dateString,
    isHabitCompleted,
  } = useAgenda();

  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [selectedHabitForSkip, setSelectedHabitForSkip] = useState<Doc<"lifeos_habits"> | null>(null);

  const handleToggle = async (habitId: Id<"lifeos_habits">) => {
    await toggleHabitCheckIn({
      habitId,
      date: dateString,
    });
  };

  const handleCheck = async (habitId: Id<"lifeos_habits">) => {
    try {
      await checkHabit({
        habitId,
        date: dateString,
      });
    } catch (error) {
      console.error("Failed to check habit:", error);
    }
  };

  const handleUncheck = async (habitId: Id<"lifeos_habits">) => {
    try {
      await uncheckHabit({
        habitId,
        date: dateString,
      });
    } catch (error) {
      console.error("Failed to uncheck habit:", error);
    }
  };

  const handleQuickSkip = async (habitId: Id<"lifeos_habits">) => {
    try {
      await skipHabitCheckIn({
        habitId,
        date: dateString,
      });
    } catch (error) {
      console.error("Failed to skip habit:", error);
    }
  };

  const handleMarkIncomplete = async (habitId: Id<"lifeos_habits">) => {
    try {
      await markIncomplete({
        habitId,
        date: dateString,
      });
    } catch (error) {
      console.error("Failed to mark habit incomplete:", error);
    }
  };

  const handleSkipWithReasonClick = (habit: Doc<"lifeos_habits">) => {
    setSelectedHabitForSkip(habit);
    setSkipDialogOpen(true);
  };

  const handleSkipConfirm = async (reason?: string) => {
    if (!selectedHabitForSkip) return;
    try {
      await skipHabitCheckIn({
        habitId: selectedHabitForSkip._id,
        date: dateString,
        reason,
      });
    } catch (error) {
      console.error("Failed to skip habit:", error);
    }
  };

  const getHabitState = (habitId: Id<"lifeos_habits">): HabitState => {
    if (!todaysCheckIns) return "pending";
    const key = `${habitId}_${dateString}`;
    const checkIn = todaysCheckIns[key];
    if (!checkIn) return "pending";
    if (checkIn.completed) return "complete";
    if (checkIn.skipped) return "skipped";
    // Record exists but not completed and not skipped = incomplete
    return "incomplete";
  };

  // Calculate completion stats
  const completedCount =
    todaysHabits?.filter((h) => isHabitCompleted(h._id)).length ?? 0;
  const totalCount = todaysHabits?.length ?? 0;
  const completionPercentage =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5" />
              Today's Habits
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {completedCount}/{totalCount} ({completionPercentage}%)
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoadingHabits ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : todaysHabits && todaysHabits.length > 0 ? (
            <div className="space-y-1">
              {todaysHabits.map((habit) => (
                <HabitCheckItem
                  key={habit._id}
                  habit={habit}
                  state={getHabitState(habit._id)}
                  onToggle={() => handleToggle(habit._id)}
                  onCheck={() => handleCheck(habit._id)}
                  onUncheck={() => handleUncheck(habit._id)}
                  onMarkIncomplete={() => handleMarkIncomplete(habit._id)}
                  onSkip={() => handleQuickSkip(habit._id)}
                  onSkipWithReason={() => handleSkipWithReasonClick(habit)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No habits scheduled for today</p>
            </div>
          )}
        </CardContent>
      </Card>

      <SkipHabitDialog
        open={skipDialogOpen}
        onOpenChange={setSkipDialogOpen}
        habitName={selectedHabitForSkip?.name ?? ""}
        onConfirm={handleSkipConfirm}
      />
    </>
  );
}
