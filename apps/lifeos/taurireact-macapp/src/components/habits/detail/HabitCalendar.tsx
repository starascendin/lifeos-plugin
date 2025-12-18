import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Id } from "@holaai/convex";

interface HabitCalendarProps {
  habitId: Id<"lifeos_habits">;
}

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function HabitCalendar({ habitId }: HabitCalendarProps) {
  const today = new Date();
  const [viewDate, setViewDate] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });

  const calendarData = useQuery(api.lifeos.habits_checkins.getHabitCalendarData, {
    habitId,
    year: viewDate.year,
    month: viewDate.month,
  });

  const goToPreviousMonth = () => {
    setViewDate((prev) => {
      if (prev.month === 1) {
        return { year: prev.year - 1, month: 12 };
      }
      return { ...prev, month: prev.month - 1 };
    });
  };

  const goToNextMonth = () => {
    setViewDate((prev) => {
      if (prev.month === 12) {
        return { year: prev.year + 1, month: 1 };
      }
      return { ...prev, month: prev.month + 1 };
    });
  };

  const goToCurrentMonth = () => {
    setViewDate({
      year: today.getFullYear(),
      month: today.getMonth() + 1,
    });
  };

  // Generate calendar grid
  const generateCalendarDays = () => {
    const firstDay = new Date(viewDate.year, viewDate.month - 1, 1);
    const lastDay = new Date(viewDate.year, viewDate.month, 0);
    const daysInMonth = lastDay.getDate();

    // Adjust for Monday start (0 = Monday, 6 = Sunday)
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days: (number | null)[] = [];

    // Add empty cells for days before the first day
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const days = generateCalendarDays();

  const monthName = new Date(viewDate.year, viewDate.month - 1).toLocaleString(
    "default",
    { month: "long" }
  );

  const isCurrentMonth =
    viewDate.year === today.getFullYear() &&
    viewDate.month === today.getMonth() + 1;

  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      viewDate.year === today.getFullYear() &&
      viewDate.month === today.getMonth() + 1
    );
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Calendar</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPreviousMonth}
            className="h-7 w-7"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToCurrentMonth}
            className="text-sm font-medium h-7 px-2"
          >
            {monthName} {viewDate.year}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextMonth}
            className="h-7 w-7"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-muted/30 rounded-lg p-2">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_HEADERS.map((day) => (
            <div
              key={day}
              className="text-center text-xs text-muted-foreground py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            if (day === null) {
              return <div key={index} className="aspect-square" />;
            }

            const isCompleted = calendarData?.calendarData[day] ?? false;
            const isTodayDate = isToday(day);

            return (
              <div
                key={index}
                className={cn(
                  "aspect-square flex items-center justify-center rounded-md text-xs relative",
                  isTodayDate && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                  isCompleted
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <span>{day}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats for the month */}
      {calendarData && (
        <div className="text-xs text-muted-foreground text-center">
          {calendarData.completedDays} of {calendarData.scheduledDays} days
          completed ({calendarData.completionRate}%)
        </div>
      )}
    </div>
  );
}
