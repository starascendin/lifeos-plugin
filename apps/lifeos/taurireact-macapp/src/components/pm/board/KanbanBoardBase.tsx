import { DndContext, DragOverlay, closestCorners } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { KanbanColumn } from "./KanbanColumn";
import { IssueCard } from "./IssueCard";
import { useKanbanDragDrop } from "./useKanbanDragDrop";
import {
  KANBAN_COLUMNS,
  STATUS_CONFIG,
  KanbanBoardBaseProps,
} from "./kanban.types";

export function KanbanBoardBase({
  issuesByStatus,
  onStatusChange,
  isLoading = false,
  emptyMessage = "No issues found",
  className,
}: KanbanBoardBaseProps) {
  const {
    activeIssue,
    dropTargetStatus,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useKanbanDragDrop({ issuesByStatus, onStatusChange });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading issues...</div>
      </div>
    );
  }

  // Check if all columns are empty
  const isEmpty = KANBAN_COLUMNS.every(
    (status) => !issuesByStatus[status] || issuesByStatus[status].length === 0
  );

  if (isEmpty && emptyMessage) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={cn("flex h-full gap-4 overflow-x-auto p-6", className)}>
        {KANBAN_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            issues={issuesByStatus[status] || []}
            config={STATUS_CONFIG[status]}
            isDropTarget={dropTargetStatus === status}
          />
        ))}
      </div>

      <DragOverlay>
        {activeIssue && <IssueCard issue={activeIssue} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}
