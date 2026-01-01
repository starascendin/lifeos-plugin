import { useState, useEffect } from "react";
import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Monitor, RefreshCw, Clock, AlertCircle } from "lucide-react";
import {
  getScreenTimeDailyStats,
  type DailyStats,
  type AppUsageStat,
} from "@/lib/services/screentime";

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

// Format seconds as hours and minutes
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

interface AppUsageRowProps {
  app: AppUsageStat;
  maxSeconds: number;
}

function AppUsageRow({ app, maxSeconds }: AppUsageRowProps) {
  const percentage = maxSeconds > 0 ? (app.seconds / maxSeconds) * 100 : 0;

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium truncate">{app.app_name}</span>
          <span className="text-sm text-muted-foreground">
            {formatDuration(app.seconds)}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
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

  // Get top 5 apps by usage
  const topApps = stats?.app_usage
    ?.sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5) ?? [];

  const maxSeconds = topApps.length > 0 ? topApps[0].seconds : 0;

  // If not in Tauri, show a message
  if (!isTauri) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Monitor className="h-5 w-5" />
            Screen Time
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-6 text-muted-foreground">
            <Monitor className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Screen time data is available in the Tauri desktop app</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Monitor className="h-5 w-5" />
            Screen Time
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchStats}
            disabled={isLoading}
            className="h-8 w-8"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-destructive py-4">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        ) : stats ? (
          <div className="space-y-4">
            {/* Total screen time */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-semibold">
                  {formatDuration(stats.total_seconds)}
                </p>
                <p className="text-sm text-muted-foreground">Total screen time</p>
              </div>
            </div>

            {/* Top apps */}
            {topApps.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                  Top Apps
                </h4>
                <div className="space-y-1">
                  {topApps.map((app) => (
                    <AppUsageRow
                      key={app.bundle_id}
                      app={app}
                      maxSeconds={maxSeconds}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Category breakdown */}
            {stats.category_usage && stats.category_usage.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                  By Category
                </h4>
                <div className="flex flex-wrap gap-2">
                  {stats.category_usage
                    .sort((a, b) => b.seconds - a.seconds)
                    .slice(0, 5)
                    .map((cat) => (
                      <div
                        key={cat.category}
                        className="px-3 py-1.5 bg-muted rounded-full text-sm"
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
          <div className="text-center py-6 text-muted-foreground">
            <Monitor className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No screen time data for today</p>
            <p className="text-xs mt-1">
              Data syncs from macOS Screen Time
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
