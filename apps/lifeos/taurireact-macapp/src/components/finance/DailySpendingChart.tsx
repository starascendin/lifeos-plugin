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
  return `$${formatted}`;
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

type RangeKey = "7" | "14" | "30";

export function DailySpendingChart() {
  const dailyData = useQuery(api.lifeos.finance.getDailySpending, { days: 30 });
  const [range, setRange] = useState<RangeKey>("30");

  const filtered = useMemo(() => {
    if (!dailyData || dailyData.length === 0) return [];
    const days = parseInt(range);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return dailyData.filter((d) => d.date >= cutoff);
  }, [dailyData, range]);

  const totals = useMemo(() => {
    let income = 0;
    let spending = 0;
    for (const d of filtered) {
      income += d.income;
      spending += d.spending;
    }
    return { income, spending, net: income - spending };
  }, [filtered]);

  if (!dailyData) {
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
            Daily Cash Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No transaction data in this period.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxAmount = Math.max(
    ...filtered.map((d) => Math.max(d.income, d.spending)),
    1,
  );

  // SVG dimensions
  const width = 800;
  const height = 180;
  const barAreaH = 140;
  const barWidth = Math.min(
    (width - 20) / filtered.length - 2,
    24,
  );
  const gap = Math.max(((width - 20) / filtered.length - barWidth), 2);
  const totalBarWidth = barWidth + gap;

  // X-axis labels — show ~8 dates
  const step = Math.max(1, Math.floor(filtered.length / 8));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Daily Cash Flow
          </CardTitle>
          <div className="flex items-center gap-1">
            {(["7", "14", "30"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2 py-0.5 text-xs rounded ${
                  range === r
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-green-500">
            +{formatCents(totals.income)} in
          </span>
          <span className="text-red-500">
            -{formatCents(totals.spending)} out
          </span>
          <span
            className={`font-medium ${totals.net >= 0 ? "text-green-600" : "text-red-600"}`}
          >
            Net: {totals.net >= 0 ? "+" : "-"}{formatCents(Math.abs(totals.net))}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <svg
          viewBox={`0 0 ${width} ${height + 24}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Zero line */}
          <line
            x1={10}
            x2={width - 10}
            y1={barAreaH}
            y2={barAreaH}
            stroke="currentColor"
            strokeOpacity={0.1}
          />

          {/* Bars */}
          {filtered.map((d, i) => {
            const x = 10 + i * totalBarWidth;
            const incomeH = (d.income / maxAmount) * barAreaH;
            const spendingH = (d.spending / maxAmount) * barAreaH;

            return (
              <g key={d.date}>
                {/* Income bar (green, goes up) */}
                {d.income > 0 && (
                  <rect
                    x={x}
                    y={barAreaH - incomeH}
                    width={barWidth / 2}
                    height={incomeH}
                    fill="rgb(34,197,94)"
                    fillOpacity={0.7}
                    rx={1}
                  >
                    <title>
                      {d.date}: +{formatCents(d.income)} income
                    </title>
                  </rect>
                )}
                {/* Spending bar (red, goes up from same baseline) */}
                {d.spending > 0 && (
                  <rect
                    x={x + barWidth / 2}
                    y={barAreaH - spendingH}
                    width={barWidth / 2}
                    height={spendingH}
                    fill="rgb(239,68,68)"
                    fillOpacity={0.7}
                    rx={1}
                  >
                    <title>
                      {d.date}: -{formatCents(d.spending)} spending
                    </title>
                  </rect>
                )}
              </g>
            );
          })}

          {/* X-axis labels */}
          {filtered.map(
            (d, i) =>
              (i % step === 0 || i === filtered.length - 1) && (
                <text
                  key={d.date}
                  x={10 + i * totalBarWidth + barWidth / 2}
                  y={height + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fill="currentColor"
                  fillOpacity={0.4}
                >
                  {formatDate(d.date)}
                </text>
              ),
          )}
        </svg>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-green-500/70" />
            Income
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-red-500/70" />
            Spending
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
