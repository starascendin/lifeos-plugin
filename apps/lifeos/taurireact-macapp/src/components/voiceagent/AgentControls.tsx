import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useVoiceAgent } from "@/lib/contexts/VoiceAgentContext";
import { Phone, PhoneOff, Mic, MicOff, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AgentControls() {
  const {
    connectionState,
    isMicEnabled,
    connect,
    disconnect,
    toggleMic,
    clearMessages,
    isConfigured,
  } = useVoiceAgent();

  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    try {
      await connect();
    } finally {
      setIsConnecting(false);
    }
  }, [connect]);

  const isConnected = connectionState === "connected";
  const showConnecting = connectionState === "connecting" || isConnecting;

  return (
    <div className="flex items-center justify-center gap-3 p-4 border-t">
      {/* Connect/Disconnect button */}
      {isConnected ? (
        <Button
          onClick={disconnect}
          variant="destructive"
          size="lg"
          className="gap-2"
        >
          <PhoneOff className="h-5 w-5" />
          Disconnect
        </Button>
      ) : (
        <Button
          onClick={handleConnect}
          disabled={showConnecting || !isConfigured}
          size="lg"
          className="gap-2"
        >
          {showConnecting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Phone className="h-5 w-5" />
              Connect
            </>
          )}
        </Button>
      )}

      {/* Mic toggle (only when connected) */}
      {isConnected && (
        <Button
          onClick={toggleMic}
          variant={isMicEnabled ? "secondary" : "outline"}
          size="lg"
          className={cn(
            "gap-2",
            !isMicEnabled && "text-destructive border-destructive"
          )}
        >
          {isMicEnabled ? (
            <>
              <Mic className="h-5 w-5" />
              Mute
            </>
          ) : (
            <>
              <MicOff className="h-5 w-5" />
              Unmute
            </>
          )}
        </Button>
      )}

      {/* Clear messages button */}
      <Button
        onClick={clearMessages}
        variant="ghost"
        size="icon"
        title="Clear messages"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
