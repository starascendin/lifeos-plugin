import { Button } from "@/components/ui/button";
import { useHabits, DAY_NAMES_SHORT } from "@/lib/contexts/HabitsContext";
import { ChevronLeft, ChevronRight, Plus, FolderPlus } from "lucide-react";

interface HabitsHeaderProps {
  onNewHabit: () => void;
  onNewCategory: () => void;
}

export function HabitsHeader({ onNewHabit, onNewCategory }: HabitsHeaderProps) {
  const {
    currentWeekStart,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    getWeekDates,
  } = useHabits();

  const weekDates = getWeekDates();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if we're viewing the current week
  const isCurrentWeek =
    currentWeekStart.getTime() <=
      today.getTime() &&
    today.getTime() <=
      new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).getTime();

  // Format the week range for display
  const formatWeekRange = () => {
    const start = weekDates[0];
    const end = weekDates[6];
    const startMonth = start.toLocaleString("default", { month: "short" });
    const endMonth = end.toLocaleString("default", { month: "short" });

    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
  };

  return (
    <div className="flex items-center justify-between p-4 border-b border-border">
      {/* Left: Title and week navigation */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Habits</h1>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPreviousWeek}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={goToCurrentWeek}
            className="text-sm font-medium min-w-[180px]"
          >
            {formatWeekRange()}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextWeek}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {!isCurrentWeek && (
            <Button
              variant="outline"
              size="sm"
              onClick={goToCurrentWeek}
              className="text-xs"
            >
              Today
            </Button>
          )}
        </div>
      </div>

      {/* Right: Action buttons */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onNewCategory}>
          <FolderPlus className="h-4 w-4 mr-2" />
          Category
        </Button>
        <Button size="sm" onClick={onNewHabit}>
          <Plus className="h-4 w-4 mr-2" />
          New Habit
        </Button>
      </div>
    </div>
  );
}
