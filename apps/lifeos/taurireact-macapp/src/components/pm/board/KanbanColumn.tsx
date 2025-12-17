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
import { Plus } from "lucide-react";
import { useState } from "react";

interface KanbanColumnProps {
  status: IssueStatus;
  issues: Doc<"lifeos_pmIssues">[];
  config: { label: string; color: string; bgColor: string };
}

export function KanbanColumn({ status, issues, config }: KanbanColumnProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-72 flex-shrink-0 flex-col rounded-lg bg-muted/30",
        isOver && "ring-2 ring-primary/50"
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
          <span className="text-muted-foreground text-xs">
            {issues.length}
          </span>
        </div>
        <button
          onClick={() => setShowQuickAdd(true)}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Issues */}
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        <SortableContext
          items={issues.map((i) => i._id)}
          strategy={verticalListSortingStrategy}
        >
          {issues.map((issue) => (
            <IssueCard key={issue._id} issue={issue} />
          ))}
        </SortableContext>

        {showQuickAdd && (
          <QuickAddIssue
            status={status}
            onClose={() => setShowQuickAdd(false)}
          />
        )}

        {issues.length === 0 && !showQuickAdd && (
          <div className="flex h-20 items-center justify-center text-muted-foreground text-xs">
            No issues
          </div>
        )}
      </div>
    </div>
  );
}
