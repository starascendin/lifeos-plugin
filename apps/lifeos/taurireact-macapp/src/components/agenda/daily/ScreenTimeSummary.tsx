import { useState, useEffect } from "react";
import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Monitor, RefreshCw, Clock, AlertCircle } from "lucide-react";
import {
  getScreenTimeDailyStats,
  type DailyStats,
  type AppUsageStat,
} from "@/lib/services/screentime";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

interface AppUsageRowProps {
  app: AppUsageStat;
  maxSeconds: number;
}

function AppUsageRow({ app, maxSeconds }: AppUsageRowProps) {
  const percentage = maxSeconds > 0 ? (app.seconds / maxSeconds) * 100 : 0;

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs font-medium truncate">{app.app_name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDuration(app.seconds)}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function ScreenTimeSummary() {
  const { dateString } = useAgenda();
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!isTauri) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const dailyStats = await getScreenTimeDailyStats(dateString);
      setStats(dailyStats);
    } catch (err) {
      setError("Failed to load screen time data");
      console.error("Screen time error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [dateString]);

  const topApps = stats?.app_usage
    ?.sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5) ?? [];

  const maxSeconds = topApps.length > 0 ? topApps[0].seconds : 0;

  if (!isTauri) {
    return (
      <div className="rounded-lg border bg-card/50 p-3 text-center text-muted-foreground">
        <p className="text-xs">Screen time available in desktop app</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card/50 p-3">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Screen Time</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchStats}
          disabled={isLoading}
          className="h-7 w-7"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-destructive py-2">
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="text-xs">{error}</span>
        </div>
      ) : stats ? (
        <div className="space-y-3">
          {/* Total */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
            <Clock className="h-6 w-6 text-muted-foreground" />
            <div>
              <p className="text-xl font-semibold tabular-nums">
                {formatDuration(stats.total_seconds)}
              </p>
              <p className="text-[10px] text-muted-foreground">Total screen time</p>
            </div>
          </div>

          {/* Top apps */}
          {topApps.length > 0 && (
            <div>
              <h4 className="text-xs font-medium mb-1 text-muted-foreground">Top Apps</h4>
              <div className="space-y-0.5">
                {topApps.map((app) => (
                  <AppUsageRow key={app.bundle_id} app={app} maxSeconds={maxSeconds} />
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          {stats.category_usage && stats.category_usage.length > 0 && (
            <div>
              <h4 className="text-xs font-medium mb-1 text-muted-foreground">Categories</h4>
              <div className="flex flex-wrap gap-1.5">
                {stats.category_usage
                  .sort((a, b) => b.seconds - a.seconds)
                  .slice(0, 5)
                  .map((cat) => (
                    <div
                      key={cat.category}
                      className="px-2 py-1 bg-muted rounded-full text-xs"
                    >
                      <span className="font-medium">{cat.category}</span>
                      <span className="text-muted-foreground ml-1">
                        {formatDuration(cat.seconds)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          <Monitor className="h-5 w-5 mx-auto mb-1 opacity-40" />
          <p className="text-xs">No screen time data</p>
        </div>
      )}
    </div>
  );
}
