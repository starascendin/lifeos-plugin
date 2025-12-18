import { usePM, CycleStatus } from "@/lib/contexts/PMContext";
import { cn } from "@/lib/utils";
import { RefreshCw, Play, CheckCircle, Clock, LucideIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const STATUS_CONFIG: Record<CycleStatus, { label: string; icon: LucideIcon; color: string; bg: string }> = {
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

export function CycleList() {
  const { cycles, isLoadingCycles, setSelectedCycleForDetail } = usePM();

  if (isLoadingCycles) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading cycles...</div>
      </div>
    );
  }

  if (!cycles || cycles.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <RefreshCw className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h3 className="font-medium">No cycles yet</h3>
          <p className="text-sm text-muted-foreground">
            Create your first cycle to start sprint planning
          </p>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatDateRange = (start: number, end: number) => {
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  // Group cycles by status
  const activeCycles = cycles.filter((c) => c.status === "active");
  const upcomingCycles = cycles.filter((c) => c.status === "upcoming");
  const completedCycles = cycles.filter((c) => c.status === "completed");

  return (
    <div className="p-6">
      {/* Active Cycle (highlighted) */}
      {activeCycles.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Current Cycle</h2>
          {activeCycles.map((cycle) => {
            const progress =
              cycle.issueCount > 0
                ? Math.round(
                    (cycle.completedIssueCount / cycle.issueCount) * 100
                  )
                : 0;
            const statusConfig = STATUS_CONFIG[cycle.status as CycleStatus];
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={cycle._id}
                onClick={() => setSelectedCycleForDetail(cycle._id)}
                className="cursor-pointer rounded-lg border-2 border-green-500/30 bg-green-500/5 p-6 transition-colors hover:bg-green-500/10"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
                      <RefreshCw className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">
                        {cycle.name || `Cycle ${cycle.number}`}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {formatDateRange(cycle.startDate, cycle.endDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIcon className={cn("h-4 w-4", statusConfig.color)} />
                    <span className={statusConfig.color}>
                      {statusConfig.label}
                    </span>
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>Progress</span>
                    <span className="text-muted-foreground">
                      {cycle.completedIssueCount} of {cycle.issueCount} issues
                      completed
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                {/* Goals */}
                {cycle.goals && cycle.goals.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium">Goals</h4>
                    <ul className="space-y-1">
                      {cycle.goals.map((goal: string, index: number) => (
                        <li
                          key={index}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                          {goal}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upcoming Cycles */}
      {upcomingCycles.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Upcoming</h2>
          <div className="space-y-3">
            {upcomingCycles.map((cycle) => {
              const statusConfig = STATUS_CONFIG[cycle.status as CycleStatus];
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={cycle._id}
                  onClick={() => setSelectedCycleForDetail(cycle._id)}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full",
                        statusConfig.bg
                      )}
                    >
                      <RefreshCw
                        className={cn("h-4 w-4", statusConfig.color)}
                      />
                    </div>
                    <div>
                      <h3 className="font-medium">
                        {cycle.name || `Cycle ${cycle.number}`}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {formatDateRange(cycle.startDate, cycle.endDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <StatusIcon className={cn("h-4 w-4", statusConfig.color)} />
                    <span className={statusConfig.color}>
                      {statusConfig.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Cycles */}
      {completedCycles.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Completed</h2>
          <div className="space-y-3">
            {completedCycles.map((cycle) => {
              const progress =
                cycle.issueCount > 0
                  ? Math.round(
                      (cycle.completedIssueCount / cycle.issueCount) * 100
                    )
                  : 0;
              const statusConfig = STATUS_CONFIG[cycle.status as CycleStatus];

              return (
                <div
                  key={cycle._id}
                  onClick={() => setSelectedCycleForDetail(cycle._id)}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-card/50 p-4 opacity-70 transition-opacity hover:opacity-100"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full",
                        statusConfig.bg
                      )}
                    >
                      <CheckCircle
                        className={cn("h-4 w-4", statusConfig.color)}
                      />
                    </div>
                    <div>
                      <h3 className="font-medium">
                        {cycle.name || `Cycle ${cycle.number}`}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {formatDateRange(cycle.startDate, cycle.endDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      {cycle.completedIssueCount}/{cycle.issueCount} issues
                    </span>
                    <div className="flex items-center gap-2">
                      <Progress value={progress} className="h-1.5 w-16" />
                      <span className="text-xs text-muted-foreground">
                        {progress}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
