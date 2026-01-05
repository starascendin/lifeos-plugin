import { useState, useEffect } from "react";
import { useVoiceAgent, AgentState } from "@/lib/contexts/VoiceAgentContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Mic,
  MicOff,
  X,
  ChevronUp,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { MiniAudioVisualizer } from "./MiniAudioVisualizer";
import { FloatingChatPanel } from "./FloatingChatPanel";

const STORAGE_KEY = "butler-ai-widget-expanded";

const agentStateLabels: Record<AgentState, string> = {
  idle: "Ready",
  listening: "Listening",
  speaking: "Speaking",
  thinking: "Thinking",
};

function MinimizedWidget({
  onExpand,
}: {
  onExpand: () => void;
}) {
  const { agentState, isMicEnabled, toggleMic, disconnect, connectionState } =
    useVoiceAgent();

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      {/* Icon and visualizer */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <MiniAudioVisualizer />
      </div>

      {/* Status text */}
      <span
        className={cn(
          "text-xs font-medium min-w-[60px]",
          agentState === "speaking" && "text-green-500",
          agentState === "listening" && "text-blue-500",
          agentState === "thinking" && "text-yellow-500",
          agentState === "idle" && "text-muted-foreground"
        )}
      >
        {connectionState === "connected" ? agentStateLabels[agentState] : "..."}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Mic toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleMic}
          disabled={connectionState !== "connected"}
        >
          {isMicEnabled ? (
            <Mic className="h-3.5 w-3.5" />
          ) : (
            <MicOff className="h-3.5 w-3.5 text-red-500" />
          )}
        </Button>

        {/* Expand */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onExpand}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>

        {/* Disconnect */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-red-500/20 hover:text-red-500"
          onClick={disconnect}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ExpandedWidget({
  onCollapse,
}: {
  onCollapse: () => void;
}) {
  const { agentState, isMicEnabled, toggleMic, disconnect, connectionState } =
    useVoiceAgent();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Butler AI</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCollapse}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-red-500/20 hover:text-red-500"
            onClick={disconnect}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Visualizer row */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <MiniAudioVisualizer />
          <span
            className={cn(
              "text-xs font-medium",
              agentState === "speaking" && "text-green-500",
              agentState === "listening" && "text-blue-500",
              agentState === "thinking" && "text-yellow-500",
              agentState === "idle" && "text-muted-foreground"
            )}
          >
            {connectionState === "connected"
              ? agentStateLabels[agentState]
              : "Connecting..."}
          </span>
        </div>
        <Button
          variant={isMicEnabled ? "outline" : "destructive"}
          size="sm"
          className="h-7 text-xs"
          onClick={toggleMic}
          disabled={connectionState !== "connected"}
        >
          {isMicEnabled ? (
            <>
              <Mic className="h-3 w-3 mr-1" />
              Mic On
            </>
          ) : (
            <>
              <MicOff className="h-3 w-3 mr-1" />
              Muted
            </>
          )}
        </Button>
      </div>

      {/* Chat panel */}
      <div className="flex-1 overflow-hidden">
        <FloatingChatPanel />
      </div>
    </div>
  );
}

export function FloatingVoiceWidget() {
  const { connectionState } = useVoiceAgent();
  const [isExpanded, setIsExpanded] = useState(() => {
    // Load initial state from localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "true";
    }
    return false;
  });

  // Save expanded state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isExpanded));
  }, [isExpanded]);

  // Don't render if disconnected
  if (connectionState === "disconnected") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card
        className={cn(
          "shadow-lg transition-all duration-300 overflow-hidden",
          isExpanded ? "w-80 h-96" : "w-auto",
          connectionState === "connecting" && "opacity-80"
        )}
      >
        {isExpanded ? (
          <ExpandedWidget onCollapse={() => setIsExpanded(false)} />
        ) : (
          <MinimizedWidget onExpand={() => setIsExpanded(true)} />
        )}
      </Card>
    </div>
  );
}
