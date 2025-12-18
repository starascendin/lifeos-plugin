import { useState, useCallback } from "react";
import {
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { Doc, Id } from "@holaai/convex";
import { KANBAN_COLUMNS, IssuesByStatus, IssueStatus } from "./kanban.types";

interface UseKanbanDragDropProps {
  issuesByStatus: IssuesByStatus;
  onStatusChange: (
    issueId: Id<"lifeos_pmIssues">,
    status: IssueStatus
  ) => Promise<void>;
}

export function useKanbanDragDrop({
  issuesByStatus,
  onStatusChange,
}: UseKanbanDragDropProps) {
  const [activeIssue, setActiveIssue] = useState<Doc<"lifeos_pmIssues"> | null>(
    null
  );
  const [dropTargetStatus, setDropTargetStatus] = useState<IssueStatus | null>(
    null
  );

  // Configure sensors for drag activation
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Helper to find an issue across all columns
  const findIssue = useCallback(
    (issueId: string): Doc<"lifeos_pmIssues"> | null => {
      for (const status of KANBAN_COLUMNS) {
        const issues = issuesByStatus[status];
        if (issues) {
          const issue = issues.find((i) => i._id === issueId);
          if (issue) return issue;
        }
      }
      return null;
    },
    [issuesByStatus]
  );

  // Handle drag start - find and set the active issue
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const issueId = event.active.id as string;
      const issue = findIssue(issueId);
      if (issue) {
        setActiveIssue(issue);
      }
    },
    [findIssue]
  );

  // Handle drag over - track drop target for visual feedback
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;

      if (!over) {
        setDropTargetStatus(null);
        return;
      }

      const overId = over.id as string;

      // Check if hovering over a column directly
      if (KANBAN_COLUMNS.includes(overId as IssueStatus)) {
        setDropTargetStatus(overId as IssueStatus);
      } else {
        // Hovering over a card - get its container (column) from sortable data
        const sortableData = over.data.current?.sortable as
          | { containerId?: string }
          | undefined;
        if (sortableData?.containerId) {
          setDropTargetStatus(sortableData.containerId as IssueStatus);
        } else {
          // Fallback: find the issue to get its column
          const issue = findIssue(overId);
          if (issue) {
            setDropTargetStatus(issue.status as IssueStatus);
          }
        }
      }
    },
    [findIssue]
  );

  // Handle drag end - update issue status if dropped on a different column
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      // Clear states
      setActiveIssue(null);
      setDropTargetStatus(null);

      if (!over) return;

      const issueId = active.id as string;
      const overId = over.id as string;

      // Determine the target column
      let targetStatus: IssueStatus | null = null;

      if (KANBAN_COLUMNS.includes(overId as IssueStatus)) {
        targetStatus = overId as IssueStatus;
      } else {
        // Dropped on a card - get container from sortable data or find issue
        const sortableData = over.data.current?.sortable as
          | { containerId?: string }
          | undefined;
        if (sortableData?.containerId) {
          targetStatus = sortableData.containerId as IssueStatus;
        } else {
          const overIssue = findIssue(overId);
          if (overIssue) {
            targetStatus = overIssue.status as IssueStatus;
          }
        }
      }

      if (targetStatus) {
        const issue = findIssue(issueId);
        if (issue && issue.status !== targetStatus) {
          await onStatusChange(issueId as Id<"lifeos_pmIssues">, targetStatus);
        }
      }
    },
    [findIssue, onStatusChange]
  );

  return {
    activeIssue,
    dropTargetStatus,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
