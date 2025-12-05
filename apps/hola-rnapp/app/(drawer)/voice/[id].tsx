import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import {
  User,
  Bot,
  Clock,
  Mic,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { Id } from '@holaai/convex/_generated/dataModel';

export default function VoiceConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const conversation = useQuery(
    api.voice.getVoiceConversation,
    id ? { conversationId: id as Id<'voiceConversations'> } : 'skip'
  );

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const card = useColor('card');

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Show loading while fetching conversation
  if (conversation === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background }}>
        <Spinner variant='circle' />
      </View>
    );
  }

  // If no conversation found
  if (!conversation) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background, padding: 20 }}>
        <Text variant='subtitle' style={{ textAlign: 'center' }}>
          Conversation not found
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 16,
        }}
      >
        {/* Info Card */}
        <Card style={{ marginBottom: 24 }}>
          <CardContent>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: `${primary}20`,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}
              >
                <Icon name={Mic} size={24} color={primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant='title'>
                  {conversation.title || 'Voice Session'}
                </Text>
                <Text variant='caption' style={{ color: textMuted }}>
                  {formatDate(conversation.createdAt)}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: primary }}>
                  {formatDuration(conversation.duration || 0)}
                </Text>
                <Text variant='caption' style={{ color: textMuted }}>
                  Duration
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: primary }}>
                  {conversation.transcript.length}
                </Text>
                <Text variant='caption' style={{ color: textMuted }}>
                  Messages
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: primary }}>
                  {conversation.provider}
                </Text>
                <Text variant='caption' style={{ color: textMuted }}>
                  Provider
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Transcript */}
        <Text variant='subtitle' style={{ marginBottom: 16 }}>
          Transcript
        </Text>

        {conversation.transcript.length === 0 ? (
          <Card>
            <CardContent style={{ alignItems: 'center', padding: 24 }}>
              <Text variant='caption' style={{ color: textMuted, textAlign: 'center' }}>
                No transcript available for this conversation
              </Text>
            </CardContent>
          </Card>
        ) : (
          conversation.transcript.map((msg, index) => (
            <View
              key={index}
              style={{
                flexDirection: 'row',
                marginBottom: 16,
                alignItems: 'flex-start',
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: msg.role === 'assistant' ? `${primary}20` : `${textMuted}20`,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}
              >
                <Icon
                  name={msg.role === 'assistant' ? Bot : User}
                  size={18}
                  color={msg.role === 'assistant' ? primary : textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text
                    variant='caption'
                    style={{
                      color: msg.role === 'assistant' ? primary : textMuted,
                      fontWeight: '600',
                    }}
                  >
                    {msg.role === 'assistant' ? 'Bella' : 'You'}
                  </Text>
                  <Text variant='caption' style={{ color: textMuted, marginLeft: 8 }}>
                    {formatMessageTime(msg.timestamp)}
                  </Text>
                </View>
                <Card style={{ padding: 0 }}>
                  <CardContent style={{ padding: 12 }}>
                    <Text style={{ lineHeight: 22 }}>{msg.content}</Text>
                  </CardContent>
                </Card>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
