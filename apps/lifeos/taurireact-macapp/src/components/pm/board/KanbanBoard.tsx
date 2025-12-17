import { usePM, IssueStatus, STATUS_CONFIG } from "@/lib/contexts/PMContext";
import { KanbanColumn } from "./KanbanColumn";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState } from "react";
import { IssueCard } from "./IssueCard";
import type { Doc } from "@holaai/convex";

const COLUMNS: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
];

export function KanbanBoard() {
  const { issuesByStatus, updateIssueStatus, isLoadingIssues } = usePM();
  const [activeIssue, setActiveIssue] = useState<Doc<"lifeos_pmIssues"> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const issueId = active.id as string;

    // Find the issue across all columns
    if (issuesByStatus) {
      for (const status of COLUMNS) {
        const issue = issuesByStatus[status]?.find(
          (i) => i._id === issueId
        );
        if (issue) {
          setActiveIssue(issue);
          break;
        }
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveIssue(null);

    if (!over) return;

    const issueId = active.id as string;
    const overId = over.id as string;

    // Check if dropped over a column
    if (COLUMNS.includes(overId as IssueStatus)) {
      const newStatus = overId as IssueStatus;

      // Find current status
      if (issuesByStatus) {
        for (const status of COLUMNS) {
          const issue = issuesByStatus[status]?.find(
            (i) => i._id === issueId
          );
          if (issue && issue.status !== newStatus) {
            // Update issue status
            await updateIssueStatus({
              issueId: issueId as any,
              status: newStatus,
            });
            break;
          }
        }
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Visual feedback during drag
  };

  if (isLoadingIssues) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading issues...</div>
      </div>
    );
  }

  if (!issuesByStatus) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">No issues found</div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex h-full gap-4 overflow-x-auto p-6">
        {COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            issues={issuesByStatus[status] || []}
            config={STATUS_CONFIG[status]}
          />
        ))}
      </div>

      <DragOverlay>
        {activeIssue && (
          <IssueCard issue={activeIssue} isDragging />
        )}
      </DragOverlay>
    </DndContext>
  );
}
