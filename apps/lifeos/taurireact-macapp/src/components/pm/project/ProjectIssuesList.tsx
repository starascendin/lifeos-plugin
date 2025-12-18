import { useState } from "react";
import { ListFilter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePM, STATUS_CONFIG, IssueStatus, Priority } from "@/lib/contexts/PMContext";
import { ProjectIssueRow } from "./ProjectIssueRow";
import { QuickAddIssueRow } from "./QuickAddIssueRow";
import type { Doc, Id } from "@holaai/convex";

interface ProjectIssuesListProps {
  projectId: Id<"lifeos_pmProjects">;
  issues: Doc<"lifeos_pmIssues">[] | undefined;
}

const STATUS_OPTIONS: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
];

const PRIORITY_OPTIONS: Priority[] = ["urgent", "high", "medium", "low", "none"];

export function ProjectIssuesList({ projectId, issues }: ProjectIssuesListProps) {
  const { selectedIssueId } = usePM();
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");

  // Filter issues
  const filteredIssues = issues?.filter((issue) => {
    if (statusFilter !== "all" && issue.status !== statusFilter) return false;
    if (priorityFilter !== "all" && issue.priority !== priorityFilter) return false;
    return true;
  });

  // Sort by status priority then creation time
  const sortedIssues = filteredIssues?.sort((a, b) => {
    const statusOrder: Record<IssueStatus, number> = {
      in_progress: 0,
      in_review: 1,
      todo: 2,
      backlog: 3,
      done: 4,
      cancelled: 5,
    };
    const statusDiff = statusOrder[a.status as IssueStatus] - statusOrder[b.status as IssueStatus];
    if (statusDiff !== 0) return statusDiff;
    return b._creationTime - a._creationTime;
  });

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-medium">Issues</h3>
        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as IssueStatus | "all")}
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_CONFIG[status].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Priority Filter */}
          <Select
            value={priorityFilter}
            onValueChange={(value) => setPriorityFilter(value as Priority | "all")}
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              {PRIORITY_OPTIONS.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {priority === "none" ? "No Priority" : priority.charAt(0).toUpperCase() + priority.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[32px,80px,1fr,130px,100px,100px] items-center gap-4 bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
        <div></div>
        <div>ID</div>
        <div>Title</div>
        <div>Status</div>
        <div>Priority</div>
        <div>Due</div>
      </div>

      {/* Issues */}
      <div className="max-h-[500px] overflow-auto">
        {sortedIssues === undefined ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Loading issues...
          </div>
        ) : sortedIssues.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {issues?.length === 0 ? "No issues yet" : "No issues match filters"}
          </div>
        ) : (
          sortedIssues.map((issue) => (
            <ProjectIssueRow
              key={issue._id}
              issue={issue}
              isSelected={issue._id === selectedIssueId}
            />
          ))
        )}
      </div>

      {/* Quick Add */}
      <QuickAddIssueRow projectId={projectId} />
    </div>
  );
}
