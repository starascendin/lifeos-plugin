import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { useHabits } from "@/lib/contexts/HabitsContext";
import { HabitStats } from "./HabitStats";
import { HabitCalendar } from "./HabitCalendar";
import { Button } from "@/components/ui/button";
import { X, MoreHorizontal, Archive, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Id } from "@holaai/convex";
import { useState } from "react";

interface HabitDetailPanelProps {
  habitId: Id<"lifeos_habits">;
  onClose: () => void;
}

export function HabitDetailPanel({ habitId, onClose }: HabitDetailPanelProps) {
  const { archiveHabit, deleteHabit, categories } = useHabits();
  const [isDeleting, setIsDeleting] = useState(false);

  const habitWithStats = useQuery(api.lifeos.habits.getHabitWithStats, {
    habitId,
  });

  if (!habitWithStats) {
    return (
      <div className="w-80 border-l border-border bg-background p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-32 bg-muted animate-pulse rounded" />
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4">
          <div className="h-20 bg-muted animate-pulse rounded" />
          <div className="h-48 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  const category = categories?.find((c) => c._id === habitWithStats.categoryId);

  const handleArchive = async () => {
    try {
      await archiveHabit({ habitId });
      onClose();
    } catch (error) {
      console.error("Failed to archive habit:", error);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this habit? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteHabit({ habitId });
      onClose();
    } catch (error) {
      console.error("Failed to delete habit:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-80 border-l border-border bg-background flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">{habitWithStats.icon || "✅"}</span>
          <h2 className="font-semibold truncate">{habitWithStats.name}</h2>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive"
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? "Deleting..." : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Stats */}
        <HabitStats habit={habitWithStats} />

        {/* Calendar */}
        <HabitCalendar habitId={habitId} />

        {/* Properties */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Properties</h3>

          {category && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Category</span>
              <span>
                {category.icon} {category.name}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Frequency</span>
            <span className="capitalize">{habitWithStats.frequency}</span>
          </div>

          {habitWithStats.frequency === "weekly" && habitWithStats.targetDays && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Days</span>
              <span className="text-right">
                {habitWithStats.targetDays
                  .map((d) => d.slice(0, 3))
                  .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
                  .join(", ")}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Best Streak</span>
            <span>{habitWithStats.longestStreak} days</span>
          </div>

          {habitWithStats.description && (
            <div className="pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground">
                {habitWithStats.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
