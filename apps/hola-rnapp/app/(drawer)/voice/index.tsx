import { useState, useRef, useEffect, useCallback } from 'react';
import { ScrollView, TouchableOpacity, Alert, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { useUser } from '@clerk/clerk-expo';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import { useLiveKitVoice, TranscriptMessage } from '@/hooks/useLiveKitVoice';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  History,
  Waves,
  User,
  Bot,
  AlertTriangle,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import * as Speech from 'expo-speech';
import Constants from 'expo-constants';

// Check if we're in Expo Go (no native modules available)
const isExpoGo = Constants.appOwnership === 'expo';

// Dynamically import LiveKit only when not in Expo Go
let LiveKitRoom: any = null;
let AudioSession: any = null;
let useParticipants: any = null;
let useRoomContext: any = null;
let useTracks: any = null;
let RoomAudioRenderer: any = null;
let Track: any = null;
let RoomEvent: any = null;
let DataPacket_Kind: any = null;

if (!isExpoGo) {
  try {
    const livekit = require('@livekit/react-native');
    LiveKitRoom = livekit.LiveKitRoom;
    AudioSession = livekit.AudioSession;
    useParticipants = livekit.useParticipants;
    useRoomContext = livekit.useRoomContext;
    useTracks = livekit.useTracks;
    RoomAudioRenderer = livekit.RoomAudioRenderer;

    const livekitClient = require('livekit-client');
    Track = livekitClient.Track;
    RoomEvent = livekitClient.RoomEvent;
    DataPacket_Kind = livekitClient.DataPacket_Kind;
  } catch (e) {
    console.log('LiveKit not available:', e);
  }
}

// LiveKit room component that handles the actual connection
function VoiceRoom({
  onTranscript,
  onAgentConnected,
  onAgentSpeaking,
}: {
  onTranscript: (message: TranscriptMessage) => void;
  onAgentConnected: (connected: boolean) => void;
  onAgentSpeaking: (speaking: boolean) => void;
}) {
  if (!useRoomContext || !useParticipants || !useTracks || !RoomAudioRenderer) {
    return null;
  }

  const room = useRoomContext();
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Microphone, Track.Source.Unknown]);

  // Check if agent is connected
  useEffect(() => {
    const agentParticipant = participants.find((p: any) =>
      p.identity.toLowerCase().includes('agent')
    );
    onAgentConnected(!!agentParticipant);
  }, [participants, onAgentConnected]);

  // Listen for active speakers
  useEffect(() => {
    if (!room || !RoomEvent) return;

    const handleActiveSpeakers = (speakers: any[]) => {
      const agentSpeaking = speakers.some((s) =>
        s.identity?.toLowerCase().includes('agent')
      );
      onAgentSpeaking(agentSpeaking);
    };

    room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
    };
  }, [room, onAgentSpeaking]);

  // Listen for data messages (transcriptions)
  useEffect(() => {
    if (!room || !RoomEvent) return;

    const handleDataReceived = (
      payload: Uint8Array,
      participant: any,
      kind: any
    ) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));

        if (data.type === 'transcription' || data.text) {
          const isAgent = participant?.identity?.toLowerCase().includes('agent');
          onTranscript({
            role: isAgent ? 'assistant' : 'user',
            content: data.text || data.content,
            timestamp: Date.now(),
          });
        }
      } catch (e) {
        // Not JSON data, ignore
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, onTranscript]);

  return <RoomAudioRenderer />;
}

