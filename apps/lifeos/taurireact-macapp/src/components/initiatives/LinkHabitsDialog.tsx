import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Id, Doc } from "@holaai/convex";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Target, Check, Loader2 } from "lucide-react";

// Note: These API paths will be available after running `convex codegen`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const habitsApi = (api as any).lifeos.habits;

interface LinkHabitsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initiativeId: Id<"lifeos_yearlyInitiatives">;
  initiativeColor?: string;
  currentlyLinkedIds: Id<"lifeos_habits">[];
}

export function LinkHabitsDialog({
  open,
  onOpenChange,
  initiativeId,
  initiativeColor = "#6366f1",
  currentlyLinkedIds,
}: LinkHabitsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<Id<"lifeos_habits">>>(
    new Set(currentlyLinkedIds),
  );
  const [isSaving, setIsSaving] = useState(false);

  // Get all user's habits
  const allHabits = useQuery(habitsApi.getHabits, {});
  const updateHabit = useMutation(habitsApi.updateHabit);

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(currentlyLinkedIds));
    }
  }, [open, currentlyLinkedIds]);

  const handleToggle = (habitId: Id<"lifeos_habits">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(habitId)) {
        next.delete(habitId);
      } else {
        next.add(habitId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const currentSet = new Set(currentlyLinkedIds);
      const newSet = selectedIds;

      // Find habits to link (in newSet but not in currentSet)
      const toLink = [...newSet].filter((id) => !currentSet.has(id));

      // Find habits to unlink (in currentSet but not in newSet)
      const toUnlink = [...currentSet].filter((id) => !newSet.has(id));

      // Perform updates
      await Promise.all([
        ...toLink.map((habitId) => updateHabit({ habitId, initiativeId })),
        ...toUnlink.map((habitId) =>
          updateHabit({ habitId, initiativeId: null }),
        ),
      ]);

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update habit links:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = () => {
    const currentSet = new Set(currentlyLinkedIds);
    if (currentSet.size !== selectedIds.size) return true;
    for (const id of selectedIds) {
      if (!currentSet.has(id)) return true;
    }
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Link Habits
          </DialogTitle>
          <DialogDescription>
            Select habits to link to this initiative. Linked habits help track
            consistency toward your goals.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          {allHabits === undefined ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : allHabits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No habits found</p>
              <p className="text-xs">Create a habit first to link it here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allHabits.map((habit: Doc<"lifeos_habits">) => {
                const isSelected = selectedIds.has(habit._id);
                const isLinkedToOther =
                  habit.initiativeId && habit.initiativeId !== initiativeId;

                return (
                  <button
                    key={habit._id}
                    onClick={() => !isLinkedToOther && handleToggle(habit._id)}
                    disabled={isLinkedToOther}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      isLinkedToOther
                        ? "opacity-50 cursor-not-allowed bg-muted/30"
                        : isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent/50"
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isLinkedToOther}
                      className="pointer-events-none"
                    />
                    <div
                      className="w-2 h-8 rounded-full shrink-0"
                      style={{
                        backgroundColor: isSelected
                          ? initiativeColor
                          : habit.color || "#6366f1",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate flex items-center gap-2">
                        {habit.icon && <span>{habit.icon}</span>}
                        {habit.name}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="capitalize">{habit.frequency}</span>
                        {isLinkedToOther && (
                          <Badge variant="secondary" className="text-[10px]">
                            Linked to another
                          </Badge>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges()}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save Changes
                {hasChanges() && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {selectedIds.size}
                  </Badge>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
