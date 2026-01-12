import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Id, Doc } from "@holaai/convex";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, Target } from "lucide-react";

// Note: These API paths will be available after running `convex codegen`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const habitsApi = (api as any).lifeos.habits;

interface LinkHabitsDropdownProps {
  initiativeId: Id<"lifeos_yearlyInitiatives">;
  initiativeColor?: string;
  currentlyLinkedIds: Id<"lifeos_habits">[];
}

export function LinkHabitsDropdown({
  initiativeId,
  initiativeColor = "#6366f1",
  currentlyLinkedIds,
}: LinkHabitsDropdownProps) {
  const [open, setOpen] = useState(false);

  // Get all user's habits
  const allHabits = useQuery(habitsApi.getHabits, {});
  const updateHabit = useMutation(habitsApi.updateHabit);

  const linkedSet = useMemo(
    () => new Set(currentlyLinkedIds),
    [currentlyLinkedIds],
  );

  const handleToggle = async (habit: Doc<"lifeos_habits">) => {
    const isCurrentlyLinked = linkedSet.has(habit._id);

    try {
      await updateHabit({
        habitId: habit._id,
        initiativeId: isCurrentlyLinked ? null : initiativeId,
      });
    } catch (error) {
      console.error("Failed to update habit link:", error);
    }
  };

  // Separate linked and available habits
  const { linkedHabits, availableHabits } = useMemo(() => {
    if (!allHabits) return { linkedHabits: [], availableHabits: [] };

    const linked: Doc<"lifeos_habits">[] = [];
    const available: Doc<"lifeos_habits">[] = [];

    for (const habit of allHabits) {
      if (linkedSet.has(habit._id)) {
        linked.push(habit);
      } else if (!habit.initiativeId) {
        // Only show unlinked habits as available
        available.push(habit);
      }
    }

    return { linkedHabits: linked, availableHabits: available };
  }, [allHabits, linkedSet]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-3 w-3 mr-1" />
          Link Habit
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search habits..." />
          <CommandList>
            <CommandEmpty>
              <div className="py-4 text-center text-sm text-muted-foreground">
                <Target className="h-6 w-6 mx-auto mb-2 opacity-50" />
                No habits found
              </div>
            </CommandEmpty>

            {linkedHabits.length > 0 && (
              <CommandGroup heading="Linked">
                {linkedHabits.map((habit) => (
                  <CommandItem
                    key={habit._id}
                    value={habit.name}
                    onSelect={() => handleToggle(habit)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <div
                        className="w-2 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: initiativeColor }}
                      />
                      {habit.icon && (
                        <span className="text-sm">{habit.icon}</span>
                      )}
                      <span className="truncate">{habit.name}</span>
                      <Badge
                        variant="secondary"
                        className="ml-auto text-[10px] capitalize"
                      >
                        {habit.frequency}
                      </Badge>
                    </div>
                    <Check className="h-4 w-4 text-primary ml-2" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {availableHabits.length > 0 && (
              <CommandGroup heading="Available">
                {availableHabits.map((habit) => (
                  <CommandItem
                    key={habit._id}
                    value={habit.name}
                    onSelect={() => handleToggle(habit)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <div
                        className="w-2 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: habit.color || "#6366f1" }}
                      />
                      {habit.icon && (
                        <span className="text-sm">{habit.icon}</span>
                      )}
                      <span className="truncate">{habit.name}</span>
                      <Badge
                        variant="secondary"
                        className="ml-auto text-[10px] capitalize"
                      >
                        {habit.frequency}
                      </Badge>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Keep old export name for backward compatibility, but it's now a dropdown
export { LinkHabitsDropdown as LinkHabitsDialog };
