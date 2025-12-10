import { useState, useEffect } from 'react';
import { TouchableOpacity, Alert, StyleSheet, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import {
  Heart,
  Trash2,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  Lightbulb,
  RefreshCw,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { TTSProviderToggle } from '@/components/audio/TTSProviderToggle';
import type { Id } from '@holaai/convex/_generated/dataModel';

interface Suggestion {
  title: string;
  description: string;
  scenario: string;
}

export default function SessionDetailScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const insets = useSafeAreaInsets();

  // AI Suggestions state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const currentUser = useQuery(api.common.users.currentUser);
  const session = useQuery(
    api.holaai.ai.getSessionWithConversations,
    sessionId ? { sessionId: sessionId as Id<"hola_conversationSessions"> } : 'skip'
  );

  const toggleFavorite = useMutation(api.holaai.ai.toggleSessionFavorite);
  const deleteSession = useMutation(api.holaai.ai.deleteSession);
  const generateSuggestions = useAction(api.holaai.ai.generateSuggestions);

  // Fetch AI suggestions when session loads and has conversations
  useEffect(() => {
    if (currentUser && session && session.conversations.length > 0) {
      fetchSuggestions();
    }
  }, [currentUser?._id, session?.moduleId, session?.conversations.length]);

  const fetchSuggestions = async () => {
    if (!currentUser || !session) return;

    setLoadingSuggestions(true);
    try {
      const result = await generateSuggestions({
        userId: currentUser._id,
        moduleId: session.moduleId as Id<"hola_learningModules">,
        context: "after_conversation",
      });
      setSuggestions(result.suggestions);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSuggestionTap = (scenario: string) => {
    if (!session) return;
    router.push({
      pathname: '/journey/generate/[moduleId]',
      params: {
        moduleId: session.moduleId,
        scenario: scenario,
      },
    });
  };

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const text = useColor('text');
  const card = useColor('card');
  const border = useColor('border');

  const handleToggleFavorite = async () => {
    if (!sessionId) return;
    try {
      await toggleFavorite({ sessionId: sessionId as Id<"hola_conversationSessions"> });
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session and all its conversations?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!sessionId) return;
            try {
              await deleteSession({ sessionId: sessionId as Id<"hola_conversationSessions"> });
              router.back();
            } catch (error) {
              console.error('Error deleting session:', error);
            }
          },
        },
      ]
    );
  };

  const handleAddMore = () => {
    if (!session) return;
    router.push({
      pathname: '/journey/generate/[moduleId]',
      params: {
        moduleId: session.moduleId,
        sessionId: sessionId,
        scenario: session.scenarioDescription,
      },
    });
  };

  const navigateToConversation = (conversationId: Id<"hola_journeyConversations">) => {
    router.push(`/journey/conversation/${conversationId}`);
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

  if (session === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <Spinner variant='circle' />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <Text variant='body' style={{ color: textMuted }}>
          Session not found
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Session',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <Icon name={ChevronLeft} size={24} color={text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TTSProviderToggle />
              <TouchableOpacity onPress={handleToggleFavorite} style={{ padding: 8 }}>
                <Icon
                  name={Heart}
                  size={22}
                  color={session.isFavorite ? '#ef4444' : textMuted}
                  fill={session.isFavorite ? '#ef4444' : 'transparent'}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={{ padding: 8 }}>
                <Icon name={Trash2} size={22} color={textMuted} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <View style={[styles.container, { backgroundColor: background }]}>
        {/* Session Header */}
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: `${primary}15` }]}>
            <Icon name={Sparkles} size={28} color={primary} />
          </View>
          <Text variant='title' style={[styles.title, { color: text }]}>
            {session.title}
          </Text>
          <Text variant='body' style={[styles.scenario, { color: textMuted }]}>
            {session.scenarioDescription}
          </Text>
          {session.module && (
            <View style={[styles.moduleBadge, { backgroundColor: `${primary}15` }]}>
              <Text style={{ color: primary, fontSize: 12, fontWeight: '500' }}>
                {session.module.title}
              </Text>
            </View>
          )}
        </View>

        {/* Conversations List */}
        <Text variant='subtitle' style={[styles.sectionTitle, { color: text }]}>
          Conversations ({session.conversations.length})
        </Text>

        <FlatList
          data={session.conversations}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              onPress={() => navigateToConversation(item._id)}
              style={[styles.conversationCard, { backgroundColor: card, borderColor: border }]}
            >
              <View style={[styles.conversationNumber, { backgroundColor: `${primary}15` }]}>
                <Text style={{ color: primary, fontWeight: '600' }}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant='body' style={{ fontWeight: '500', color: text }} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text variant='caption' style={{ color: textMuted }}>
                  {item.dialogue.length} lines • {formatDate(item.createdAt)}
                </Text>
              </View>
              <Icon name={ChevronRight} size={20} color={textMuted} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Card>
              <CardContent style={{ alignItems: 'center', padding: 32 }}>
                <Icon name={MessageSquare} size={48} color={textMuted} />
                <Text variant='body' style={{ color: textMuted, marginTop: 16 }}>
                  No conversations yet
                </Text>
                <Text variant='caption' style={{ color: textMuted, textAlign: 'center', marginTop: 4 }}>
                  Tap "Add More" to generate a conversation for this scenario
                </Text>
              </CardContent>
            </Card>
          }
          ListFooterComponent={
            session.conversations.length > 0 ? (
              <View style={styles.whatsNextSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon name={Lightbulb} size={18} color={primary} />
                    <Text variant='subtitle' style={{ marginLeft: 8, color: text }}>
                      What's Next?
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={fetchSuggestions}
                    disabled={loadingSuggestions}
                    style={{ padding: 8 }}
                  >
                    <Icon
                      name={RefreshCw}
                      size={16}
                      color={loadingSuggestions ? textMuted : primary}
                    />
                  </TouchableOpacity>
                </View>

                <Text variant='caption' style={{ color: textMuted, marginBottom: 12 }}>
                  Continue learning with these personalized scenarios:
                </Text>

                {loadingSuggestions ? (
                  <View style={{ gap: 10 }}>
                    {[1, 2, 3].map((i) => (
                      <View
                        key={i}
                        style={[styles.suggestionCardSkeleton, { backgroundColor: card }]}
                      >
                        <View style={[styles.skeletonLine, { width: '60%', backgroundColor: textMuted }]} />
                        <View style={[styles.skeletonLine, { width: '90%', backgroundColor: textMuted, marginTop: 6 }]} />
                      </View>
                    ))}
                  </View>
                ) : suggestions.length > 0 ? (
                  <View style={{ gap: 10 }}>
                    {suggestions.map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => handleSuggestionTap(suggestion.scenario)}
                        style={[styles.suggestionCard, { backgroundColor: card }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text variant='body' style={{ fontWeight: '600', color: text, marginBottom: 4 }}>
                            {suggestion.title}
                          </Text>
                          <Text variant='caption' style={{ color: textMuted }}>
                            {suggestion.description}
                          </Text>
                        </View>
                        <Icon name={ChevronRight} size={18} color={textMuted} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null
          }
        />

        {/* Add More Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button onPress={handleAddMore} style={styles.addButton}>
            <Icon name={Plus} size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>
              Add More Conversations
            </Text>
          </Button>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  scenario: {
    textAlign: 'center',
    marginBottom: 12,
  },
  moduleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  conversationNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'transparent',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsNextSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  suggestionCardSkeleton: {
    padding: 14,
    borderRadius: 12,
    height: 70,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 4,
    opacity: 0.3,
  },
});
