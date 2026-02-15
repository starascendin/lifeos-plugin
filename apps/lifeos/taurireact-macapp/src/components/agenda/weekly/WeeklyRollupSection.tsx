import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getScoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 8) return "text-green-500";
  if (score >= 6) return "text-yellow-500";
  if (score >= 4) return "text-orange-500";
  return "text-red-500";
}

function getScoreBg(score: number | null): string {
  if (score === null) return "bg-muted/50";
  if (score >= 8) return "bg-green-500/10";
  if (score >= 6) return "bg-yellow-500/10";
  if (score >= 4) return "bg-orange-500/10";
  return "bg-red-500/10";
}

export function WeeklyRollupSection() {
  const {
    weeklyFieldValues,
    isLoadingWeeklyData,
    getWeeklyAverage,
    weekStartDate,
  } = useAgenda();

  const average = getWeeklyAverage();

  // Generate array of dates for the week
  const getDatesForWeek = () => {
    const dates: string[] = [];
    const start = new Date(weekStartDate);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
    }
    return dates;
  };

  const dates = getDatesForWeek();

  if (isLoadingWeeklyData) {
    return (
      <div className="rounded-lg border bg-card/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Star className="h-4 w-4 text-yellow-500" />
          <h3 className="text-sm font-medium">End Day Scores</h3>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  const valuesByDate = weeklyFieldValues?.valuesByDate ?? {};

  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-500" />
          <h3 className="text-sm font-medium">End Day Scores</h3>
        </div>
        {average !== null && (
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className={cn("text-xs font-medium", getScoreColor(average))}>
              {average.toFixed(1)}
            </span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dates.map((date, i) => {
          const score = valuesByDate[date] ?? null;
          return (
            <div key={date} className="text-center">
              <div className="text-[10px] text-muted-foreground mb-0.5">
                {DAY_NAMES[i]}
              </div>
              <div
                className={cn(
                  "rounded py-1.5 px-0.5 transition-colors",
                  getScoreBg(score),
                )}
              >
                <div
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    getScoreColor(score),
                  )}
                >
                  {score ?? "-"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {average === null && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          No scores recorded
        </p>
      )}
    </div>
  );
}
