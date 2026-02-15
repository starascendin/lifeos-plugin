import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, CheckCircle2, X, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "@holaai/convex";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type HabitState = "pending" | "complete" | "incomplete" | "skipped";

function getHabitState(
  checkIns: Record<string, Doc<"lifeos_habitCheckIns">> | undefined,
  habitId: Id<"lifeos_habits">,
  date: string,
): HabitState {
  if (!checkIns) return "pending";
  const key = `${habitId}_${date}`;
  const checkIn = checkIns[key];
  if (!checkIn) return "pending";
  if (checkIn.completed) return "complete";
  if (checkIn.skipped) return "skipped";
  return "incomplete";
}

function StateCellIcon({ state }: { state: HabitState }) {
  switch (state) {
    case "complete":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case "incomplete":
      return <X className="h-3.5 w-3.5 text-red-500" />;
    case "skipped":
      return <SkipForward className="h-3.5 w-3.5 text-yellow-500" />;
    default:
      return <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30" />;
  }
}

function getStateBg(state: HabitState): string {
  switch (state) {
    case "complete":
      return "bg-green-500/10";
    case "incomplete":
      return "bg-red-500/10";
    case "skipped":
      return "bg-yellow-500/10";
    default:
      return "bg-muted/30";
  }
}

function isHabitScheduledForDate(
  habit: Doc<"lifeos_habits">,
  date: Date,
): boolean {
  if (habit.frequency === "daily") return true;
  if (habit.frequency === "weekly" && habit.targetDays) {
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ] as const;
    const dayOfWeek = dayNames[date.getDay()];
    return habit.targetDays.includes(dayOfWeek);
  }
  return false;
}

export function WeeklyHabitsSection() {
  const {
    weeklyHabits,
    weeklyCheckIns,
    isLoadingWeeklyHabits,
    weekStartDate,
  } = useAgenda();

  // Generate dates for the week
  const dates: string[] = [];
  const start = new Date(weekStartDate + "T00:00:00");
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
  }

  if (isLoadingWeeklyHabits) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Target className="h-5 w-5 text-emerald-500" />
            Habits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const habits = weeklyHabits ?? [];

  if (habits.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Target className="h-5 w-5 text-emerald-500" />
            Habits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No habits tracked</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate stats
  let totalScheduled = 0;
  let totalCompleted = 0;
  for (const habit of habits) {
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      if (isHabitScheduledForDate(habit, d)) {
        totalScheduled++;
        const state = getHabitState(weeklyCheckIns, habit._id, dates[i]);
        if (state === "complete") totalCompleted++;
      }
    }
  }

  const completionRate =
    totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Target className="h-5 w-5 text-emerald-500" />
            Habits
          </CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {totalCompleted}/{totalScheduled}
            </span>
            <span
              className={cn(
                "font-medium tabular-nums",
                completionRate >= 80
                  ? "text-green-500"
                  : completionRate >= 50
                    ? "text-yellow-500"
                    : "text-red-500",
              )}
            >
              {completionRate}%
            </span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Day headers */}
        <div className="grid grid-cols-[1fr_repeat(7,_minmax(0,_1fr))] gap-1 mb-1">
          <div /> {/* Empty cell for habit name column */}
          {dates.map((date, i) => {
            const d = new Date(date + "T00:00:00");
            return (
              <div key={date} className="text-center">
                <div className="text-[10px] text-muted-foreground leading-tight">
                  {DAY_LABELS[i]}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Habit rows */}
        <div className="space-y-0.5">
          {habits.map((habit) => {
            // Count completions for this habit
            let habitCompleted = 0;
            let habitScheduled = 0;
            for (let i = 0; i < 7; i++) {
              const d = new Date(start);
              d.setDate(d.getDate() + i);
              if (isHabitScheduledForDate(habit, d)) {
                habitScheduled++;
                if (
                  getHabitState(weeklyCheckIns, habit._id, dates[i]) ===
                  "complete"
                )
                  habitCompleted++;
              }
            }

            return (
              <div
                key={habit._id}
                className="grid grid-cols-[1fr_repeat(7,_minmax(0,_1fr))] gap-1 items-center py-0.5"
              >
                {/* Habit name */}
                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                  <span className="text-sm leading-none">{habit.icon}</span>
                  <span className="text-xs truncate">{habit.name}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums ml-auto flex-shrink-0">
                    {habitCompleted}/{habitScheduled}
                  </span>
                </div>

                {/* Day cells */}
                {dates.map((date, i) => {
                  const d = new Date(start);
                  d.setDate(d.getDate() + i);
                  const scheduled = isHabitScheduledForDate(habit, d);

                  if (!scheduled) {
                    return (
                      <div
                        key={date}
                        className="flex items-center justify-center h-7 rounded bg-muted/20"
                      >
                        <span className="text-[10px] text-muted-foreground/40">
                          -
                        </span>
                      </div>
                    );
                  }

                  const state = getHabitState(
                    weeklyCheckIns,
                    habit._id,
                    date,
                  );
                  return (
                    <div
                      key={date}
                      className={cn(
                        "flex items-center justify-center h-7 rounded transition-colors",
                        getStateBg(state),
                      )}
                    >
                      <StateCellIcon state={state} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
