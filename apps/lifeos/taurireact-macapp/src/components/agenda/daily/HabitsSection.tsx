import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, CheckCircle2 } from "lucide-react";
import type { Doc, Id } from "@holaai/convex";

interface HabitCheckItemProps {
  habit: Doc<"lifeos_habits">;
  isChecked: boolean;
  onToggle: () => void;
}

function HabitCheckItem({ habit, isChecked, onToggle }: HabitCheckItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    // Prevent double-triggering when clicking the checkbox
    e.stopPropagation();
    onToggle();
  };

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={handleClick}
    >
      <Checkbox
        checked={isChecked}
        onCheckedChange={() => onToggle()}
        onClick={(e) => e.stopPropagation()}
        className="h-5 w-5"
      />
      <span className="text-lg">{habit.icon}</span>
      <span
        className={`flex-1 ${isChecked ? "line-through text-muted-foreground" : ""}`}
      >
        {habit.name}
      </span>
      {isChecked && <CheckCircle2 className="h-4 w-4 text-green-500" />}
    </div>
  );
}

export function HabitsSection() {
  const {
    todaysHabits,
    todaysCheckIns,
    isLoadingHabits,
    toggleHabitCheckIn,
    dateString,
    isHabitCompleted,
  } = useAgenda();

  const handleToggle = async (habitId: Id<"lifeos_habits">) => {
    await toggleHabitCheckIn({
      habitId,
      date: dateString,
    });
  };

  // Calculate completion stats
  const completedCount =
    todaysHabits?.filter((h) => isHabitCompleted(h._id)).length ?? 0;
  const totalCount = todaysHabits?.length ?? 0;
  const completionPercentage =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5" />
            Today's Habits
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            {completedCount}/{totalCount} ({completionPercentage}%)
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoadingHabits ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : todaysHabits && todaysHabits.length > 0 ? (
          <div className="space-y-1">
            {todaysHabits.map((habit) => (
              <HabitCheckItem
                key={habit._id}
                habit={habit}
                isChecked={isHabitCompleted(habit._id)}
                onToggle={() => handleToggle(habit._id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No habits scheduled for today</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
