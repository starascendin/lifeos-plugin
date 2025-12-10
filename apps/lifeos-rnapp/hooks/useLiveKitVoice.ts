import { useState, useCallback, useRef, useEffect } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import type { Id } from '@holaai/convex/_generated/dataModel';

export interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface UseLiveKitVoiceOptions {
  userId: Id<"users">;
  userName: string;
}

export interface UseLiveKitVoiceReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;

  // Agent state
  isAgentConnected: boolean;
  isAgentSpeaking: boolean;

  // Audio state
  isMicEnabled: boolean;

  // Transcript
  transcript: TranscriptMessage[];
  conversationId: Id<"hola_voiceConversations"> | null;

  // Room info
  roomName: string | null;
  token: string | null;
  url: string | null;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMic: () => void;
  clearTranscript: () => void;
  addMessage: (message: TranscriptMessage) => void;
  setAgentSpeaking: (speaking: boolean) => void;
  setAgentConnected: (connected: boolean) => void;
}

export function useLiveKitVoice({
  userId,
  userName,
}: UseLiveKitVoiceOptions): UseLiveKitVoiceReturn {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Agent state
  const [isAgentConnected, setIsAgentConnected] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);

  // Audio state
  const [isMicEnabled, setIsMicEnabled] = useState(true);

  // Room info
  const [roomName, setRoomName] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  // Transcript
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [conversationId, setConversationId] = useState<Id<"hola_voiceConversations"> | null>(null);

  // Track start time for duration calculation
  const startTimeRef = useRef<number | null>(null);

  // Convex actions
  const generateToken = useAction(api.holaai.voice.generateLiveKitToken);
  const dispatchAgent = useAction(api.holaai.voice.dispatchLiveKitAgent);
  const createConversation = useMutation(api.holaai.voice.createVoiceConversation);
  const addTranscriptMessage = useMutation(api.holaai.voice.addTranscriptMessage);
  const updateConversation = useMutation(api.holaai.voice.updateVoiceConversation);

  const addMessage = useCallback(
    async (message: TranscriptMessage) => {
      setTranscript((prev) => [...prev, message]);

      // Save to Convex if we have a conversation
      if (conversationId) {
        try {
          await addTranscriptMessage({
            conversationId,
            role: message.role,
            content: message.content,
          });
        } catch (e) {
          console.error('Failed to save transcript message:', e);
        }
      }
    },
    [conversationId, addTranscriptMessage]
  );

  const connect = useCallback(async () => {
    if (isConnected || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      // Generate unique room name
      const newRoomName = `holaai-${userId}-${Date.now()}`;

      // Get token from Convex
      const result = await generateToken({
        roomName: newRoomName,
        participantName: userName,
      });

      setRoomName(result.roomName);
      setToken(result.token);
      setUrl(result.url);

      // Create conversation in Convex
      const convId = await createConversation({
        userId,
        provider: 'livekit',
        title: `Voice Practice - ${new Date().toLocaleDateString()}`,
      });
      setConversationId(convId);
      startTimeRef.current = Date.now();

      // Dispatch the AI agent to join
      await dispatchAgent({ roomName: newRoomName });

      setIsConnected(true);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to connect';
      setError(errorMessage);
      console.error('LiveKit connection error:', e);
    } finally {
      setIsConnecting(false);
    }
  }, [
    isConnected,
    isConnecting,
    userId,
    userName,
    generateToken,
    dispatchAgent,
    createConversation,
  ]);

  const disconnect = useCallback(async () => {
    // Calculate duration
    const duration = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : 0;

    // Update conversation with duration
    if (conversationId && duration > 0) {
      try {
        await updateConversation({
          conversationId,
          duration,
        });
      } catch (e) {
        console.error('Failed to update conversation:', e);
      }
    }

    // Reset state
    setIsConnected(false);
    setIsAgentConnected(false);
    setIsAgentSpeaking(false);
    setRoomName(null);
    setToken(null);
    setUrl(null);
    startTimeRef.current = null;
  }, [conversationId, updateConversation]);

  const toggleMic = useCallback(() => {
    setIsMicEnabled((prev) => !prev);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript([]);
  }, []);

  return {
    isConnected,
    isConnecting,
    error,
    isAgentConnected,
    isAgentSpeaking,
    isMicEnabled,
    transcript,
    conversationId,
    roomName,
    token,
    url,
    connect,
    disconnect,
    toggleMic,
    clearTranscript,
    addMessage,
    setAgentSpeaking: setIsAgentSpeaking,
    setAgentConnected: setIsAgentConnected,
  };
}
