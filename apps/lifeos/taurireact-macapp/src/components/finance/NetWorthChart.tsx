import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState } from "react";

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return cents < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

type RangeKey = "30" | "90" | "all";

export function NetWorthChart() {
  const snapshots = useQuery(api.lifeos.finance.getSnapshots, { days: 365 });
  const [range, setRange] = useState<RangeKey>("90");

  const filtered = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];
    const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
    if (range === "all") return sorted;
    const days = range === "30" ? 30 : 90;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return sorted.filter((s) => s.date >= cutoff);
  }, [snapshots, range]);

  if (!snapshots) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-48 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (filtered.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Net Worth Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No snapshots yet. Sync your accounts to start tracking.
          </p>
        </CardContent>
      </Card>
    );
  }

  const values = filtered.map((s) => s.netWorthCents);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.1, 100); // at least $1 padding
  const chartMin = min - padding;
  const chartMax = max + padding;
  const chartRange = chartMax - chartMin || 1;

  // Calculate change from first to last
  const firstVal = values[0];
  const lastVal = values[values.length - 1];
  const changeCents = lastVal - firstVal;
  const changePct =
    firstVal !== 0 ? ((changeCents / Math.abs(firstVal)) * 100).toFixed(1) : "0";

  // SVG dimensions
  const width = 800;
  const height = 200;
  const paddingX = 0;
  const paddingY = 10;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  // Build path
  const points = filtered.map((s, i) => {
    const x = paddingX + (i / Math.max(filtered.length - 1, 1)) * chartW;
    const y =
      paddingY +
      chartH -
      ((s.netWorthCents - chartMin) / chartRange) * chartH;
    return { x, y, snapshot: s };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Area fill (path down to bottom)
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  // Y-axis labels (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = chartMin + (chartRange * i) / 4;
    const y = paddingY + chartH - (i / 4) * chartH;
    return { val, y };
  });

  // X-axis labels (show ~6 dates)
  const step = Math.max(1, Math.floor(filtered.length / 6));
  const xLabels = filtered
    .filter((_, i) => i % step === 0 || i === filtered.length - 1)
    .map((s, _, arr) => {
      const idx = filtered.indexOf(s);
      const x = paddingX + (idx / Math.max(filtered.length - 1, 1)) * chartW;
      return { date: s.date, x };
    });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Net Worth Trend
          </CardTitle>
          <div className="flex items-center gap-1">
            {(["30", "90", "all"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2 py-0.5 text-xs rounded ${
                  range === r
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {r === "all" ? "All" : `${r}d`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{formatCents(lastVal)}</span>
          <span
            className={`text-sm font-medium ${changeCents >= 0 ? "text-green-500" : "text-red-500"}`}
          >
            {changeCents >= 0 ? "+" : ""}
            {formatCents(changeCents)} ({changePct}%)
          </span>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <svg
          viewBox={`0 0 ${width} ${height + 24}`}
          className="w-full h-auto"
          preserveAspectRatio="none"
        >
          {/* Y grid lines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={paddingX}
                x2={width}
                y1={tick.y}
                y2={tick.y}
                stroke="currentColor"
                strokeOpacity={0.07}
              />
            </g>
          ))}

          {/* Area fill */}
          <path
            d={areaD}
            fill={changeCents >= 0 ? "rgb(34,197,94)" : "rgb(239,68,68)"}
            fillOpacity={0.08}
          />

          {/* Line */}
          <path
            d={pathD}
            fill="none"
            stroke={changeCents >= 0 ? "rgb(34,197,94)" : "rgb(239,68,68)"}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />

          {/* Data points (only if few enough) */}
          {filtered.length <= 60 &&
            points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={3}
                fill={changeCents >= 0 ? "rgb(34,197,94)" : "rgb(239,68,68)"}
                vectorEffect="non-scaling-stroke"
              >
                <title>
                  {p.snapshot.date}: {formatCents(p.snapshot.netWorthCents)}
                </title>
              </circle>
            ))}

          {/* X-axis labels */}
          {xLabels.map((l, i) => (
            <text
              key={i}
              x={l.x}
              y={height + 16}
              textAnchor="middle"
              fontSize={11}
              fill="currentColor"
              fillOpacity={0.4}
            >
              {formatDate(l.date)}
            </text>
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}
