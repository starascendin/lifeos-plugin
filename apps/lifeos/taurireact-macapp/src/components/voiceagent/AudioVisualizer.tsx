import { useMemo } from "react";
import { Track } from "livekit-client";
import { Card, CardContent } from "@/components/ui/card";
import { useVoiceAgent, AgentState } from "@/lib/contexts/VoiceAgentContext";
import { useMultibandVolume } from "@/lib/hooks/useAudioVisualizer";
import { cn } from "@/lib/utils";

const NUM_BARS = 5;

const agentStateLabels: Record<AgentState, string> = {
  idle: "Waiting...",
  listening: "Listening...",
  speaking: "Speaking...",
  thinking: "Thinking...",
};

export function AudioVisualizer() {
  const { agentState, agentParticipant, connectionState } = useVoiceAgent();

  // Get audio track from agent
  const agentAudioTrack = useMemo(() => {
    if (!agentParticipant) return undefined;
    const publication = agentParticipant.getTrackPublication(Track.Source.Microphone);
    return publication?.track ?? undefined;
  }, [agentParticipant]);

  // Get frequency bands
  const bands = useMultibandVolume(agentAudioTrack, NUM_BARS);

  // Determine bar colors based on agent state
  const barColorClass = useMemo(() => {
    switch (agentState) {
      case "speaking":
        return "bg-green-500";
      case "listening":
        return "bg-blue-500";
      case "thinking":
        return "bg-yellow-500";
      default:
        return "bg-muted-foreground/30";
    }
  }, [agentState]);

  const isActive = connectionState === "connected" && agentState !== "idle";

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-8">
        {/* Visualizer bars */}
        <div className="flex items-end justify-center gap-1 h-24 mb-4">
          {bands.map((value, index) => (
            <div
              key={index}
              className={cn(
                "w-4 rounded-t transition-all duration-75",
                barColorClass
              )}
              style={{
                height: isActive
                  ? `${Math.max(8, value * 100)}%`
                  : "8%",
              }}
            />
          ))}
        </div>

        {/* State label */}
        <p
          className={cn(
            "text-sm font-medium",
            agentState === "speaking" && "text-green-500",
            agentState === "listening" && "text-blue-500",
            agentState === "thinking" && "text-yellow-500",
            agentState === "idle" && "text-muted-foreground"
          )}
        >
          {connectionState === "connected"
            ? agentStateLabels[agentState]
            : connectionState === "connecting"
            ? "Connecting to agent..."
            : "Not connected"}
        </p>
      </CardContent>
    </Card>
  );
}
