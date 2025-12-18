import { useState } from "react";
import { useHabits } from "@/lib/contexts/HabitsContext";
import { HabitsHeader } from "./HabitsHeader";
import { WeeklyHabitGrid } from "./weekly/WeeklyHabitGrid";
import { HabitDetailPanel } from "./detail/HabitDetailPanel";
import { CreateHabitDialog } from "./CreateHabitDialog";
import { CreateCategoryDialog } from "./CreateCategoryDialog";

export function HabitsTab() {
  const { selectedHabitId, setSelectedHabitId, isLoadingHabits } = useHabits();
  const [isCreateHabitOpen, setIsCreateHabitOpen] = useState(false);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <HabitsHeader
          onNewHabit={() => setIsCreateHabitOpen(true)}
          onNewCategory={() => setIsCreateCategoryOpen(true)}
        />

        <div className="flex-1 overflow-auto p-4">
          {isLoadingHabits ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading habits...
            </div>
          ) : (
            <WeeklyHabitGrid onHabitClick={setSelectedHabitId} />
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedHabitId && (
        <HabitDetailPanel
          habitId={selectedHabitId}
          onClose={() => setSelectedHabitId(null)}
        />
      )}

      {/* Dialogs */}
      <CreateHabitDialog
        open={isCreateHabitOpen}
        onOpenChange={setIsCreateHabitOpen}
      />
      <CreateCategoryDialog
        open={isCreateCategoryOpen}
        onOpenChange={setIsCreateCategoryOpen}
      />
    </div>
  );
}
