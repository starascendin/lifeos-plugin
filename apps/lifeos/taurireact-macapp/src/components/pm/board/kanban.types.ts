import type { Doc, Id } from "@holaai/convex";
import { IssueStatus, STATUS_CONFIG } from "@/lib/contexts/PMContext";

// Column order for kanban board
export const KANBAN_COLUMNS: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
];

// Re-export for convenience
export { STATUS_CONFIG };
export type { IssueStatus };

// Type for issues grouped by status
export type IssuesByStatus = Record<IssueStatus, Doc<"lifeos_pmIssues">[]>;

// Props for the base kanban board component
export interface KanbanBoardBaseProps {
  issuesByStatus: IssuesByStatus;
  onStatusChange: (
    issueId: Id<"lifeos_pmIssues">,
    status: IssueStatus
  ) => Promise<void>;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

// Return type for the drag-drop hook
export interface UseKanbanDragDropReturn {
  activeIssue: Doc<"lifeos_pmIssues"> | null;
  dropTargetStatus: IssueStatus | null;
  sensors: ReturnType<typeof import("@dnd-kit/core").useSensors>;
  handleDragStart: (event: import("@dnd-kit/core").DragStartEvent) => void;
  handleDragEnd: (event: import("@dnd-kit/core").DragEndEvent) => void;
  handleDragOver: (event: import("@dnd-kit/core").DragOverEvent) => void;
}
