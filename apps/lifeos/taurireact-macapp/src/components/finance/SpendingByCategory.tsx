import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${formatted}`;
}

const BAR_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-green-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-sky-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-purple-500",
  "bg-fuchsia-500",
  "bg-pink-500",
];

export function SpendingByCategory() {
  const transactions = useQuery(api.lifeos.finance.getTransactions, {
    limit: 200,
  });

  const categoryData = useMemo(() => {
    if (!transactions) return [];

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // Filter to outflows in last 30 days
    const recent = transactions.filter(
      (t) => t.dateMs >= thirtyDaysAgo && t.amountCents < 0,
    );

    // Group by category
    const byCategory = new Map<string, number>();
    for (const txn of recent) {
      const cat = txn.category;
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + Math.abs(txn.amountCents));
    }

    // Sort by amount descending
    return Array.from(byCategory.entries())
      .map(([category, totalCents]) => ({ category, totalCents }))
      .sort((a, b) => b.totalCents - a.totalCents);
  }, [transactions]);

  if (!transactions) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-40 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (categoryData.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No spending data in the last 30 days.
        </CardContent>
      </Card>
    );
  }

  const maxAmount = categoryData[0]?.totalCents ?? 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Spending by Category
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            (Last 30 days)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {categoryData.map((item, i) => {
            const widthPct = Math.max(
              (item.totalCents / maxAmount) * 100,
              2,
            );
            const color = BAR_COLORS[i % BAR_COLORS.length];
            return (
              <div key={item.category} className="flex items-center gap-3">
                <div className="w-[140px] text-sm truncate text-right text-muted-foreground">
                  {item.category}
                </div>
                <div className="flex-1 h-6 bg-muted rounded-sm overflow-hidden">
                  <div
                    className={`h-full ${color} rounded-sm transition-all`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <div className="w-[90px] text-sm tabular-nums text-right font-medium">
                  {formatCents(item.totalCents)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
