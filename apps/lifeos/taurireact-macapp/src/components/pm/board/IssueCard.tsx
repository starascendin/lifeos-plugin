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

export function IssueCard({ issue, isDragging }: IssueCardProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setSelectedIssueId(issue._id)}
      className={cn(
        "cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        (isDragging || isSortableDragging) && "opacity-50 shadow-lg",
        isDragging && "rotate-3"
      )}
    >
      {/* Identifier */}
      <div className="mb-1 flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium">
          {issue.identifier}
        </span>
        {issue.priority !== "none" && (
          <span
            className={cn(
              "text-xs font-bold",
              priorityConfig.color
            )}
          >
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

        <div className="flex items-center gap-1">
          <div
            onClick={(e) => {
              console.log("[IssueCard] Wrapper onClick - stopping propagation");
              e.stopPropagation();
            }}
            onPointerDown={(e) => {
              console.log("[IssueCard] Wrapper onPointerDown - stopping propagation");
              e.stopPropagation();
            }}
          >
            <StartPomodoroButton issueId={issue._id} size="sm" />
          </div>
          {issue.estimate && (
            <div className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {issue.estimate}pt
            </div>
          )}
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
}
