/**
 * CoachActionItems - Track action items from coaching sessions.
 * Clean list with inline status toggles.
 */

import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CheckSquare, ArrowUpCircle, Calendar, Play } from "lucide-react";
import { useState } from "react";

interface CoachActionItemsProps {
  coachProfileId: Id<"lifeos_coachingProfiles">;
  coachName: string;
}

type FilterStatus = "all" | "pending" | "in_progress" | "completed";

export function CoachActionItems({
  coachProfileId,
  coachName,
}: CoachActionItemsProps) {
  const [filter, setFilter] = useState<FilterStatus>("all");

  const allItems =
    useQuery(api.lifeos.coaching.getActionItems, { coachProfileId }) ?? [];
  const updateItem = useMutation(api.lifeos.coaching.updateActionItem);

  const filteredItems =
    filter === "all"
      ? allItems
      : allItems.filter((item) => item.status === filter);

  const counts = {
    all: allItems.length,
    pending: allItems.filter((i) => i.status === "pending").length,
    in_progress: allItems.filter((i) => i.status === "in_progress").length,
    completed: allItems.filter((i) => i.status === "completed").length,
  };

  const handleToggleComplete = async (
    itemId: Id<"lifeos_coachingActionItems">,
    currentStatus: string,
  ) => {
    try {
      await updateItem({
        actionItemId: itemId,
        status: currentStatus === "completed" ? "pending" : "completed",
      });
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleSetInProgress = async (
    itemId: Id<"lifeos_coachingActionItems">,
  ) => {
    try {
      await updateItem({ actionItemId: itemId, status: "in_progress" });
    } catch {
      toast.error("Failed to update");
    }
  };

  if (allItems.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="text-center">
          <CheckSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No action items from {coachName} yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Items are extracted when you end a session.
          </p>
        </div>
      </div>
    );
  }

  const filters: { key: FilterStatus; label: string }[] = [
    { key: "all", label: `All (${counts.all})` },
    { key: "pending", label: `Pending (${counts.pending})` },
    { key: "in_progress", label: `Active (${counts.in_progress})` },
    { key: "completed", label: `Done (${counts.completed})` },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-3 md:px-4">
      {/* Filters */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {filters.map(({ key, label }) => (
          <Button
            key={key}
            variant={filter === key ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Items */}
      <div className="space-y-0.5">
        {filteredItems.map((item) => {
          const priorityColors: Record<string, string> = {
            high: "text-red-500",
            medium: "text-yellow-500",
            low: "text-blue-500",
          };

          return (
            <div
              key={item._id}
              className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/30"
            >
              <Checkbox
                checked={item.status === "completed"}
                onCheckedChange={() =>
                  handleToggleComplete(item._id, item.status)
                }
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm",
                    item.status === "completed" &&
                      "text-muted-foreground line-through",
                  )}
                >
                  {item.text}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {item.priority && (
                    <span
                      className={cn(
                        "flex items-center gap-0.5 text-[10px]",
                        priorityColors[item.priority],
                      )}
                    >
                      <ArrowUpCircle className="h-3 w-3" />
                      {item.priority}
                    </span>
                  )}
                  {item.dueDate && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(item.dueDate).toLocaleDateString()}
                    </span>
                  )}
                  {item.status === "in_progress" && (
                    <Badge
                      variant="secondary"
                      className="bg-blue-500/10 text-blue-600 text-[10px]"
                    >
                      In Progress
                    </Badge>
                  )}
                </div>
              </div>
              {item.status === "pending" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0"
                  onClick={() => handleSetInProgress(item._id)}
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
