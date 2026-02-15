import { useQuery, useMutation } from "convex/react";
import { useConvex } from "convex/react";
import { api } from "@holaai/convex";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Play, Clock, Settings2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  syncEmpowerToConvex,
  scrapeAndSyncEmpower,
  type EmpowerSyncProgress,
} from "@/lib/services/empower";
import type { ConvexClient } from "convex/browser";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

const CRON_PRESETS: { label: string; cron: string }[] = [
  { label: "Every 6h", cron: "0 */6 * * *" },
  { label: "Every 12h", cron: "0 */12 * * *" },
  { label: "Daily 8am", cron: "0 8 * * *" },
  { label: "Daily midnight", cron: "0 0 * * *" },
];

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, mon, dow] = parts;

  // Every N hours
  if (min === "0" && hour.startsWith("*/") && dom === "*" && mon === "*" && dow === "*") {
    return `Every ${hour.slice(2)}h`;
  }
  // Daily at specific hour
  if (min === "0" && /^\d+$/.test(hour) && dom === "*" && mon === "*" && dow === "*") {
    const h = parseInt(hour);
    const ampm = h >= 12 ? "pm" : "am";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Daily at ${h12}${ampm}`;
  }
  return expr;
}

export function SyncStatusBar() {
  const syncStatus = useQuery(api.lifeos.finance.getSyncStatus);
  const updateCronSchedule = useMutation(api.lifeos.finance.updateCronSchedule);
  const convex = useConvex();
  const [syncing, setSyncing] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [progress, setProgress] = useState<EmpowerSyncProgress | null>(null);
  const [showCronEditor, setShowCronEditor] = useState(false);
  const [cronExpr, setCronExpr] = useState("0 */6 * * *");
  const [cronEnabled, setCronEnabled] = useState(false);
  const [cronLoaded, setCronLoaded] = useState(false);

  // Load cron schedule from Tauri store on mount
  useEffect(() => {
    if (!isTauri || cronLoaded) return;
    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const schedule = await invoke<{
          cronExpression: string;
          cronEnabled: boolean;
        }>("get_empower_schedule");
        setCronExpr(schedule.cronExpression);
        setCronEnabled(schedule.cronEnabled);
      } catch (e) {
        console.error("Failed to load empower schedule:", e);
      }
      setCronLoaded(true);
    })();
  }, [cronLoaded]);

  // Also sync from Convex if available (in case store hasn't been set yet)
  useEffect(() => {
    if (syncStatus?.cronExpression && !cronLoaded) {
      setCronExpr(syncStatus.cronExpression);
      setCronEnabled(syncStatus.cronEnabled ?? false);
    }
  }, [syncStatus, cronLoaded]);

  const handleSaveCron = useCallback(
    async (expr: string, enabled: boolean) => {
      setCronExpr(expr);
      setCronEnabled(enabled);

      // Save to Tauri store (Rust source of truth)
      if (isTauri) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("save_empower_schedule", {
            cronExpression: expr,
            cronEnabled: enabled,
          });
        } catch (e) {
          toast.error("Failed to save schedule", { description: String(e) });
          return;
        }
      }

      // Also save to Convex (for display in UI across sessions)
      try {
        await updateCronSchedule({
          cronExpression: expr,
          cronEnabled: enabled,
        });
      } catch (e) {
        console.error("Failed to save cron to Convex:", e);
      }

      toast.success(
        enabled
          ? `Schedule set: ${describeCron(expr)}`
          : "Schedule disabled",
      );
    },
    [updateCronSchedule],
  );

  const handleSyncToConvex = async () => {
    if (!isTauri) {
      toast.info("Only available in Tauri app");
      return;
    }
    setSyncing(true);
    try {
      const result = await syncEmpowerToConvex(
        convex as unknown as ConvexClient,
        setProgress,
      );
      if (result.success) {
        toast.success("Synced to Convex", { description: result.message });
      } else {
        toast.error("Sync failed", { description: result.message });
      }
    } catch (e) {
      toast.error("Sync failed", { description: String(e) });
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  };

  const handleFullScrape = async () => {
    if (!isTauri) {
      toast.info("Only available in Tauri app");
      return;
    }
    setScraping(true);
    toast.info("Starting Empower scraper...", {
      description: "This opens Chrome briefly. Takes 2-5 minutes.",
    });
    try {
      const result = await scrapeAndSyncEmpower(
        convex as unknown as ConvexClient,
        setProgress,
      );
      if (result.success) {
        toast.success("Scrape + sync complete", {
          description: result.message,
        });
      } else {
        toast.error("Scrape failed", { description: result.message });
      }
    } catch (e) {
      toast.error("Failed to run scraper", { description: String(e) });
    } finally {
      setScraping(false);
      setProgress(null);
    }
  };

  const statusColor = {
    idle: "secondary",
    running: "default",
    success: "default",
    failed: "destructive",
  } as const;

  const busy = syncing || scraping;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          {progress && busy ? (
            <span className="text-sm text-muted-foreground">
              {progress.currentStep}
              {progress.totalAccounts > 0 &&
                ` (${progress.accountsSynced}/${progress.totalAccounts})`}
            </span>
          ) : (
            <>
              {syncStatus?.lastSyncAt && (
                <span className="text-sm text-muted-foreground">
                  Last synced {formatRelativeTime(syncStatus.lastSyncAt)}
                </span>
              )}
              {syncStatus?.status && syncStatus.status !== "idle" && (
                <Badge variant={statusColor[syncStatus.status]}>
                  {syncStatus.status}
                </Badge>
              )}
              {syncStatus?.lastSyncResult && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {syncStatus.lastSyncResult}
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Cron schedule indicator */}
          {isTauri && cronLoaded && (
            <button
              onClick={() => setShowCronEditor(!showCronEditor)}
              className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border transition-colors ${
                cronEnabled
                  ? "border-green-500/30 bg-green-500/10 text-green-600"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <Clock className="h-3 w-3" />
              {cronEnabled ? describeCron(cronExpr) : "No schedule"}
              <Settings2 className="h-3 w-3 ml-0.5" />
            </button>
          )}

          {isTauri && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleFullScrape}
                disabled={busy}
              >
                <Play
                  className={`h-4 w-4 mr-2 ${scraping ? "animate-pulse" : ""}`}
                />
                <span className="hidden xs:inline">{scraping ? "Scraping..." : "Full Scrape"}</span>
                <span className="xs:hidden">{scraping ? "..." : "Scrape"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncToConvex}
                disabled={busy}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`}
                />
                <span className="hidden xs:inline">{syncing ? "Syncing..." : "Sync to Convex"}</span>
                <span className="xs:hidden">{syncing ? "..." : "Sync"}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cron Editor */}
      {showCronEditor && isTauri && (
        <div className="border rounded-lg p-4 space-y-3 bg-card">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Sync Schedule</h3>
            <button
              onClick={() => handleSaveCron(cronExpr, !cronEnabled)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                cronEnabled
                  ? "bg-green-500/15 text-green-600 hover:bg-green-500/25"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cronEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-2">
            {CRON_PRESETS.map((preset) => (
              <button
                key={preset.cron}
                onClick={() => handleSaveCron(preset.cron, true)}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  cronExpr === preset.cron && cronEnabled
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom cron input */}
          <div className="flex items-center gap-2">
            <Input
              value={cronExpr}
              onChange={(e) => setCronExpr(e.target.value)}
              placeholder="0 */6 * * *"
              className="font-mono text-sm h-8"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0"
              onClick={() => handleSaveCron(cronExpr, true)}
            >
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Standard 5-field cron: minute hour day month weekday
          </p>
        </div>
      )}
    </div>
  );
}
