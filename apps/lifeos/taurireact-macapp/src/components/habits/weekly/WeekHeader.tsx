import { useHabits, DAY_NAMES_SHORT } from "@/lib/contexts/HabitsContext";
import { cn } from "@/lib/utils";

export function WeekHeader() {
  const { getWeekDates } = useHabits();
  const weekDates = getWeekDates();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="grid grid-cols-[2fr_repeat(7,1fr)_60px_60px] gap-1 px-2 py-2 text-sm font-medium text-muted-foreground sticky top-0 bg-background z-10 border-b border-border">
      {/* Habit name column */}
      <div className="pl-8">Habit</div>

      {/* Day columns */}
      {weekDates.map((date, index) => {
        const isToday = date.getTime() === today.getTime();
        const dayName = DAY_NAMES_SHORT[date.getDay()];
        const dayNumber = date.getDate();

        return (
          <div
            key={index}
            className={cn(
              "text-center flex flex-col items-center",
              isToday && "text-primary"
            )}
          >
            <span className="text-xs">{dayName}</span>
            <span
              className={cn(
                "text-sm font-semibold",
                isToday &&
                  "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
              )}
            >
              {dayNumber}
            </span>
          </div>
        );
      })}

      {/* Stats columns */}
      <div className="text-center text-xs">Total</div>
      <div className="text-center text-xs">Streak</div>
    </div>
  );
}
