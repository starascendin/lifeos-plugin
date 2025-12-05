import { FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import {
  MessageSquare,
  Clock,
  ChevronRight,
  Trash2,
  Mic,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { Id } from '@holaai/convex/_generated/dataModel';

export default function VoiceHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const convexUser = useQuery(api.users.currentUser);
  const conversations = useQuery(
    api.voice.listVoiceConversations,
    convexUser ? { userId: convexUser._id, limit: 50 } : 'skip'
  );

  const deleteConversation = useMutation(api.voice.deleteVoiceConversation);

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const card = useColor('card');

  const handleDelete = async (conversationId: Id<'voiceConversations'>) => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConversation({ conversationId });
            } catch (error) {
              console.error('Error deleting conversation:', error);
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
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

  // Show loading while fetching user or conversations
  if (convexUser === undefined || (convexUser && conversations === undefined)) {
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
          Please sign in to view voice history
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 16,
        }}
        ListEmptyComponent={
          <Card style={{ marginTop: 20 }}>
            <CardContent style={{ alignItems: 'center', padding: 32 }}>
              <Icon name={Mic} color={textMuted} size={48} />
              <Text variant='subtitle' style={{ marginTop: 16, textAlign: 'center' }}>
                No voice conversations yet
              </Text>
              <Text variant='caption' style={{ color: textMuted, textAlign: 'center', marginTop: 8 }}>
                Start a voice session to practice speaking Spanish!
              </Text>
            </CardContent>
          </Card>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/voice/${item._id}`)}
            activeOpacity={0.7}
          >
            <Card style={{ marginBottom: 12 }}>
              <CardContent style={{ padding: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {/* Icon */}
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: `${primary}20`,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Icon name={Mic} size={20} color={primary} />
                  </View>

                  {/* Content */}
                  <View style={{ flex: 1 }}>
                    <Text variant='title' style={{ fontSize: 16, marginBottom: 4 }}>
                      {item.title || 'Voice Session'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Icon name={Clock} size={12} color={textMuted} />
                      <Text variant='caption' style={{ color: textMuted, marginLeft: 4 }}>
                        {formatDate(item.createdAt)}
                      </Text>
                      {item.duration && (
                        <>
                          <Text variant='caption' style={{ color: textMuted, marginLeft: 8 }}>
                            {formatDuration(item.duration)}
                          </Text>
                        </>
                      )}
                      <Text variant='caption' style={{ color: textMuted, marginLeft: 8 }}>
                        {item.transcript.length} messages
                      </Text>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={() => handleDelete(item._id)}
                      style={{ padding: 8 }}
                    >
                      <Icon name={Trash2} size={20} color={textMuted} />
                    </TouchableOpacity>
                    <Icon name={ChevronRight} size={20} color={textMuted} />
                  </View>
                </View>
              </CardContent>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
