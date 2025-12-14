import { ScreenTimeSyncButton } from "./ScreenTimeSyncButton";
import { useState, useEffect, useCallback } from "react";
import {
  listScreenTimeDevices,
  getScreenTimeDailyStats,
  getScreenTimeRecentSummaries,
  type DeviceInfo,
  type DailyStats,
  type DailySummaryEntry,
} from "../../lib/services/screentime";

// Device type to emoji mapping
const deviceEmoji: Record<string, string> = {
  mac: "\u{1F4BB}",
  iphone: "\u{1F4F1}",
  ipad: "\u{1F4F1}",
  ios: "\u{1F4F2}",
  misc: "\u{1F4E6}",
  unknown: "\u{2753}",
};

export function ScreenTimeDashboard() {
  // Get today's date in YYYY-MM-DD format (local timezone, not UTC)
  const today = new Date().toLocaleDateString('en-CA'); // 'en-CA' returns YYYY-MM-DD format

  // Device state
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);

  // Data state (from Tauri, not Convex)
  const [todaySummary, setTodaySummary] = useState<DailyStats | null | undefined>(undefined);
  const [recentSummaries, setRecentSummaries] = useState<DailySummaryEntry[] | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Fetch devices on mount
  useEffect(() => {
    async function fetchDevices() {
      setIsLoadingDevices(true);
      try {
        const deviceList = await listScreenTimeDevices();
        setDevices(deviceList);
      } catch (error) {
        console.error("Failed to fetch devices:", error);
      } finally {
        setIsLoadingDevices(false);
      }
    }
    fetchDevices();
  }, []);

  // Fetch data from Tauri when device changes
  const fetchData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      // Fetch today's stats
      const dailyStats = await getScreenTimeDailyStats(today, selectedDeviceId);
      setTodaySummary(dailyStats);

      // Fetch recent summaries
      const summaries = await getScreenTimeRecentSummaries(7, selectedDeviceId);
      setRecentSummaries(summaries);
    } catch (error) {
      console.error("Failed to fetch screen time data:", error);
      setTodaySummary(null);
      setRecentSummaries([]);
    } finally {
      setIsLoadingData(false);
    }
  }, [today, selectedDeviceId]);

  // Fetch data on mount and when device changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="space-y-4 overflow-y-auto h-full">
      <ScreenTimeSyncButton onSyncComplete={fetchData} />

      {/* Device selector */}
      {devices.length > 0 && (
        <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Device:</label>
            <select
              value={selectedDeviceId ?? "all"}
              onChange={(e) => setSelectedDeviceId(e.target.value === "all" ? null : e.target.value)}
              className="flex-1 px-2 py-1 text-sm bg-[var(--bg-primary)] border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              disabled={isLoadingDevices || isLoadingData}
            >
              <option value="all">All Devices</option>
              {devices.map((device) => (
                <option key={device.device_id} value={device.device_id}>
                  {deviceEmoji[device.device_type] || deviceEmoji.unknown} {device.display_name} ({device.session_count.toLocaleString()})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Today's summary */}
      {todaySummary && (
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
          <h3 className="font-semibold mb-2">Today's Screen Time</h3>
          <p className="text-2xl font-bold text-[var(--accent)]">
            {formatDuration(todaySummary.total_seconds)}
          </p>

          {todaySummary.app_usage.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Top Apps</h4>
              <div className="space-y-2">
                {todaySummary.app_usage
                  .slice(0, 5)
                  .map((app) => (
                    <div
                      key={app.bundle_id}
                      className="flex justify-between items-center text-sm"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">
                          {app.app_name || app.bundle_id.split(".").pop()}
                        </span>
                        {app.category && (
                          <span className="text-xs text-[var(--text-secondary)]">
                            {app.category}
                          </span>
                        )}
                      </div>
                      <span className="text-[var(--text-secondary)] flex-shrink-0 ml-2">
                        {formatDuration(app.seconds)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {todaySummary.category_usage.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">By Category</h4>
              <div className="space-y-2">
                {todaySummary.category_usage
                  .map((cat) => (
                    <div
                      key={cat.category}
                      className="flex justify-between text-sm"
                    >
                      <span>{cat.category}</span>
                      <span className="text-[var(--text-secondary)]">
                        {formatDuration(cat.seconds)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No data state */}
      {todaySummary === null && !isLoadingData && (
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            No data
          </p>
        </div>
      )}

      {/* Recent history */}
      {recentSummaries && recentSummaries.length > 0 && (
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
          <h3 className="font-semibold mb-3">Last 7 Days</h3>
          <div className="space-y-2">
            {recentSummaries.map((summary) => {
              const date = new Date(summary.date + "T00:00:00");
              const isToday = summary.date === today;
              const dayName = isToday
                ? "Today"
                : date.toLocaleDateString("en-US", { weekday: "short" });
              const dateStr = date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });

              return (
                <div
                  key={summary.date}
                  className="flex justify-between items-center text-sm"
                >
                  <div>
                    <span className="font-medium">{dayName}</span>
                    <span className="text-[var(--text-secondary)] ml-1">
                      {dateStr}
                    </span>
                  </div>
                  <span
                    className={
                      isToday
                        ? "text-[var(--accent)] font-medium"
                        : "text-[var(--text-secondary)]"
                    }
                  >
                    {formatDuration(summary.total_seconds)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading state */}
      {(todaySummary === undefined || isLoadingData) && (
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
          <div className="flex items-center gap-2">
            <div className="spinner" />
            <span className="text-sm">Loading screen time data...</span>
          </div>
        </div>
      )}
    </div>
  );
}
