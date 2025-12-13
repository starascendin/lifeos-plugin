import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { ScreenTimeSyncButton } from "./ScreenTimeSyncButton";
import { useState, useEffect } from "react";
import { listScreenTimeDevices, type DeviceInfo } from "../../lib/services/screentime";

// Device type to emoji mapping
const deviceEmoji: Record<string, string> = {
  mac: "💻",
  iphone: "📱",
  ipad: "📱",
  ios: "📲",
  unknown: "❓",
};

export function ScreenTimeDashboard() {
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];

  // Device state
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);

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

  // Get today's summary
  const todaySummary = useQuery(api.lifeos.screentime.getDailySummary, {
    date: today,
  });

  // Get recent summaries
  const recentSummaries = useQuery(api.lifeos.screentime.getRecentSummaries, {
    days: 7,
  });

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
      <ScreenTimeSyncButton />

      {/* Device selector */}
      {devices.length > 0 && (
        <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Device:</label>
            <select
              value={selectedDeviceId ?? "all"}
              onChange={(e) => setSelectedDeviceId(e.target.value === "all" ? null : e.target.value)}
              className="flex-1 px-2 py-1 text-sm bg-[var(--bg-primary)] border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              disabled={isLoadingDevices}
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
            {formatDuration(todaySummary.totalSeconds)}
          </p>

          {todaySummary.appUsage.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Top Apps</h4>
              <div className="space-y-2">
                {todaySummary.appUsage
                  .sort((a, b) => b.seconds - a.seconds)
                  .slice(0, 5)
                  .map((app) => (
                    <div
                      key={app.bundleId}
                      className="flex justify-between items-center text-sm"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">
                          {app.appName || app.bundleId.split(".").pop()}
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

          {todaySummary.categoryUsage.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">By Category</h4>
              <div className="space-y-2">
                {todaySummary.categoryUsage
                  .sort((a, b) => b.seconds - a.seconds)
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
      {todaySummary === null && (
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            No screen time data for today yet.
            <br />
            Click "Sync Screen Time Data" to get started.
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
                    {formatDuration(summary.totalSeconds)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading state */}
      {todaySummary === undefined && (
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
