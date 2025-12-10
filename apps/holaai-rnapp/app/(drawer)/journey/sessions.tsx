import { useState } from 'react';
import { FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import { MessageSquare, ChevronRight, Heart, Sparkles } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { Id } from '@holaai/convex/_generated/dataModel';

export default function SessionsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const currentUser = useQuery(api.common.users.currentUser);
  const sessions = useQuery(
    api.holaai.ai.listSessions,
    currentUser ? { userId: currentUser._id } : 'skip'
  );

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const text = useColor('text');
  const card = useColor('card');
  const border = useColor('border');

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const navigateToSession = (sessionId: Id<"hola_conversationSessions">) => {
    router.push(`/journey/session/${sessionId}`);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (sessions === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: 'My Sessions' }} />
        <View style={[styles.centered, { backgroundColor: background }]}>
          <Spinner variant='circle' />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'My Sessions' }} />
      <View style={{ flex: 1, backgroundColor: background }}>
        <FlatList
          data={sessions}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 16,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Card>
              <CardContent style={{ alignItems: 'center', padding: 32 }}>
                <Icon name={Sparkles} size={48} color={textMuted} />
                <Text variant='body' style={{ color: textMuted, marginTop: 16, textAlign: 'center' }}>
                  No sessions yet
                </Text>
                <Text variant='caption' style={{ color: textMuted, textAlign: 'center', marginTop: 4 }}>
                  Generate AI conversations from any module to create sessions
                </Text>
              </CardContent>
            </Card>
          }
          renderItem={({ item: session }) => (
            <TouchableOpacity
              onPress={() => navigateToSession(session._id)}
              style={[styles.sessionCard, { backgroundColor: card, borderColor: border }]}
            >
              <View style={[styles.sessionIcon, { backgroundColor: `${primary}15` }]}>
                <Icon name={MessageSquare} size={20} color={primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text variant='body' style={{ fontWeight: '600', color: text, flex: 1 }} numberOfLines={1}>
                    {session.title}
                  </Text>
                  {session.isFavorite && (
                    <Icon name={Heart} size={14} color="#ef4444" fill="#ef4444" />
                  )}
                </View>
                <Text variant='caption' style={{ color: textMuted, marginTop: 2 }} numberOfLines={2}>
                  {session.scenarioDescription}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 12 }}>
                  <Text variant='caption' style={{ color: textMuted }}>
                    {formatDate(session.createdAt)}
                  </Text>
                  <Text variant='caption' style={{ color: primary }}>
                    {session.conversationCount} conversation{session.conversationCount !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <Icon name={ChevronRight} size={20} color={textMuted} />
            </TouchableOpacity>
          )}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  sessionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
