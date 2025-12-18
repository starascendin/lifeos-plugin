import { Calendar } from "lucide-react";
import { usePM, STATUS_CONFIG, PRIORITY_CONFIG, IssueStatus, Priority } from "@/lib/contexts/PMContext";
import { StatusSelect, PrioritySelect, LabelDisplay } from "../shared";
import { StartPomodoroButton } from "../pomodoro";
import { cn } from "@/lib/utils";
import type { Doc } from "@holaai/convex";

interface ProjectIssueRowProps {
  issue: Doc<"lifeos_pmIssues">;
  isSelected?: boolean;
}

export function ProjectIssueRow({ issue, isSelected }: ProjectIssueRowProps) {
  const { setSelectedIssueId, updateIssue, updateIssueStatus, labels } = usePM();

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const handleStatusChange = async (status: IssueStatus) => {
    await updateIssueStatus({ issueId: issue._id, status });
  };

  const handlePriorityChange = async (priority: Priority) => {
    await updateIssue({ issueId: issue._id, priority });
  };

  return (
    <div
      onClick={() => setSelectedIssueId(issue._id)}
      className={cn(
        "grid grid-cols-[32px,80px,1fr,130px,100px,100px] items-center gap-4 px-4 py-2.5 border-b border-border cursor-pointer transition-colors hover:bg-muted/50",
        isSelected && "bg-muted"
      )}
    >
      {/* Pomodoro Button */}
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <StartPomodoroButton issueId={issue._id} size="sm" />
      </div>

      {/* Identifier */}
      <div className="text-xs font-medium text-muted-foreground">
        {issue.identifier}
      </div>

      {/* Title + Labels */}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{issue.title}</div>
        {issue.labelIds.length > 0 && (
          <LabelDisplay
            labelIds={issue.labelIds}
            labels={labels}
            className="mt-1"
          />
        )}
      </div>

      {/* Status */}
      <div onClick={(e) => e.stopPropagation()}>
        <StatusSelect
          value={issue.status as IssueStatus}
          onChange={handleStatusChange}
          size="sm"
        />
      </div>

      {/* Priority */}
      <div onClick={(e) => e.stopPropagation()}>
        <PrioritySelect
          value={issue.priority as Priority}
          onChange={handlePriorityChange}
          size="sm"
        />
      </div>

      {/* Due Date */}
      <div className="text-sm text-muted-foreground">
        {issue.dueDate && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(issue.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
}
