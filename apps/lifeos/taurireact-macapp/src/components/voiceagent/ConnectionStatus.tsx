import { Badge } from "@/components/ui/badge";
import { useVoiceAgent, VoiceAgentConnectionState } from "@/lib/contexts/VoiceAgentContext";
import { Wifi, WifiOff, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  VoiceAgentConnectionState,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Wifi }
> = {
  disconnected: {
    label: "Disconnected",
    variant: "secondary",
    icon: WifiOff,
  },
  connecting: {
    label: "Connecting...",
    variant: "outline",
    icon: Loader2,
  },
  connected: {
    label: "Connected",
    variant: "default",
    icon: Wifi,
  },
  error: {
    label: "Error",
    variant: "destructive",
    icon: AlertCircle,
  },
};

export function ConnectionStatus() {
  const { connectionState, roomName, error } = useVoiceAgent();
  const config = statusConfig[connectionState];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Badge variant={config.variant} className="flex items-center gap-1.5">
        <Icon
          className={cn(
            "h-3 w-3",
            connectionState === "connecting" && "animate-spin"
          )}
        />
        {config.label}
      </Badge>
      {connectionState === "connected" && roomName && (
        <span className="text-xs text-muted-foreground">
          Room: {roomName}
        </span>
      )}
      {connectionState === "error" && error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}
