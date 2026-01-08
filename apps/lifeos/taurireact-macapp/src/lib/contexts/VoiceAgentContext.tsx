import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  Room,
  RoomEvent,
  ConnectionState,
  Track,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  LocalParticipant,
  DataPacket_Kind,
} from "livekit-client";
import {
  generateToken,
  getLiveKitConfig,
  ChatMessage,
  generateMessageId,
} from "../services/livekit";
import { useQuery, useMutation } from "convex/react";
import { api, Id } from "@holaai/convex";

// Re-export ChatMessage type for use in other components
export type { ChatMessage };

// Session ID type from Convex
type VoiceAgentSessionId = Id<"lifeos_voiceAgentSessions">;

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

// ==================== TYPES ====================

export type VoiceAgentConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export type AgentState = "idle" | "listening" | "speaking" | "thinking";

// ==================== MODEL CONFIGURATION ====================

export const VOICE_AGENT_MODELS = [
  { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Fast & affordable" },
  { id: "gpt-4o", name: "GPT-4o", description: "High quality" },
  { id: "gpt-5-mini", name: "GPT-5 Mini", description: "Latest mini model" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", description: "Enhanced mini" },
  { id: "gpt-5.1-codex-mini", name: "GPT-5.1 Codex Mini", description: "Optimized for code" },
] as const;

export type VoiceAgentModelId = (typeof VOICE_AGENT_MODELS)[number]["id"];
export const DEFAULT_VOICE_AGENT_MODEL: VoiceAgentModelId = "gpt-4o-mini";

interface VoiceAgentState {
  connectionState: VoiceAgentConnectionState;
  agentState: AgentState;
  isMicEnabled: boolean;
  messages: ChatMessage[];
  error: string | null;
  roomName: string | null;
  participantIdentity: string | null;
  agentParticipant: RemoteParticipant | null;
  selectedModelId: VoiceAgentModelId;
  sessionId: VoiceAgentSessionId | null;
}

interface VoiceAgentContextValue extends VoiceAgentState {
  room: Room | null;
  connect: (roomName?: string) => Promise<void>;
  disconnect: () => void;
  toggleMic: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  clearError: () => void;
  clearMessages: () => void;
  setSelectedModelId: (modelId: VoiceAgentModelId) => void;
  isConfigured: boolean;
  isUserLoaded: boolean;
}

const defaultState: VoiceAgentState = {
  connectionState: "disconnected",
  agentState: "idle",
  isMicEnabled: true,
  messages: [],
  error: null,
  roomName: null,
  participantIdentity: null,
  agentParticipant: null,
  selectedModelId: DEFAULT_VOICE_AGENT_MODEL,
  sessionId: null,
};

// ==================== CONTEXT ====================

const VoiceAgentContext = createContext<VoiceAgentContextValue | null>(null);

// ==================== PROVIDER ====================

interface VoiceAgentProviderProps {
  children: ReactNode;
}

export function VoiceAgentProvider({ children }: VoiceAgentProviderProps) {
  const [state, setState] = useState<VoiceAgentState>(defaultState);
  const [isConfigured, setIsConfigured] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const sessionIdRef = useRef<VoiceAgentSessionId | null>(null);

  // Get current user for userId in metadata
  const currentUser = useQuery(api.common.users.currentUser);

  // Convex mutations for persistence
  const createSessionMutation = useMutation(api.lifeos.voiceagent.createSession);
  const endSessionMutation = useMutation(api.lifeos.voiceagent.endSession);
  const addMessageMutation = useMutation(api.lifeos.voiceagent.addMessage);

  // Query for recent messages (load history on mount)
  const recentMessages = useQuery(api.lifeos.voiceagent.getRecentMessages, { limit: 50 });

  // Load history on initial mount
  useEffect(() => {
    if (recentMessages && state.connectionState === "disconnected" && state.messages.length === 0) {
      // Convert Convex messages to ChatMessage format
      const historyMessages: ChatMessage[] = recentMessages
        .map((m) => ({
          id: m._id,
          sender: m.sender as "user" | "agent",
          text: m.text,
          timestamp: new Date(m.timestamp),
        }))
        .reverse(); // Most recent first, so reverse for chronological order

      if (historyMessages.length > 0) {
        setState((prev) => ({
          ...prev,
          messages: historyMessages,
        }));
      }
    }
  }, [recentMessages, state.connectionState, state.messages.length]);

  // Check configuration on mount
  useEffect(() => {
    getLiveKitConfig().then((config) => {
      setIsConfigured(config.is_configured);
    });
  }, []);

  // Handle agent state from attributes
  const updateAgentState = useCallback((participant: RemoteParticipant) => {
    const stateAttr = participant.attributes?.["lk.agent.state"];
    if (stateAttr) {
      let agentState: AgentState = "idle";
      switch (stateAttr) {
        case "listening":
          agentState = "listening";
          break;
        case "speaking":
          agentState = "speaking";
          break;
        case "thinking":
          agentState = "thinking";
          break;
        default:
          agentState = "idle";
      }
      setState((prev) => ({ ...prev, agentState }));
    }
  }, []);

  // Connect to LiveKit room
  const connect = useCallback(async (roomName?: string) => {
    if (roomRef.current?.state === ConnectionState.Connected) {
      return;
    }

    setState((prev) => ({ ...prev, connectionState: "connecting", error: null }));

    try {
      // Request microphone permission via Tauri plugin on macOS
      if (isTauri) {
        try {
          const { checkMicrophonePermission, requestMicrophonePermission } = await import(
            "tauri-plugin-macos-permissions-api"
          );

          const hasPermission = await checkMicrophonePermission();
          if (!hasPermission) {
            const granted = await requestMicrophonePermission();
            if (!granted) {
              throw new Error(
                "Microphone access denied. Please allow microphone access in System Preferences > Privacy & Security > Microphone."
              );
            }
          }
        } catch (pluginError) {
          console.warn("Could not check macOS permissions:", pluginError);
          // Continue anyway - the getUserMedia call will handle the error
        }
      }

      // Check for media device support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Media devices not available. This may be due to running in an insecure context. " +
          "Try running the built app instead of dev mode, or check System Preferences > Privacy & Security > Microphone."
        );
      }

      // Request microphone permission early
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (mediaError) {
        if (mediaError instanceof Error) {
          if (mediaError.name === "NotAllowedError") {
            throw new Error("Microphone access denied. Please allow microphone access in System Preferences.");
          } else if (mediaError.name === "NotFoundError") {
            throw new Error("No microphone found. Please connect a microphone and try again.");
          }
        }
        throw mediaError;
      }

      // Generate token with model and user metadata
      const targetRoom = roomName || `voice-agent-${Date.now()}`;

      // Validate userId is available
      const userId = currentUser?._id;
      if (!userId) {
        console.warn("[VoiceAgent] Warning: No userId available. Tools requiring user context will fail.");
      }

      const metadata = JSON.stringify({
        model: state.selectedModelId,
        userId: userId,
        localTime: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      console.log("[VoiceAgent] Connecting with metadata:", {
        model: state.selectedModelId,
        userId: userId || 'undefined',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      const tokenResponse = await generateToken(targetRoom, undefined, undefined, metadata);

      // Create room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      // Set up event handlers
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Connected) {
          setState((prev) => ({ ...prev, connectionState: "connected" }));
        } else if (state === ConnectionState.Disconnected) {
          setState((prev) => ({
            ...prev,
            connectionState: "disconnected",
            agentState: "idle",
            agentParticipant: null,
          }));
        }
      });

      room.on(RoomEvent.ParticipantConnected, (participant) => {
        // Check if this is an agent
        if (participant.attributes?.["lk.agent.state"]) {
          setState((prev) => ({ ...prev, agentParticipant: participant }));
          updateAgentState(participant);
        }
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        setState((prev) => {
          if (prev.agentParticipant?.identity === participant.identity) {
            return { ...prev, agentParticipant: null, agentState: "idle" };
          }
          return prev;
        });
      });

      room.on(RoomEvent.ParticipantAttributesChanged, (changedAttrs, participant) => {
        if (participant instanceof RemoteParticipant && changedAttrs["lk.agent.state"]) {
          updateAgentState(participant);
        }
      });

      // Handle audio track subscription - CRITICAL for audio playback
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio && participant instanceof RemoteParticipant) {
          console.log("[VoiceAgent] Audio track subscribed, attaching for playback");
          const audioElement = track.attach();
          audioElement.id = `livekit-audio-${participant.identity}`;
          document.body.appendChild(audioElement);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          console.log("[VoiceAgent] Audio track unsubscribed, detaching");
          track.detach().forEach((el) => el.remove());
        }
      });

      // Handle transcriptions via RoomEvent.TranscriptionReceived
      // This is the proper way to receive transcriptions from LiveKit agents
      room.on(RoomEvent.TranscriptionReceived, (segments, participant, publication) => {
        console.log("[VoiceAgent] Transcription received:", segments, "from:", participant?.identity);

        // Process each transcription segment
        segments.forEach((segment) => {
          // Only process final segments (complete utterances)
          if (segment.final && segment.text.trim()) {
            const isAgent = participant instanceof RemoteParticipant;
            const sender = isAgent ? "agent" : "user";
            const messageId = segment.id || generateMessageId();
            const timestamp = segment.firstReceivedTime || Date.now();

            const chatMessage: ChatMessage = {
              id: messageId,
              sender,
              text: segment.text.trim(),
              timestamp: new Date(timestamp),
            };

            setState((prev) => {
              // Avoid duplicates by checking if segment already exists
              const exists = prev.messages.some((m) => m.id === chatMessage.id);
              if (exists) {
                // Update existing message with new text
                return {
                  ...prev,
                  messages: prev.messages.map((m) =>
                    m.id === chatMessage.id ? chatMessage : m
                  ),
                };
              }
              return {
                ...prev,
                messages: [...prev.messages, chatMessage],
              };
            });
            console.log("[VoiceAgent] Added transcription:", segment.text);

            // Save to Convex for persistence (non-blocking)
            if (sessionIdRef.current) {
              addMessageMutation({
                sessionId: sessionIdRef.current,
                sender,
                text: segment.text.trim(),
                livekitMessageId: segment.id,
                timestamp,
              }).catch((error) => {
                console.error("[VoiceAgent] Failed to save message:", error);
              });
            }
          }
        });
      });

      // Also handle regular data messages (for backwards compatibility with older agents)
      room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
        if (participant instanceof RemoteParticipant) {
          try {
            const decoder = new TextDecoder();
            const message = decoder.decode(payload);
            const data = JSON.parse(message);

            if (data.type === "transcription" || data.text) {
              const chatMessage: ChatMessage = {
                id: generateMessageId(),
                sender: "agent",
                text: data.text || data.content || message,
                timestamp: new Date(),
              };
              setState((prev) => ({
                ...prev,
                messages: [...prev.messages, chatMessage],
              }));
            }
          } catch {
            // Not a JSON message, ignore
          }
        }
      });

      // Connect to room
      await room.connect(tokenResponse.server_url, tokenResponse.token);

      // Enable microphone
      await room.localParticipant.setMicrophoneEnabled(true);

      // Check for existing agent participants
      room.remoteParticipants.forEach((participant) => {
        if (participant.attributes?.["lk.agent.state"]) {
          setState((prev) => ({ ...prev, agentParticipant: participant }));
          updateAgentState(participant);
        }
      });

      // Create session in Convex for persistence
      try {
        const sessionId = await createSessionMutation({
          roomName: tokenResponse.room_name,
          modelId: state.selectedModelId,
        });
        sessionIdRef.current = sessionId;
        setState((prev) => ({
          ...prev,
          connectionState: "connected",
          roomName: tokenResponse.room_name,
          participantIdentity: tokenResponse.participant_identity,
          isMicEnabled: true,
          sessionId,
        }));
      } catch (sessionError) {
        console.error("[VoiceAgent] Failed to create session:", sessionError);
        // Still mark as connected even if session creation fails
        setState((prev) => ({
          ...prev,
          connectionState: "connected",
          roomName: tokenResponse.room_name,
          participantIdentity: tokenResponse.participant_identity,
          isMicEnabled: true,
        }));
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to connect";
      setState((prev) => ({
        ...prev,
        connectionState: "error",
        error: errorMessage,
      }));
    }
  }, [updateAgentState, currentUser, state.selectedModelId, createSessionMutation, addMessageMutation]);

  // Disconnect from room
  const disconnect = useCallback(async () => {
    // End session in Convex
    if (sessionIdRef.current) {
      try {
        await endSessionMutation({ sessionId: sessionIdRef.current });
      } catch (error) {
        console.error("[VoiceAgent] Failed to end session:", error);
      }
      sessionIdRef.current = null;
    }

    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setState((prev) => ({
      ...defaultState,
      messages: prev.messages, // Keep messages
      selectedModelId: prev.selectedModelId, // Keep model selection
    }));
  }, [endSessionMutation]);

  // Toggle microphone
  const toggleMic = useCallback(async () => {
    if (!roomRef.current?.localParticipant) return;

    const newState = !state.isMicEnabled;
    await roomRef.current.localParticipant.setMicrophoneEnabled(newState);
    setState((prev) => ({ ...prev, isMicEnabled: newState }));
  }, [state.isMicEnabled]);

  // Send text message
  const sendMessage = useCallback(async (text: string) => {
    if (!roomRef.current || !text.trim()) return;

    const messageId = generateMessageId();
    const timestamp = Date.now();

    // Add user message to list
    const userMessage: ChatMessage = {
      id: messageId,
      sender: "user",
      text: text.trim(),
      timestamp: new Date(timestamp),
    };
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
    }));

    // Save to Convex for persistence
    if (sessionIdRef.current) {
      addMessageMutation({
        sessionId: sessionIdRef.current,
        sender: "user",
        text: text.trim(),
        timestamp,
      }).catch((error) => {
        console.error("[VoiceAgent] Failed to save sent message:", error);
      });
    }

    // Send via data channel
    const encoder = new TextEncoder();
    const data = encoder.encode(
      JSON.stringify({
        type: "chat",
        text: text.trim(),
      })
    );
    await roomRef.current.localParticipant.publishData(data, {
      reliable: true,
    });
  }, [addMessageMutation]);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Clear messages
  const clearMessages = useCallback(() => {
    setState((prev) => ({ ...prev, messages: [] }));
  }, []);

  // Set selected model (only when disconnected)
  const setSelectedModelId = useCallback((modelId: VoiceAgentModelId) => {
    if (state.connectionState === "disconnected") {
      setState((prev) => ({ ...prev, selectedModelId: modelId }));
    }
  }, [state.connectionState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  const value: VoiceAgentContextValue = {
    ...state,
    room: roomRef.current,
    connect,
    disconnect,
    toggleMic,
    sendMessage,
    clearError,
    clearMessages,
    setSelectedModelId,
    isConfigured,
    isUserLoaded: !!currentUser?._id,
  };

  return (
    <VoiceAgentContext.Provider value={value}>
      {children}
    </VoiceAgentContext.Provider>
  );
}

// ==================== HOOK ====================

export function useVoiceAgent() {
  const context = useContext(VoiceAgentContext);
  if (!context) {
    throw new Error("useVoiceAgent must be used within a VoiceAgentProvider");
  }
  return context;
}
