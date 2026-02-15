import React, { useCallback } from "react";
import type { Doc } from "@holaai/convex";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { PRIORITY_CONFIG, usePM, Priority } from "@/lib/contexts/PMContext";
import { Calendar } from "lucide-react";
import { StartPomodoroButton } from "../pomodoro";

interface IssueCardProps {
  issue: Doc<"lifeos_pmIssues">;
  isDragging?: boolean;
}

export const IssueCard = React.memo(function IssueCard({
  issue,
  isDragging,
}: IssueCardProps) {
  const { setSelectedIssueId } = usePM();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: issue._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityConfig = PRIORITY_CONFIG[issue.priority as Priority];

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleCardClick = useCallback(() => {
    setSelectedIssueId(issue._id);
  }, [setSelectedIssueId, issue._id]);

  const handleButtonWrapperClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleButtonWrapperPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
      className={cn(
        "cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        (isDragging || isSortableDragging) && "opacity-50 shadow-lg",
        isDragging && "rotate-3"
      )}
    >
      {/* Identifier + meta */}
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">
          {issue.identifier}
        </span>
        {issue.estimate != null && issue.estimate > 0 && (
          <span className="rounded-sm bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary tabular-nums">
            {issue.estimate}pt
          </span>
        )}
        <div className="flex-1" />
        {issue.priority !== "none" && (
          <span className={cn("text-xs font-bold", priorityConfig.color)}>
            {priorityConfig.icon}
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="mb-2 line-clamp-2 text-sm font-medium leading-tight">
        {issue.title}
      </h4>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {issue.dueDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(issue.dueDate)}</span>
            </div>
          )}
        </div>

        <div
          onClick={handleButtonWrapperClick}
          onPointerDown={handleButtonWrapperPointerDown}
        >
          <StartPomodoroButton issueId={issue._id} size="sm" />
        </div>
      </div>

      {/* Labels */}
      {issue.labelIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {/* Labels would be rendered here with label data */}
        </div>
      )}
    </div>
  );
});
