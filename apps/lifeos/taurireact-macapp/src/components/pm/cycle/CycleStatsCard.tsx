import { Target, PlayCircle, CheckCircle2, Calendar } from "lucide-react";

interface CycleStatsCardProps {
  stats: {
    scopeCount: number;
    startedCount: number;
    completedCount: number;
    todoCount: number;
    weekdaysLeft: number;
    capacityPercent: number;
    startedPercent: number;
  };
}

export function CycleStatsCard({ stats }: CycleStatsCardProps) {
  return (
    <div className="space-y-3">
      {/* Progress Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <StatItem
          icon={<Target className="h-3.5 w-3.5 text-muted-foreground" />}
          label="Scope"
          value={stats.scopeCount}
          subtext="issues"
        />
        <StatItem
          icon={<PlayCircle className="h-3.5 w-3.5 text-yellow-500" />}
          label="Started"
          value={stats.startedCount}
          percent={stats.startedPercent}
        />
        <StatItem
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
          label="Completed"
          value={stats.completedCount}
          percent={stats.capacityPercent}
        />
      </div>

      {/* Time and Capacity Row */}
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">
            {stats.weekdaysLeft} weekdays left
          </span>
        </div>
        <div className="text-sm font-medium">
          {stats.capacityPercent}% of capacity
        </div>
      </div>
    </div>
  );
}

function StatItem({
  icon,
  label,
  value,
  subtext,
  percent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtext?: string;
  percent?: number;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-semibold">{value}</span>
        {percent !== undefined && (
          <span className="text-xs text-muted-foreground">({percent}%)</span>
        )}
        {subtext && (
          <span className="text-xs text-muted-foreground">{subtext}</span>
        )}
      </div>
    </div>
  );
}
