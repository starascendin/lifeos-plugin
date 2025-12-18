import { useCallback } from "react";
import { usePM, IssueStatus } from "@/lib/contexts/PMContext";
import { KanbanBoardBase } from "./KanbanBoardBase";
import type { Id } from "@holaai/convex";
import { IssuesByStatus } from "./kanban.types";

export function KanbanBoard() {
  const { issuesByStatus, updateIssueStatus, isLoadingIssues } = usePM();

  const handleStatusChange = useCallback(
    async (issueId: Id<"lifeos_pmIssues">, status: IssueStatus) => {
      await updateIssueStatus({ issueId, status });
    },
    [updateIssueStatus]
  );

  // Ensure we have a valid object even if issuesByStatus is undefined
  const safeIssuesByStatus: IssuesByStatus = issuesByStatus || {
    backlog: [],
    todo: [],
    in_progress: [],
    in_review: [],
    done: [],
    cancelled: [],
  };

  return (
    <KanbanBoardBase
      issuesByStatus={safeIssuesByStatus}
      onStatusChange={handleStatusChange}
      isLoading={isLoadingIssues}
      emptyMessage="No issues found"
    />
  );
}
