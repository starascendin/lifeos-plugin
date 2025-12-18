import { useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Id } from "@holaai/convex";
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  Play,
  CheckCircle,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePM, IssueStatus, CycleStatus } from "@/lib/contexts/PMContext";
import { KanbanBoardBase } from "../board/KanbanBoardBase";
import { CycleBreakdownPanel } from "./CycleBreakdownPanel";
import { cn } from "@/lib/utils";

const CYCLE_STATUS_CONFIG: Record<
  CycleStatus,
  { label: string; icon: typeof Clock; color: string; bg: string }
> = {
  upcoming: {
    label: "Upcoming",
    icon: Clock,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  active: {
    label: "Active",
    icon: Play,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color: "text-gray-500",
    bg: "bg-gray-500/10",
  },
};

export function CycleDetailView() {
  const {
    viewingCycleId,
    closeCycleDetailView,
    updateIssueStatus,
    setFilters,
    filters,
    setSelectedCycleForDetail,
  } = usePM();

  const cycleData = useQuery(
    api.lifeos.pm_cycles.getCycleWithBreakdowns,
    viewingCycleId ? { cycleId: viewingCycleId } : "skip"
  );

  const recordSnapshot = useMutation(
    api.lifeos.pm_cycle_snapshots.recordSnapshot
  );

  const handleStatusChange = useCallback(
    async (issueId: Id<"lifeos_pmIssues">, status: IssueStatus) => {
      await updateIssueStatus({ issueId, status });
    },
    [updateIssueStatus]
  );

  // Set cycle filter when entering view
  useEffect(() => {
    if (viewingCycleId) {
      // Record snapshot
      recordSnapshot({ cycleId: viewingCycleId }).catch(console.error);
      // Set filter so QuickAddIssue creates issues in this cycle
      setFilters({ ...filters, cycleId: viewingCycleId });
    }
    return () => {
      // Clear cycle filter when leaving
      setFilters({ ...filters, cycleId: undefined });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingCycleId]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeCycleDetailView();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeCycleDetailView]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatDateRange = (start: number, end: number) => {
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  if (!viewingCycleId) {
    return null;
  }

  if (cycleData === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading cycle...</div>
      </div>
    );
  }

  if (!cycleData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Cycle not found</div>
      </div>
    );
  }

  const { cycle, issuesByStatus, stats, breakdowns } = cycleData;
  const statusConfig = CYCLE_STATUS_CONFIG[cycle.status as CycleStatus];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={closeCycleDetailView}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full",
                statusConfig.bg
              )}
            >
              <RefreshCw className={cn("h-4 w-4", statusConfig.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">
                  {cycle.name || `Cycle ${cycle.number}`}
                </h1>
                <Badge
                  variant="outline"
                  className={cn(statusConfig.color, statusConfig.bg)}
                >
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDateRange(cycle.startDate, cycle.endDate)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => viewingCycleId && setSelectedCycleForDetail(viewingCycleId)}
            title="Cycle settings"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Kanban Board */}
        <div className="flex-1 overflow-hidden">
          <KanbanBoardBase
            issuesByStatus={issuesByStatus}
            onStatusChange={handleStatusChange}
            className="p-4"
          />
        </div>

        {/* Breakdown Panel */}
        <CycleBreakdownPanel
          cycleId={viewingCycleId}
          cycle={cycle}
          stats={stats}
          breakdowns={breakdowns}
        />
      </div>
    </div>
  );
}
