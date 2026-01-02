import { useScreenTimeSync } from "../../lib/contexts/SyncContext";
import { wipeScreenTimeDatabase } from "../../lib/services/screentime";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Monitor,
  Settings,
  Clock,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

interface ScreenTimeSyncButtonProps {
  onSyncComplete?: () => void;
}

export function ScreenTimeSyncButton({ onSyncComplete }: ScreenTimeSyncButtonProps) {
  const { progress, hasPermission, startSync, isSyncing, refreshPermission, syncHistory } =
    useScreenTimeSync();
  const [isWiping, setIsWiping] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

  const handleWipeDatabase = async () => {
    setIsWiping(true);
    try {
      await wipeScreenTimeDatabase();
      setShowWipeConfirm(false);
      // Auto-start sync after wipe
      startSync();
    } catch (error) {
      console.error("Failed to wipe database:", error);
    } finally {
      setIsWiping(false);
    }
  };

  // Format sync history timestamp (SQLite datetime string)
  const formatSyncTime = (timestamp: string) => {
    const date = new Date(timestamp + "Z"); // Append Z to treat as UTC
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Track previous status to detect when sync completes
  const prevStatusRef = useRef(progress.status);

  // Call onSyncComplete when sync finishes
  useEffect(() => {
    if (prevStatusRef.current !== "complete" && progress.status === "complete") {
      onSyncComplete?.();
    }
    prevStatusRef.current = progress.status;
  }, [progress.status, onSyncComplete]);

  const openSystemPreferences = async () => {
    if (!isTauri) return;
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"
    );
  };

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (progress.totalSessions === 0) return 0;
    return Math.round(
      (progress.syncedSessions / progress.totalSessions) * 100
    );
  };

  if (hasPermission === null) {
    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">
              Checking permissions...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasPermission || !progress.hasPermission) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="ml-2">
          <div className="space-y-3">
            <p className="font-medium">Full Disk Access Required</p>
            <p className="text-xs opacity-80">
              Screen Time data requires Full Disk Access permission to read.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={openSystemPreferences}>
                <Settings className="h-4 w-4 mr-2" />
                Open System Settings
              </Button>
              <Button size="sm" variant="outline" onClick={refreshPermission}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Sync history tooltip component
  const SyncHistoryTooltip = () => {
    if (syncHistory.length === 0) return null;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Clock className="h-3 w-3" />
              <span>Last synced {formatSyncTime(syncHistory[0].synced_at)}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="p-2">
            <div className="text-xs space-y-1">
              <p className="font-medium mb-1">Recent syncs:</p>
              {syncHistory.map((entry, i) => (
                <p key={i} className="text-muted-foreground">
                  {formatSyncTime(entry.synced_at)}{" "}
                  <span className="opacity-60">
                    ({entry.source === "background" ? "auto" : "manual"})
                  </span>
                </p>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        {isSyncing ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">
                {progress.status === "checking" ? "Checking..." : "Syncing..."}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {progress.currentStep}
            </p>
            {progress.totalSessions > 0 && (
              <>
                <Progress value={getProgressPercentage()} className="h-2" />
                <Badge variant="secondary" className="text-xs">
                  Sessions: {progress.syncedSessions}/{progress.totalSessions}
                </Badge>
              </>
            )}
          </div>
        ) : progress.status === "complete" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Sync complete!</span>
              </div>
              <SyncHistoryTooltip />
            </div>
            <p className="text-xs text-muted-foreground">
              {progress.currentStep}
            </p>
            <Button onClick={startSync} className="w-full" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Again
            </Button>
            {showWipeConfirm ? (
              <div className="flex gap-2">
                <Button
                  onClick={handleWipeDatabase}
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  disabled={isWiping}
                >
                  {isWiping ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Confirm Wipe
                </Button>
                <Button
                  onClick={() => setShowWipeConfirm(false)}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setShowWipeConfirm(true)}
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Wipe DB & Resync
              </Button>
            )}
          </div>
        ) : progress.status === "error" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Sync failed</span>
            </div>
            <p className="text-xs text-muted-foreground">{progress.error}</p>
            <Button
              onClick={startSync}
              variant="destructive"
              className="w-full"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Sync
            </Button>
            {showWipeConfirm ? (
              <div className="flex gap-2">
                <Button
                  onClick={handleWipeDatabase}
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  disabled={isWiping}
                >
                  {isWiping ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Confirm Wipe
                </Button>
                <Button
                  onClick={() => setShowWipeConfirm(false)}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setShowWipeConfirm(true)}
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Wipe DB & Resync
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className="text-green-600 border-green-600"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Screen Time Access Granted
              </Badge>
              <SyncHistoryTooltip />
            </div>
            <Button onClick={startSync} className="w-full" size="sm">
              <Monitor className="h-4 w-4 mr-2" />
              Sync Screen Time Data
            </Button>
            {showWipeConfirm ? (
              <div className="flex gap-2">
                <Button
                  onClick={handleWipeDatabase}
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  disabled={isWiping}
                >
                  {isWiping ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Confirm Wipe
                </Button>
                <Button
                  onClick={() => setShowWipeConfirm(false)}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setShowWipeConfirm(true)}
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Wipe DB & Resync
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
