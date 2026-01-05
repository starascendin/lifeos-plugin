import { Alert, AlertDescription } from "@/components/ui/alert";
import { useVoiceAgent } from "@/lib/contexts/VoiceAgentContext";
import { ConnectionStatus } from "./ConnectionStatus";
import { AudioVisualizer } from "./AudioVisualizer";
import { ChatPanel } from "./ChatPanel";
import { ChatInput } from "./ChatInput";
import { AgentControls } from "./AgentControls";
import { VoiceAgentModelSelector } from "./VoiceAgentModelSelector";
import { ToolTestPanel } from "./ToolTestPanel";
import { AlertCircle, Settings, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

function VoiceAgentContent() {
  const {
    connectionState,
    error,
    isConfigured,
    isUserLoaded,
    clearError,
  } = useVoiceAgent();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">Voice Agent</h2>
          <p className="text-sm text-muted-foreground">
            Real-time voice chat with AI
          </p>
        </div>
        <div className="flex items-center gap-3 relative">
          <ToolTestPanel />
          <VoiceAgentModelSelector />
          <ConnectionStatus />
        </div>
      </div>

      {/* Configuration warning */}
      {!isConfigured && (
        <Alert variant="destructive" className="m-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              LiveKit is not configured. Add LIVEKIT_URL, LIVEKIT_API_KEY, and
              LIVEKIT_API_SECRET to your .env file.
            </span>
            <Button asChild variant="outline" size="sm" className="ml-4">
              <Link to="/lifeos/settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* User not loaded warning */}
      {isConfigured && !isUserLoaded && (
        <Alert className="m-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            User not loaded yet. Tools like "get my tasks" won't work until you're authenticated.
          </AlertDescription>
        </Alert>
      )}

      {/* Error display */}
      {error && (
        <Alert variant="destructive" className="m-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button onClick={clearError} variant="ghost" size="sm">
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
        {/* Left column: Visualizer */}
        <div className="lg:w-1/3">
          <AudioVisualizer />
        </div>

        {/* Right column: Chat */}
        <div className="flex-1 flex flex-col overflow-hidden border rounded-lg">
          <ChatPanel />
          <ChatInput />
        </div>
      </div>

      {/* Controls */}
      <AgentControls />
    </div>
  );
}

export function VoiceAgentTab() {
  // VoiceAgentProvider is now global in LifeOSApp.tsx
  return <VoiceAgentContent />;
}
