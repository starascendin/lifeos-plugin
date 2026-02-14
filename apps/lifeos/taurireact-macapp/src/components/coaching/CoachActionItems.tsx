/**
 * CoachActionItems - Track action items across coaching sessions
 */

import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CheckSquare,
  Circle,
  ArrowUpCircle,
  Calendar,
  Loader2,
} from "lucide-react";
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
    useQuery(api.lifeos.coaching.getActionItems, {
      coachProfileId,
    }) ?? [];

  const updateItem = useMutation(api.lifeos.coaching.updateActionItem);

  const filteredItems =
    filter === "all"
      ? allItems
      : allItems.filter((item) => item.status === filter);

  const pendingCount = allItems.filter((i) => i.status === "pending").length;
  const inProgressCount = allItems.filter(
    (i) => i.status === "in_progress",
  ).length;
  const completedCount = allItems.filter(
    (i) => i.status === "completed",
  ).length;

  const handleToggleComplete = async (
    itemId: Id<"lifeos_coachingActionItems">,
    currentStatus: string,
  ) => {
    try {
      const newStatus = currentStatus === "completed" ? "pending" : "completed";
      await updateItem({
        actionItemId: itemId,
        status: newStatus,
      });
    } catch (error) {
      toast.error("Failed to update action item");
    }
  };

  const handleSetInProgress = async (
    itemId: Id<"lifeos_coachingActionItems">,
  ) => {
    try {
      await updateItem({
        actionItemId: itemId,
        status: "in_progress",
      });
    } catch (error) {
      toast.error("Failed to update action item");
    }
  };

  if (allItems.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <CheckSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">
            No action items from {coachName} yet.
          </p>
          <p className="mt-1 text-muted-foreground text-sm">
            Action items are automatically extracted when you end a coaching
            session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
      {/* Stats bar */}
      <div className="flex items-center gap-3">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All ({allItems.length})
        </Button>
        <Button
          variant={filter === "pending" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("pending")}
        >
          Pending ({pendingCount})
        </Button>
        <Button
          variant={filter === "in_progress" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("in_progress")}
        >
          In Progress ({inProgressCount})
        </Button>
        <Button
          variant={filter === "completed" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("completed")}
        >
          Done ({completedCount})
        </Button>
      </div>

      {/* Action items list */}
      <div className="space-y-2">
        {filteredItems.map((item) => {
          const priorityColors: Record<string, string> = {
            high: "text-red-500",
            medium: "text-yellow-500",
            low: "text-blue-500",
          };

          return (
            <Card key={item._id}>
              <CardContent className="flex items-start gap-3 py-3">
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
                        "line-through text-muted-foreground",
                    )}
                  >
                    {item.text}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {item.priority && (
                      <Badge
                        variant="outline"
                        className={cn("text-xs", priorityColors[item.priority])}
                      >
                        <ArrowUpCircle className="mr-1 h-3 w-3" />
                        {item.priority}
                      </Badge>
                    )}
                    {item.dueDate && (
                      <span className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Calendar className="h-3 w-3" />
                        {new Date(item.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {item.status === "in_progress" && (
                      <Badge
                        variant="secondary"
                        className="bg-blue-500/10 text-blue-600 text-xs"
                      >
                        In Progress
                      </Badge>
                    )}
                    <span className="text-muted-foreground text-xs">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {item.status === "pending" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleSetInProgress(item._id)}
                  >
                    Start
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
