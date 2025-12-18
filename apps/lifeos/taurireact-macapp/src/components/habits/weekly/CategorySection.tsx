import { useState } from "react";
import { useHabits } from "@/lib/contexts/HabitsContext";
import { HabitRow } from "./HabitRow";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "@holaai/convex";

interface CategorySectionProps {
  category: Doc<"lifeos_habitCategories"> | null;
  habits: Doc<"lifeos_habits">[];
  onHabitClick: (id: Id<"lifeos_habits">) => void;
}

export function CategorySection({
  category,
  habits,
  onHabitClick,
}: CategorySectionProps) {
  const { toggleCategoryCollapsed } = useHabits();
  const [localCollapsed, setLocalCollapsed] = useState(category?.isCollapsed ?? false);

  // For uncategorized habits
  if (!category) {
    if (habits.length === 0) return null;

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-muted-foreground">
          <span className="text-base">📋</span>
          <span>Uncategorized</span>
          <span className="text-xs text-muted-foreground/70">{habits.length}</span>
        </div>
        {habits.map((habit) => (
          <HabitRow key={habit._id} habit={habit} onClick={() => onHabitClick(habit._id)} />
        ))}
      </div>
    );
  }

  const isCollapsed = localCollapsed;

  const handleToggle = async () => {
    setLocalCollapsed(!isCollapsed);
    try {
      await toggleCategoryCollapsed({ categoryId: category._id });
    } catch (error) {
      // Revert on error
      setLocalCollapsed(isCollapsed);
    }
  };

  return (
    <div className="space-y-1">
      {/* Category header */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 px-2 py-1.5 w-full text-left hover:bg-muted/50 rounded-md transition-colors"
      >
        <span className="text-muted-foreground">
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
        <span className="text-base">{category.icon || "📋"}</span>
        <span className="text-sm font-medium">{category.name}</span>
        <span className="text-xs text-muted-foreground/70">{habits.length}</span>
      </button>

      {/* Habits */}
      {!isCollapsed && (
        <div className="space-y-0.5">
          {habits.map((habit) => (
            <HabitRow
              key={habit._id}
              habit={habit}
              onClick={() => onHabitClick(habit._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
