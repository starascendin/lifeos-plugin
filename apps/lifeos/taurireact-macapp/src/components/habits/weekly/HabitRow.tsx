import { useState } from "react";
import { useHabits } from "@/lib/contexts/HabitsContext";
import { DayCheckbox } from "./DayCheckbox";
import { cn } from "@/lib/utils";
import { Zap, Flame } from "lucide-react";
import type { Doc } from "@holaai/convex";
import { SkipHabitDialog } from "../SkipHabitDialog";

interface HabitRowProps {
  habit: Doc<"lifeos_habits">;
  onClick: () => void;
}

export function HabitRow({ habit, onClick }: HabitRowProps) {
  const {
    getWeekDates,
    checkIns,
    toggleCheckIn,
    skipCheckIn,
    checkHabit,
    uncheckHabit,
    markIncomplete,
    formatDate,
    getCheckInKey,
    isHabitScheduledForDate,
    selectedHabitId,
  } = useHabits();

  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [selectedDateForSkip, setSelectedDateForSkip] = useState<string>("");
  const weekDates = getWeekDates();
  const isSelected = selectedHabitId === habit._id;

  const handleToggle = async (date: Date) => {
    try {
      await toggleCheckIn({
        habitId: habit._id,
        date: formatDate(date),
      });
    } catch (error) {
      console.error("Failed to toggle check-in:", error);
    }
  };

  const handleCheckForDate = async (date: Date) => {
    try {
      await checkHabit({
        habitId: habit._id,
        date: formatDate(date),
      });
    } catch (error) {
      console.error("Failed to check habit:", error);
    }
  };

  const handleUncheckForDate = async (date: Date) => {
    try {
      await uncheckHabit({
        habitId: habit._id,
        date: formatDate(date),
      });
    } catch (error) {
      console.error("Failed to uncheck habit:", error);
    }
  };

  const handleQuickSkipForDate = async (date: Date) => {
    try {
      await skipCheckIn({
        habitId: habit._id,
        date: formatDate(date),
      });
    } catch (error) {
      console.error("Failed to skip habit:", error);
    }
  };

  const handleMarkIncompleteForDate = async (date: Date) => {
    try {
      await markIncomplete({
        habitId: habit._id,
        date: formatDate(date),
      });
    } catch (error) {
      console.error("Failed to mark habit incomplete:", error);
    }
  };

  const handleOpenSkipWithReason = (date: Date) => {
    setSelectedDateForSkip(formatDate(date));
    setSkipDialogOpen(true);
  };

  const handleSkipWithReason = async (reason?: string) => {
    if (!selectedDateForSkip) return;
    try {
      await skipCheckIn({
        habitId: habit._id,
        date: selectedDateForSkip,
        reason,
      });
    } catch (error) {
      console.error("Failed to skip habit:", error);
    }
  };

  return (
    <>
      <div
        className={cn(
          "grid grid-cols-[2fr_repeat(7,1fr)_60px_60px] gap-1 px-2 py-2 items-center rounded-md cursor-pointer transition-colors",
          isSelected
            ? "bg-primary/10 border border-primary/30"
            : "hover:bg-muted/50 border border-transparent"
        )}
        onClick={onClick}
      >
        {/* Habit info */}
        <div className="flex items-center gap-2 pl-6 min-w-0">
          <span className="text-lg flex-shrink-0">{habit.icon || "✅"}</span>
          <span className="text-sm font-medium truncate">{habit.name}</span>
        </div>

        {/* Day checkboxes */}
        {weekDates.map((date, index) => {
          const key = getCheckInKey(habit._id, date);
          const checkIn = checkIns?.[key];
          const isScheduled = isHabitScheduledForDate(habit, date);
          const isCompleted = checkIn?.completed ?? false;
          const isSkipped = checkIn?.skipped ?? false;
          // incomplete = record exists with completed=false and skipped=false
          const isIncomplete = checkIn && !checkIn.completed && !checkIn.skipped;

          return (
            <div key={index} className="flex justify-center">
              <DayCheckbox
                checked={isCompleted}
                scheduled={isScheduled}
                skipped={isSkipped}
                incomplete={isIncomplete}
                onToggle={() => handleToggle(date)}
                onCheck={() => handleCheckForDate(date)}
                onUncheck={() => handleUncheckForDate(date)}
                onMarkIncomplete={() => handleMarkIncompleteForDate(date)}
                onSkip={() => handleQuickSkipForDate(date)}
                onSkipWithReason={() => handleOpenSkipWithReason(date)}
              />
            </div>
          );
        })}

        {/* Total completions */}
        <div className="flex items-center justify-center gap-1 text-sm">
          <Zap className="h-3.5 w-3.5 text-yellow-500" />
          <span className="text-muted-foreground">{habit.totalCompletions}</span>
        </div>

        {/* Current streak */}
        <div className="flex items-center justify-center gap-1 text-sm">
          <Flame className="h-3.5 w-3.5 text-orange-500" />
          <span className="text-muted-foreground">{habit.currentStreak}</span>
        </div>
      </div>

      <SkipHabitDialog
        open={skipDialogOpen}
        onOpenChange={setSkipDialogOpen}
        habitName={habit.name}
        onConfirm={handleSkipWithReason}
      />
    </>
  );
}
