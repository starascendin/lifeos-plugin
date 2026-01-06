import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Star className="h-5 w-5 text-yellow-500" />
            End Day Scores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="text-center">
                <Skeleton className="h-4 w-8 mx-auto mb-2" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const valuesByDate = weeklyFieldValues?.valuesByDate ?? {};

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Star className="h-5 w-5 text-yellow-500" />
            End Day Scores
          </CardTitle>
          {average !== null && (
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                Weekly Avg:{" "}
                <span className={getScoreColor(average)}>
                  {average.toFixed(1)}/10
                </span>
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {dates.map((date, i) => {
            const score = valuesByDate[date] ?? null;
            const dayDate = new Date(date);
            const dayNum = dayDate.getDate();

            return (
              <div key={date} className="text-center">
                <div className="text-xs text-muted-foreground mb-1">
                  {DAY_NAMES[i]}
                </div>
                <div
                  className={cn(
                    "rounded-lg py-3 px-1 transition-colors",
                    getScoreBg(score)
                  )}
                >
                  <div
                    className={cn(
                      "text-xl font-semibold",
                      getScoreColor(score)
                    )}
                  >
                    {score ?? "-"}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {dayNum}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {average === null && (
          <p className="text-sm text-muted-foreground text-center mt-4">
            No scores recorded for this week yet
          </p>
        )}
      </CardContent>
    </Card>
  );
}
