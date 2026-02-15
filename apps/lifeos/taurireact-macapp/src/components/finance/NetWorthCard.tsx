import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return cents < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function NetWorthCard() {
  const summary = useQuery(api.lifeos.finance.getNetWorthSummary);
  const snapshots = useQuery(api.lifeos.finance.getSnapshots, { days: 7 });

  if (!summary) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-20 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  // Find yesterday's snapshot to show daily change
  const sorted = snapshots
    ? [...snapshots].sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const prevSnapshot = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const dailyChange = prevSnapshot
    ? summary.netWorth - prevSnapshot.netWorthCents
    : null;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Net Worth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {formatCents(summary.netWorth)}
          </div>
          {dailyChange !== null && (
            <p
              className={`text-sm mt-1 ${dailyChange >= 0 ? "text-green-500" : "text-red-500"}`}
            >
              {dailyChange >= 0 ? "+" : ""}
              {formatCents(dailyChange)} from yesterday
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Total Assets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-green-600">
            {formatCents(summary.totalAssets)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            Total Liabilities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-red-500">
            {formatCents(summary.totalLiabilities)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
