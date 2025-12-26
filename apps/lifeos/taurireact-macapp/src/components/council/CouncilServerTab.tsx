import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";

interface CouncilServerStatus {
  running: boolean;
  port: number;
  extensionConnected: boolean;
  uptimeMs: number | null;
}

export function CouncilServerTab() {
  const [status, setStatus] = useState<CouncilServerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await invoke<CouncilServerStatus>("get_council_server_status");
      setStatus(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll status every 2 seconds
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      await invoke("start_council_server");
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setError(null);
    try {
      await invoke("stop_council_server");
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUI = async () => {
    try {
      await open(`http://localhost:${status?.port || 3456}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      {/* Action Buttons - Always visible at top */}
      <div className="flex gap-2">
        {status?.running ? (
          <>
            <button
              onClick={handleOpenUI}
              className="flex-1 py-3 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors"
            >
              Open UI
            </button>
            <button
              onClick={handleStop}
              disabled={loading}
              className="py-3 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? "..." : "Stop"}
            </button>
          </>
        ) : (
          <button
            onClick={handleStart}
            disabled={loading}
            className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? "Starting..." : "Start Server"}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Status Card */}
      <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Status</h2>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                status?.running ? "bg-green-500 animate-pulse" : "bg-gray-400"
              }`}
            />
            <span className="text-sm font-medium">
              {status?.running ? "Running" : "Stopped"}
            </span>
          </div>
        </div>

        {status?.running && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Port</span>
              <span className="font-mono">{status.port}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Extension</span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    status.extensionConnected ? "bg-green-500" : "bg-yellow-500 animate-pulse"
                  }`}
                />
                <span>
                  {status.extensionConnected ? "Connected" : "Waiting..."}
                </span>
              </div>
            </div>

            {status.uptimeMs !== null && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Uptime</span>
                <span>{formatUptime(status.uptimeMs)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-2">Endpoints</h3>
        <div className="space-y-1 text-xs text-[var(--text-secondary)] font-mono">
          <p>POST http://localhost:3456/prompt</p>
          <p>GET  http://localhost:3456/health</p>
          <p>GET  http://localhost:3456/auth-status</p>
          <p>WS   ws://localhost:3456/ws</p>
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-2">Usage</h3>
        <ol className="space-y-2 text-sm text-[var(--text-secondary)]">
          <li>1. Start the server above</li>
          <li>2. Open Chrome with the LLM Council extension</li>
          <li>3. The extension will auto-connect via WebSocket</li>
          <li>4. Send requests to POST /prompt from any client</li>
        </ol>
      </div>
    </div>
  );
}
