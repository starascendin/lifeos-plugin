import { useHabits } from "@/lib/contexts/HabitsContext";
import { DayCheckbox } from "./DayCheckbox";
import { cn } from "@/lib/utils";
import { Zap, Flame } from "lucide-react";
import type { Doc } from "@holaai/convex";

interface HabitRowProps {
  habit: Doc<"lifeos_habits">;
  onClick: () => void;
}

export function HabitRow({ habit, onClick }: HabitRowProps) {
  const {
    getWeekDates,
    checkIns,
    toggleCheckIn,
    formatDate,
    getCheckInKey,
    isHabitScheduledForDate,
    selectedHabitId,
  } = useHabits();

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

  return (
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

        return (
          <div key={index} className="flex justify-center">
            <DayCheckbox
              checked={isCompleted}
              scheduled={isScheduled}
              onToggle={() => handleToggle(date)}
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
  );
}
