import { Circle, Calendar, Plus } from "lucide-react";
import { usePM, STATUS_CONFIG, PRIORITY_CONFIG, IssueStatus, Priority } from "@/lib/contexts/PMContext";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "@holaai/convex";
import { Button } from "@/components/ui/button";

interface PhaseIssuesListProps {
  issues: Doc<"lifeos_pmIssues">[];
  onAddIssue?: () => void;
}

export function PhaseIssuesList({ issues, onAddIssue }: PhaseIssuesListProps) {
  const { setSelectedIssueId, selectedIssueId } = usePM();

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  if (issues.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-muted-foreground mb-2">No issues in this phase</p>
        {onAddIssue && (
          <Button variant="ghost" size="sm" onClick={onAddIssue}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add issue
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {issues.map((issue) => {
        const statusConfig = STATUS_CONFIG[issue.status as IssueStatus];
        const priorityConfig = PRIORITY_CONFIG[issue.priority as Priority];
        const isSelected = selectedIssueId === issue._id;

        return (
          <div
            key={issue._id}
            onClick={() => setSelectedIssueId(issue._id)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors hover:bg-muted/50",
              isSelected && "bg-muted"
            )}
          >
            {/* Status Indicator */}
            <span
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                statusConfig.color.replace("text-", "bg-")
              )}
            />

            {/* Identifier */}
            <span className="text-xs font-mono text-muted-foreground shrink-0">
              {issue.identifier}
            </span>

            {/* Title */}
            <span className="text-sm truncate flex-1">{issue.title}</span>

            {/* Priority Badge */}
            {issue.priority !== "none" && (
              <span
                className={cn(
                  "text-xs font-medium px-1.5 py-0.5 rounded shrink-0",
                  priorityConfig.color
                )}
              >
                {priorityConfig.icon}
              </span>
            )}

            {/* Due Date */}
            {issue.dueDate && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Calendar className="h-3 w-3" />
                {formatDate(issue.dueDate)}
              </span>
            )}
          </div>
        );
      })}

      {onAddIssue && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={onAddIssue}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add issue
        </Button>
      )}
    </div>
  );
}
