import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import type { Id, Doc } from "@holaai/convex";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CycleStatsCard } from "./CycleStatsCard";
import { CycleBurnupChart } from "./CycleBurnupChart";
import { CycleBreakdownTabs } from "./CycleBreakdownTabs";
import { Priority } from "@/lib/contexts/PMContext";
import { cn } from "@/lib/utils";

interface CycleBreakdownPanelProps {
  cycleId: Id<"lifeos_pmCycles">;
  cycle: Doc<"lifeos_pmCycles">;
  stats: {
    scopeCount: number;
    startedCount: number;
    completedCount: number;
    todoCount: number;
    weekdaysLeft: number;
    capacityPercent: number;
    startedPercent: number;
  };
  breakdowns: {
    byPriority: {
      priority: string;
      count: number;
      percent: number;
    }[];
    byLabel: {
      labelId: Id<"lifeos_pmLabels">;
      labelName: string;
      color: string;
      count: number;
      percent: number;
    }[];
    byProject: {
      projectId: Id<"lifeos_pmProjects">;
      projectName: string;
      projectIcon?: string;
      count: number;
      percent: number;
    }[];
  };
}

export function CycleBreakdownPanel({
  cycleId,
  cycle,
  stats,
  breakdowns,
}: CycleBreakdownPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const snapshots = useQuery(api.lifeos.pm_cycle_snapshots.getCycleSnapshots, {
    cycleId,
  });

  return (
    <div
      className={cn(
        "relative flex flex-col border-l border-border bg-card transition-all duration-200",
        isCollapsed ? "w-10" : "w-80"
      )}
    >
      {/* Collapse Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "absolute z-10 h-8 w-8 rounded-full border border-border bg-background shadow-sm",
          isCollapsed ? "left-1 top-4" : "-left-4 top-4"
        )}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </Button>

      {/* Panel Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-6">
            {/* Stats Section */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Progress
              </h3>
              <CycleStatsCard stats={stats} />
            </div>

            {/* Burnup Chart Section */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Burnup Chart
              </h3>
              <div className="rounded-md border border-border bg-background p-2">
                <CycleBurnupChart
                  snapshots={snapshots || []}
                  startDate={cycle.startDate}
                  endDate={cycle.endDate}
                  height={160}
                />
              </div>
            </div>

            {/* Breakdowns Section */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Breakdowns
              </h3>
              <CycleBreakdownTabs breakdowns={breakdowns} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
