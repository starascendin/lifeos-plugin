import { useHabits } from "@/lib/contexts/HabitsContext";
import { WeekHeader } from "./WeekHeader";
import { CategorySection } from "./CategorySection";
import type { Id } from "@holaai/convex";

interface WeeklyHabitGridProps {
  onHabitClick: (id: Id<"lifeos_habits">) => void;
}

export function WeeklyHabitGrid({ onHabitClick }: WeeklyHabitGridProps) {
  const { habitsByCategory, isLoadingHabits } = useHabits();

  if (isLoadingHabits || !habitsByCategory) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading habits...
      </div>
    );
  }

  if (habitsByCategory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-lg mb-2">No habits yet</p>
        <p className="text-sm">Create your first habit to start tracking!</p>
      </div>
    );
  }

  // Check if there are any habits at all
  const totalHabits = habitsByCategory.reduce(
    (sum, group) => sum + group.habits.length,
    0
  );

  if (totalHabits === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-lg mb-2">No habits yet</p>
        <p className="text-sm">Create your first habit to start tracking!</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Week header with day columns */}
      <WeekHeader />

      {/* Category sections with habits */}
      {habitsByCategory.map((group) => {
        // Don't render empty categories (unless they're the uncategorized group)
        if (group.habits.length === 0 && group.category !== null) {
          return null;
        }

        return (
          <CategorySection
            key={group.category?._id ?? "uncategorized"}
            category={group.category}
            habits={group.habits}
            onHabitClick={onHabitClick}
          />
        );
      })}
    </div>
  );
}