export default function VoiceScreen() {
  const { user } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const convexUser = useQuery(api.users.currentUser);
  const voiceStats = useQuery(
    api.voice.getVoiceStats,
    convexUser ? { userId: convexUser._id } : 'skip'
  );

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const card = useColor('card');
  const success = '#22c55e';
  const destructive = '#ef4444';
  const warning = '#f59e0b';

  // LiveKit hook - only use if not in Expo Go
  const voice = useLiveKitVoice({
    userId: convexUser?._id!,
    userName: user?.firstName || 'User',
  });

  // Start audio session on mount (only if available)
  useEffect(() => {
    if (AudioSession && !isExpoGo) {
      AudioSession.startAudioSession();
      return () => {
        AudioSession.stopAudioSession();
      };
    }
  }, []);

  // Pulse animation for recording
  useEffect(() => {
    if (voice.isConnected && !voice.isAgentSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [voice.isConnected, voice.isAgentSpeaking]);

  // Wave animation for agent speaking
  useEffect(() => {
    if (voice.isAgentSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(waveAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      waveAnim.setValue(0);
    }
  }, [voice.isAgentSpeaking]);

  const handleConnect = async () => {
    if (isExpoGo) {
      Alert.alert(
        'Dev Client Required',
        'Voice chat requires a development build. Run "npx expo run:ios" to build and test voice features.',
        [{ text: 'OK' }]
      );
      return;
    }
    try {
      await voice.connect();
    } catch (e) {
      Alert.alert('Connection Error', voice.error || 'Failed to connect');
    }
  };

  const handleDisconnect = async () => {
    await voice.disconnect();
  };

  const handleTranscript = useCallback(
    (message: TranscriptMessage) => {
      voice.addMessage(message);
    },
    [voice.addMessage]
  );

  // Show loading while fetching user
  if (convexUser === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background }}>
        <Spinner variant='circle' />
      </View>
    );
  }

  // If no user, show message
  if (!convexUser) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background, padding: 20 }}>
        <Text variant='subtitle' style={{ textAlign: 'center' }}>
          Please sign in to access voice practice
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      {/* LiveKit Room - only render when connected and not in Expo Go */}
      {!isExpoGo && LiveKitRoom && voice.isConnected && voice.token && voice.url && (
        <LiveKitRoom
          serverUrl={voice.url}
          token={voice.token}
          connect={true}
          options={{
            adaptiveStream: true,
            dynacast: true,
          }}
          audio={voice.isMicEnabled}
        >
          <VoiceRoom
            onTranscript={handleTranscript}
            onAgentConnected={voice.setAgentConnected}
            onAgentSpeaking={voice.setAgentSpeaking}
          />
        </LiveKitRoom>
      )}

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 16,
        }}
      >
        {/* Expo Go Warning */}
        {isExpoGo && (
          <Card style={{ marginBottom: 16, backgroundColor: `${warning}15` }}>
            <CardContent>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name={AlertTriangle} size={20} color={warning} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text variant='subtitle' style={{ color: warning, fontSize: 14 }}>
                    Running in Expo Go
                  </Text>
                  <Text variant='caption' style={{ color: textMuted }}>
                    Voice chat requires a dev build. Run "npx expo run:ios" to enable.
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant='body' style={{ color: textMuted, flex: 1 }}>
              Practice speaking Spanish with AI
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/voice/history')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: `${primary}20`,
                borderRadius: 16,
              }}
            >
              <Icon name={History} size={16} color={primary} />
              <Text style={{ color: primary, marginLeft: 6, fontSize: 14 }}>History</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Card */}
        {voiceStats && (
          <Card style={{ marginBottom: 24 }}>
            <CardContent>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: primary }}>
                    {voiceStats.totalConversations}
                  </Text>
                  <Text variant='caption' style={{ color: textMuted }}>
                    Sessions
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: primary }}>
                    {Math.round(voiceStats.totalDuration / 60)}
                  </Text>
                  <Text variant='caption' style={{ color: textMuted }}>
                    Minutes
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: primary }}>
                    {voiceStats.recentConversations}
                  </Text>
                  <Text variant='caption' style={{ color: textMuted }}>
                    This Week
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>
        )}

        {/* Voice Control Card */}
        <Card style={{ marginBottom: 24 }}>
          <CardHeader>
            <CardTitle>
              {voice.isConnected ? 'Voice Session Active' : 'Voice AI'}
            </CardTitle>
            <CardDescription>
              {voice.isConnected
                ? voice.isAgentConnected
                  ? 'Bella is ready to chat!'
                  : 'Waiting for Bella to join...'
                : 'Tap to start a voice conversation with Bella'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              {/* Connection Status Indicators */}
              {voice.isConnected && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: voice.isAgentConnected ? success : '#fbbf24',
                      marginRight: 8,
                    }}
                  />
                  <Text variant='caption' style={{ color: textMuted }}>
                    {voice.isAgentConnected ? 'Connected' : 'Connecting...'}
                  </Text>
                  {voice.isAgentSpeaking && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16 }}>
                      <Animated.View
                        style={{
                          opacity: waveAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.5, 1],
                          }),
                        }}
                      >
                        <Icon name={Waves} size={16} color={primary} />
                      </Animated.View>
                      <Text variant='caption' style={{ color: primary, marginLeft: 4 }}>
                        Bella is speaking
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Main Control Button */}
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  onPress={voice.isConnected ? handleDisconnect : handleConnect}
                  disabled={voice.isConnecting}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    backgroundColor: voice.isConnecting
                      ? textMuted
                      : voice.isConnected
                        ? destructive
                        : isExpoGo
                          ? textMuted
                          : primary,
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: voice.isConnected ? destructive : primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                  }}
                >
                  {voice.isConnecting ? (
                    <Spinner variant='circle' size='sm' />
                  ) : (
                    <Icon
                      name={voice.isConnected ? PhoneOff : Phone}
                      size={40}
                      color='#fff'
                    />
                  )}
                </TouchableOpacity>
              </Animated.View>

              <Text
                variant='caption'
                style={{ marginTop: 16, color: textMuted, textAlign: 'center' }}
              >
                {voice.isConnecting
                  ? 'Connecting...'
                  : voice.isConnected
                    ? 'Tap to end call'
                    : isExpoGo
                      ? 'Requires dev build'
                      : 'Tap to start voice call'}
              </Text>

              {/* Mic toggle when connected */}
              {voice.isConnected && (
                <TouchableOpacity
                  onPress={voice.toggleMic}
                  style={{
                    marginTop: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    backgroundColor: voice.isMicEnabled ? `${primary}20` : `${destructive}20`,
                    borderRadius: 20,
                  }}
                >
                  <Icon
                    name={voice.isMicEnabled ? Mic : MicOff}
                    size={18}
                    color={voice.isMicEnabled ? primary : destructive}
                  />
                  <Text
                    style={{
                      marginLeft: 8,
                      color: voice.isMicEnabled ? primary : destructive,
                    }}
                  >
                    {voice.isMicEnabled ? 'Mute' : 'Unmute'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Error Display */}
            {voice.error && (
              <View
                style={{
                  marginTop: 16,
                  padding: 12,
                  backgroundColor: `${destructive}20`,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: destructive, textAlign: 'center' }}>
                  {voice.error}
                </Text>
              </View>
            )}
          </CardContent>
        </Card>

        {/* Transcript Card */}
        {voice.transcript.length > 0 && (
          <Card style={{ marginBottom: 24 }}>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              {voice.transcript.map((msg, index) => (
                <View
                  key={index}
                  style={{
                    flexDirection: 'row',
                    marginBottom: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: msg.role === 'assistant' ? `${primary}20` : `${textMuted}20`,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Icon
                      name={msg.role === 'assistant' ? Bot : User}
                      size={16}
                      color={msg.role === 'assistant' ? primary : textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      variant='caption'
                      style={{
                        color: msg.role === 'assistant' ? primary : textMuted,
                        marginBottom: 2,
                      }}
                    >
                      {msg.role === 'assistant' ? 'Bella' : 'You'}
                    </Text>
                    <Text style={{ lineHeight: 20 }}>{msg.content}</Text>
                  </View>
                </View>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card style={{ backgroundColor: `${primary}10` }}>
          <CardContent>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name={Waves} size={24} color={primary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text variant='subtitle' style={{ color: primary }}>
                  Powered by LiveKit + Gemini 2.0
                </Text>
                <Text variant='caption' style={{ color: textMuted }}>
                  Real-time voice conversation with AI tutor
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
