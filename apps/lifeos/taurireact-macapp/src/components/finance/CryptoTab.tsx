import { useQuery, useAction } from "convex/react";
import { api } from "@holaai/convex";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ==================== FORMATTERS ====================

function formatUsd(cents: number): string {
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return cents < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatUsdShort(cents: number): string {
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return cents < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatCrypto(amount: number): string {
  if (amount === 0) return "0";
  if (amount < 0.00001) return amount.toExponential(2);
  if (amount < 1) return amount.toFixed(6);
  if (amount < 1000) return amount.toFixed(4);
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatPrice(cents: number): string {
  const usd = cents / 100;
  if (usd < 0.01) return `$${usd.toFixed(6)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

// ==================== PORTFOLIO CHART ====================

type RangeKey = "30" | "90" | "all";

function PortfolioChart() {
  const snapshots = useQuery(api.lifeos.crypto.getSnapshots, { days: 365 });
  const [range, setRange] = useState<RangeKey>("30");

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

  if (filtered.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Portfolio Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Need at least 2 daily snapshots. Sync again tomorrow to start
            tracking.
          </p>
        </CardContent>
      </Card>
    );
  }

  const values = filtered.map((s) => s.totalUsdValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.1, 100);
  const chartMin = min - padding;
  const chartMax = max + padding;
  const chartRange = chartMax - chartMin || 1;

  const firstVal = values[0];
  const lastVal = values[values.length - 1];
  const changeCents = lastVal - firstVal;
  const changePct =
    firstVal !== 0
      ? ((changeCents / Math.abs(firstVal)) * 100).toFixed(1)
      : "0";

  const width = 800;
  const height = 200;
  const paddingX = 0;
  const paddingY = 10;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const points = filtered.map((s, i) => {
    const x = paddingX + (i / Math.max(filtered.length - 1, 1)) * chartW;
    const y =
      paddingY + chartH - ((s.totalUsdValue - chartMin) / chartRange) * chartH;
    return { x, y, snapshot: s };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = chartMin + (chartRange * i) / 4;
    const y = paddingY + chartH - (i / 4) * chartH;
    return { val, y };
  });

  const step = Math.max(1, Math.floor(filtered.length / 6));
  const xLabels = filtered
    .filter((_, i) => i % step === 0 || i === filtered.length - 1)
    .map((s) => {
      const idx = filtered.indexOf(s);
      const x = paddingX + (idx / Math.max(filtered.length - 1, 1)) * chartW;
      return { date: s.date, x };
    });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Portfolio Trend
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
          <span className="text-2xl font-bold">{formatUsdShort(lastVal)}</span>
          <span
            className={`text-sm font-medium ${changeCents >= 0 ? "text-green-500" : "text-red-500"}`}
          >
            {changeCents >= 0 ? "+" : ""}
            {formatUsdShort(changeCents)} ({changePct}%)
          </span>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <svg
          viewBox={`0 0 ${width} ${height + 24}`}
          className="w-full h-auto"
          preserveAspectRatio="none"
        >
          {yTicks.map((tick, i) => (
            <line
              key={i}
              x1={paddingX}
              x2={width}
              y1={tick.y}
              y2={tick.y}
              stroke="currentColor"
              strokeOpacity={0.07}
            />
          ))}
          <path
            d={areaD}
            fill={changeCents >= 0 ? "rgb(34,197,94)" : "rgb(239,68,68)"}
            fillOpacity={0.08}
          />
          <path
            d={pathD}
            fill="none"
            stroke={changeCents >= 0 ? "rgb(34,197,94)" : "rgb(239,68,68)"}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
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
                  {p.snapshot.date}: {formatUsdShort(p.snapshot.totalUsdValue)}
                </title>
              </circle>
            ))}
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

// ==================== ALLOCATION BAR ====================

function AllocationBar({
  holdings,
  totalUsdValue,
}: {
  holdings: Array<{ asset: string; usdValue: number }>;
  totalUsdValue: number;
}) {
  if (totalUsdValue === 0) return null;

  const COLORS = [
    "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444",
    "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
  ];

  // Top 8, rest as "Other"
  const top = holdings.slice(0, 8);
  const otherValue = holdings
    .slice(8)
    .reduce((sum, h) => sum + h.usdValue, 0);
  const items = otherValue > 0 ? [...top, { asset: "Other", usdValue: otherValue }] : top;

  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden">
        {items.map((h, i) => (
          <div
            key={h.asset}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(h.usdValue / totalUsdValue) * 100}%`,
              backgroundColor: COLORS[i % COLORS.length],
            }}
            title={`${h.asset}: ${formatUsd(h.usdValue)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map((h, i) => (
          <div key={h.asset} className="flex items-center gap-1.5 text-xs">
            <div
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-muted-foreground">{h.asset}</span>
            <span className="font-medium tabular-nums">
              {((h.usdValue / totalUsdValue) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== HOLDINGS TABLE ====================

function HoldingsTable({
  holdings,
  totalUsdValue,
}: {
  holdings: Array<{
    asset: string;
    total: number;
    usdValue: number;
    usdPrice: number;
  }>;
  totalUsdValue: number;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Asset</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right hidden sm:table-cell">Price</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead className="text-right hidden md:table-cell">%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {holdings.map((h) => {
          const pct =
            totalUsdValue > 0
              ? ((h.usdValue / totalUsdValue) * 100).toFixed(1)
              : "0";
          return (
            <TableRow key={h.asset}>
              <TableCell className="font-medium">{h.asset}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCrypto(h.total)}
              </TableCell>
              <TableCell className="text-right tabular-nums hidden sm:table-cell">
                {formatPrice(h.usdPrice)}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {formatUsd(h.usdValue)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground hidden md:table-cell">
                {pct}%
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ==================== ACCOUNT DETAIL ====================

function AccountDetail({
  accountId,
  accountName,
  totalUsdValue,
}: {
  accountId: string;
  accountName: string;
  totalUsdValue: number;
}) {
  const balances = useQuery(api.lifeos.crypto.getBalances, {
    accountId: accountId as any,
  });

  if (!balances) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  const sorted = [...balances].sort((a, b) => b.usdValue - a.usdValue);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{formatUsd(totalUsdValue)}</span>
        <span className="text-sm text-muted-foreground">
          {sorted.length} assets
        </span>
      </div>
      <AllocationBar holdings={sorted} totalUsdValue={totalUsdValue} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead className="text-right">Free</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Locked</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Price</TableHead>
            <TableHead className="text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((b) => (
            <TableRow key={b._id}>
              <TableCell className="font-medium">{b.asset}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCrypto(b.free)}
              </TableCell>
              <TableCell className="text-right tabular-nums hidden sm:table-cell">
                {formatCrypto(b.locked)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCrypto(b.total)}
              </TableCell>
              <TableCell className="text-right tabular-nums hidden sm:table-cell">
                {formatPrice(b.usdPrice)}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {formatUsd(b.usdValue)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export function CryptoTab() {
  const summary = useQuery(api.lifeos.crypto.getPortfolioSummary);
  const accounts = useQuery(api.lifeos.crypto.getAccounts);
  const syncStatus = useQuery(api.lifeos.crypto.getSyncStatus);
  const syncAll = useAction(api.lifeos.crypto_actions.syncAllAccounts);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncAll();
      toast.success(
        `Synced ${result.accountCount} accounts — ${formatUsd(result.totalUsdValue)}`,
      );
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const isRunning = syncing || syncStatus?.status === "running";

  // Empty state
  if (accounts && accounts.length === 0 && !isRunning) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">
              No crypto accounts synced yet.
            </p>
            <Button onClick={handleSync}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Binance Accounts
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sync Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {syncStatus?.lastSyncAt && (
            <span>Last synced: {timeAgo(syncStatus.lastSyncAt)}</span>
          )}
          {syncStatus?.status === "failed" && syncStatus.lastSyncError && (
            <Badge variant="destructive" className="text-xs">
              {syncStatus.lastSyncError.slice(0, 60)}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            Auto-syncs daily 6 AM UTC
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isRunning}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isRunning ? "animate-spin" : ""}`}
          />
          {isRunning ? "Syncing..." : "Sync Now"}
        </Button>
      </div>

      {/* KPI Cards */}
      {/* md:grid-cols-2 md:grid-cols-3 md:grid-cols-4 — static for Tailwind JIT */}
      <div
        className={`grid gap-4 ${
          !accounts || accounts.length === 0
            ? ""
            : accounts.length === 1
              ? "md:grid-cols-2"
              : accounts.length === 2
                ? "md:grid-cols-3"
                : "md:grid-cols-4"
        }`}
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Total Portfolio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {summary ? formatUsd(summary.totalUsdValue) : "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary?.topHoldings.length ?? 0} assets across{" "}
              {accounts?.length ?? 0} accounts
            </div>
          </CardContent>
        </Card>

        {accounts?.map((acct) => (
          <Card key={acct._id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                <span className="truncate">{acct.accountName}</span>
                <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">
                  {acct.exchange}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">
                {formatUsd(acct.totalUsdValue)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {acct.assetCount} assets
                {summary && summary.totalUsdValue > 0 && (
                  <> &middot; {((acct.totalUsdValue / summary.totalUsdValue) * 100).toFixed(1)}% of total</>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Portfolio Chart */}
      <PortfolioChart />

      {/* Allocation + Holdings in tabs: Aggregate | Per-Account */}
      {summary && summary.topHoldings.length > 0 && accounts && (
        <Tabs defaultValue="aggregate">
          <TabsList>
            <TabsTrigger value="aggregate">Aggregate</TabsTrigger>
            {accounts.map((acct) => (
              <TabsTrigger key={acct._id} value={acct._id}>
                {acct.accountName}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="aggregate" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <AllocationBar
                  holdings={summary.topHoldings}
                  totalUsdValue={summary.totalUsdValue}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All Holdings</CardTitle>
              </CardHeader>
              <CardContent>
                <HoldingsTable
                  holdings={summary.topHoldings}
                  totalUsdValue={summary.totalUsdValue}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {accounts.map((acct) => (
            <TabsContent key={acct._id} value={acct._id} className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {acct.accountName}
                    </CardTitle>
                    <Badge variant="outline">{acct.exchange}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <AccountDetail
                    accountId={acct._id}
                    accountName={acct.accountName}
                    totalUsdValue={acct.totalUsdValue}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
