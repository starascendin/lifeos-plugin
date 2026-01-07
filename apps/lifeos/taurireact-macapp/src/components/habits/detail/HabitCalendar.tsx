import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check, X, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Id } from "@holaai/convex";

// Habit states for calendar
type HabitState = "pending" | "complete" | "incomplete" | "skipped";

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

            const state: HabitState = calendarData?.calendarData[day] ?? "pending";
            const isTodayDate = isToday(day);

            return (
              <div
                key={index}
                className={cn(
                  "aspect-square flex items-center justify-center rounded-md text-xs relative",
                  isTodayDate && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                  state === "complete" && "bg-green-500/20 text-green-600",
                  state === "incomplete" && "bg-red-500/20 text-red-600",
                  state === "skipped" && "bg-yellow-500/20 text-yellow-600",
                  state === "pending" && "text-muted-foreground"
                )}
              >
                {state === "complete" && <Check className="h-4 w-4" />}
                {state === "incomplete" && <X className="h-4 w-4" />}
                {state === "skipped" && <SkipForward className="h-3.5 w-3.5" />}
                {state === "pending" && <span>{day}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats for the month */}
      {calendarData && (
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Check className="h-3 w-3 text-green-600" />
            {calendarData.completedDays}
          </span>
          <span className="flex items-center gap-1">
            <SkipForward className="h-3 w-3 text-yellow-600" />
            {calendarData.skippedDays}
          </span>
          <span>
            {calendarData.completionRate}% of {calendarData.scheduledDays} days
          </span>
        </div>
      )}
    </div>
  );
}
