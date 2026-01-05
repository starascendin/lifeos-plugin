import { useMemo } from "react";
import { Track } from "livekit-client";
import { useVoiceAgent } from "@/lib/contexts/VoiceAgentContext";
import { useMultibandVolume } from "@/lib/hooks/useAudioVisualizer";
import { cn } from "@/lib/utils";

const NUM_BARS = 3;

interface MiniAudioVisualizerProps {
  className?: string;
}

export function MiniAudioVisualizer({ className }: MiniAudioVisualizerProps) {
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
        return "bg-muted-foreground/50";
    }
  }, [agentState]);

  const isActive = connectionState === "connected" && agentState !== "idle";

  return (
    <div className={cn("flex items-center gap-0.5 h-5", className)}>
      {bands.map((value, index) => (
        <div
          key={index}
          className={cn(
            "w-1 rounded-full transition-all duration-75",
            barColorClass
          )}
          style={{
            height: isActive
              ? `${Math.max(20, value * 100)}%`
              : "20%",
          }}
        />
      ))}
    </div>
  );
}
