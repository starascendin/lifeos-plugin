import React, { useState, useCallback, useMemo } from "react";
import { IssueStatus } from "@/lib/contexts/PMContext";
import type { Doc } from "@holaai/convex";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { IssueCard } from "./IssueCard";
import { QuickAddIssue } from "./QuickAddIssue";
import { cn } from "@/lib/utils";
import { Plus, Hexagon } from "lucide-react";

interface KanbanColumnProps {
  status: IssueStatus;
  issues: Doc<"lifeos_pmIssues">[];
  config: { label: string; color: string; bgColor: string };
  isDropTarget?: boolean;
}

export const KanbanColumn = React.memo(function KanbanColumn({
  status,
  issues,
  config,
  isDropTarget = false,
}: KanbanColumnProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  // Show highlight when dragging over this column
  const showDropHighlight = isOver || isDropTarget;

  const handleAddClick = useCallback(() => {
    setShowQuickAdd(true);
  }, []);

  const handleQuickAddClose = useCallback(() => {
    setShowQuickAdd(false);
  }, []);

  // Memoize sortable items to prevent unnecessary re-renders
  const sortableItems = useMemo(() => issues.map((i) => i._id), [issues]);

  const totalPoints = useMemo(
    () => issues.reduce((sum, i) => sum + (i.estimate ?? 0), 0),
    [issues],
  );

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-72 flex-shrink-0 flex-col rounded-lg bg-muted/30 transition-all duration-150",
        showDropHighlight && "ring-2 ring-primary/50 bg-primary/5"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              config.color.replace("text-", "bg-")
            )}
          />
          <span className="font-medium text-sm">{config.label}</span>
          <span className="text-muted-foreground text-xs">{issues.length}</span>
          {totalPoints > 0 && (
            <span className="flex items-center gap-0.5 text-muted-foreground text-[10px]">
              <Hexagon className="h-2.5 w-2.5" />
              {totalPoints}
            </span>
          )}
        </div>
        <button
          onClick={handleAddClick}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Issues */}
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <IssueCard key={issue._id} issue={issue} />
          ))}
        </SortableContext>

        {showQuickAdd && (
          <QuickAddIssue status={status} onClose={handleQuickAddClose} />
        )}

        {issues.length === 0 && !showQuickAdd && (
          <div className="flex h-20 items-center justify-center text-muted-foreground text-xs">
            No issues
          </div>
        )}
      </div>
    </div>
  );
});
