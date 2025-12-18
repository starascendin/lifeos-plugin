import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { Doc } from "@holaai/convex";

interface CycleBurnupChartProps {
  snapshots: Doc<"lifeos_pmCycleSnapshots">[];
  startDate: number;
  endDate: number;
  className?: string;
  height?: number;
  showLegend?: boolean;
}

export function CycleBurnupChart({
  snapshots,
  startDate,
  endDate,
  className,
  height = 200,
  showLegend = true,
}: CycleBurnupChartProps) {
  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) {
      return [];
    }

    // Create a map of snapshots by date
    const snapshotMap = new Map<string, Doc<"lifeos_pmCycleSnapshots">>();
    for (const snapshot of snapshots) {
      snapshotMap.set(snapshot.date, snapshot);
    }

    // Generate all dates from start to end (or today if cycle is active)
    const start = new Date(startDate);
    const end = new Date(Math.min(endDate, Date.now()));
    const dates: string[] = [];
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);

    while (current <= end) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }

    // Build chart data with interpolation for missing dates
    let lastKnownData = { scopeCount: 0, startedCount: 0, completedCount: 0 };

    return dates.map((date) => {
      const snapshot = snapshotMap.get(date);
      if (snapshot) {
        lastKnownData = {
          scopeCount: snapshot.scopeCount,
          startedCount: snapshot.startedCount,
          completedCount: snapshot.completedCount,
        };
      }

      // Format date for display (e.g., "Dec 15")
      const dateObj = new Date(date);
      const displayDate = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      return {
        date,
        displayDate,
        scope: lastKnownData.scopeCount,
        started: lastKnownData.startedCount + lastKnownData.completedCount, // Cumulative started = started + completed
        completed: lastKnownData.completedCount,
      };
    });
  }, [snapshots, startDate, endDate]);

  if (chartData.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-muted-foreground ${className}`}
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="displayDate"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value, name) => {
              const labels: Record<string, string> = {
                scope: "Scope",
                started: "Started",
                completed: "Completed",
              };
              return [value as number, labels[name as string] || name];
            }}
          />
          {showLegend && (
            <Legend
              verticalAlign="top"
              height={24}
              iconType="line"
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  scope: "Scope",
                  started: "Started",
                  completed: "Completed",
                };
                return (
                  <span className="text-xs text-muted-foreground">
                    {labels[value] || value}
                  </span>
                );
              }}
            />
          )}
          {/* Scope area (gray) */}
          <Area
            type="monotone"
            dataKey="scope"
            stroke="hsl(var(--muted-foreground))"
            fill="hsl(var(--muted))"
            fillOpacity={0.3}
            strokeWidth={2}
            dot={false}
          />
          {/* Started area (yellow/amber) */}
          <Area
            type="monotone"
            dataKey="started"
            stroke="hsl(45, 93%, 47%)"
            fill="hsl(45, 93%, 47%)"
            fillOpacity={0.2}
            strokeWidth={2}
            dot={false}
          />
          {/* Completed area (blue) */}
          <Area
            type="monotone"
            dataKey="completed"
            stroke="hsl(217, 91%, 60%)"
            fill="hsl(217, 91%, 60%)"
            fillOpacity={0.4}
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Mini version for cycle list cards
export function CycleBurnupChartMini({
  snapshots,
  startDate,
  endDate,
  className,
}: Omit<CycleBurnupChartProps, "height" | "showLegend">) {
  return (
    <CycleBurnupChart
      snapshots={snapshots}
      startDate={startDate}
      endDate={endDate}
      className={className}
      height={60}
      showLegend={false}
    />
  );
}
