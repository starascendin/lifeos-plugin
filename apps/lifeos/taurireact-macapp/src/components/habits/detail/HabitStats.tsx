import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Zap, Flame, Percent } from "lucide-react";
import type { Doc } from "@holaai/convex";

interface HabitWithStats extends Doc<"lifeos_habits"> {
  monthlyCompletions: number;
  scheduledDaysThisMonth: number;
  monthlyCompletionRate: number;
}

interface HabitStatsProps {
  habit: HabitWithStats;
}

export function HabitStats({ habit }: HabitStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Monthly check-ins */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-xs">Monthly</span>
          </div>
          <div className="text-lg font-semibold">
            {habit.monthlyCompletions}
            <span className="text-sm text-muted-foreground font-normal">
              {" "}/ {habit.scheduledDaysThisMonth}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Total check-ins */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span className="text-xs">Total</span>
          </div>
          <div className="text-lg font-semibold">
            {habit.totalCompletions}
            <span className="text-sm text-muted-foreground font-normal"> days</span>
          </div>
        </CardContent>
      </Card>

      {/* Completion rate */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Percent className="h-4 w-4 text-blue-500" />
            <span className="text-xs">Rate</span>
          </div>
          <div className="text-lg font-semibold">
            {habit.monthlyCompletionRate}
            <span className="text-sm text-muted-foreground font-normal">%</span>
          </div>
        </CardContent>
      </Card>

      {/* Current streak */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-xs">Streak</span>
          </div>
          <div className="text-lg font-semibold">
            {habit.currentStreak}
            <span className="text-sm text-muted-foreground font-normal"> days</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
