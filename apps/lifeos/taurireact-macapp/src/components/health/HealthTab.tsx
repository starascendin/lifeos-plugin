import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCw, Link2Off } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { OuraConnectCard } from "./OuraConnectCard";
import { HealthDashboard } from "./HealthDashboard";

export function HealthTab() {
  const tokenStatus = useQuery(api.lifeos.oura.getTokenStatus);
  const syncStatus = useQuery(api.lifeos.oura.getSyncStatus);
  const manualSync = useAction(api.lifeos.oura_actions.manualSync);
  const disconnectOura = useMutation(api.lifeos.oura.disconnectOura);
  const [syncing, setSyncing] = useState(false);

  const isConnected = tokenStatus?.connected === true;
  const isSyncing = syncing || syncStatus?.status === "running";

  const handleSync = async () => {
    setSyncing(true);
    try {
      await manualSync({ daysBack: 7 });
      toast.success("Oura data synced!");
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectOura();
      toast.success("Oura Ring disconnected");
    } catch (err: any) {
      toast.error(`Failed to disconnect: ${err.message}`);
    }
  };

  if (!isConnected) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold">Health</h1>
        <OuraConnectCard />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 max-w-7xl mx-auto">
      {/* Compact header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Health</h1>
          <span className="h-2 w-2 rounded-full bg-green-500" title="Oura connected" />
        </div>
        <div className="flex items-center gap-2">
          {syncStatus?.lastSyncAt && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {new Date(syncStatus.lastSyncAt).toLocaleString(undefined, {
                month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
              })}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSync}
            disabled={isSyncing}
            title="Sync Oura data"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDisconnect} className="text-destructive">
                <Link2Off className="h-4 w-4 mr-2" />
                Disconnect Oura
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <HealthDashboard />
    </div>
  );
}
