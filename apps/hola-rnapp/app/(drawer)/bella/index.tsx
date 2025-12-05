import { useState } from 'react';
import { FlatList, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useAction } from 'convex/react';
import { useUser } from '@clerk/clerk-expo';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useColor } from '@/hooks/useColor';
import {
  MessageSquare,
  Plus,
  Heart,
  Trash2,
  Clock,
  ChevronRight,
  Sparkles,
  X,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { Id } from '@holaai/convex/_generated/dataModel';

export default function BellaScreen() {
  const router = useRouter();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('all');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [situation, setSituation] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<'A1' | 'A2'>('A1');
  const [generating, setGenerating] = useState(false);

  // Get user from Convex
  const convexUser = useQuery(api.users.currentUser);

  // Conversations queries
  const allConversations = useQuery(
    api.ai.listBellaConversations,
    convexUser ? { userId: convexUser._id } : 'skip'
  );
  const favoriteConversations = useQuery(
    api.ai.listBellaConversations,
    convexUser ? { userId: convexUser._id, favoritesOnly: true } : 'skip'
  );

  // Mutations and actions
  const generateConversation = useAction(api.ai.generateBellaConversation);
  const toggleFavorite = useMutation(api.ai.toggleBellaFavorite);
  const deleteConversation = useMutation(api.ai.deleteBellaConversation);

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const card = useColor('card');
  const destructive = useColor('destructive');

  const handleGenerate = async () => {
    if (!situation.trim() || !convexUser) return;

    setGenerating(true);
    try {
      const result = await generateConversation({
        userId: convexUser._id,
        situation: situation.trim(),
        level: selectedLevel,
      });
      setShowGenerateModal(false);
      setSituation('');
      // Navigate to the new conversation
      router.push(`/bella/${result.conversationId}`);
    } catch (error) {
      console.error('Error generating conversation:', error);
      Alert.alert('Error', 'Failed to generate conversation. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleFavorite = async (conversationId: Id<'bellaConversations'>) => {
    try {
      await toggleFavorite({ conversationId });
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleDelete = async (conversationId: Id<'bellaConversations'>) => {
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

  const conversations = activeTab === 'favorites' ? favoriteConversations : allConversations;

  // Show loading while fetching user or initial conversations
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
          Please sign in to access Bella AI conversations
        </Text>
      </View>
    );
  }

  const levelColors: Record<string, string> = {
    A1: '#22c55e',
    A2: '#3b82f6',
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

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      {/* Header */}
      <View style={{ padding: 16, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text variant='body' style={{ color: textMuted, flex: 1 }}>
            AI-generated conversation scenarios for practice
          </Text>
          <Button
            onPress={() => setShowGenerateModal(true)}
            style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}
          >
            <Icon name={Plus} color='#fff' size={18} />
            <Text style={{ color: '#fff', marginLeft: 6, fontWeight: '600' }}>New</Text>
          </Button>
        </View>
      </View>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <View style={{ paddingHorizontal: 16 }}>
          <TabsList>
            <TabsTrigger value='all'>
              <Text style={{ color: activeTab === 'all' ? primary : textMuted }}>
                All ({allConversations?.length || 0})
              </Text>
            </TabsTrigger>
            <TabsTrigger value='favorites'>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon
                  name={Heart}
                  size={14}
                  color={activeTab === 'favorites' ? primary : textMuted}
                />
                <Text style={{ marginLeft: 4, color: activeTab === 'favorites' ? primary : textMuted }}>
                  Favorites ({favoriteConversations?.length || 0})
                </Text>
              </View>
            </TabsTrigger>
          </TabsList>
        </View>

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
                <Icon name={MessageSquare} color={textMuted} size={48} />
                <Text variant='subtitle' style={{ marginTop: 16, textAlign: 'center' }}>
                  No conversations yet
                </Text>
                <Text variant='caption' style={{ color: textMuted, textAlign: 'center', marginTop: 8 }}>
                  Generate your first conversation scenario to start practicing Spanish!
                </Text>
                <Button
                  onPress={() => setShowGenerateModal(true)}
                  style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center' }}
                >
                  <Icon name={Sparkles} color='#fff' size={18} />
                  <Text style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                    Generate Conversation
                  </Text>
                </Button>
              </CardContent>
            </Card>
          }
          renderItem={({ item }) => {
            const levelColor = levelColors[item.level] || primary;

            return (
              <TouchableOpacity
                onPress={() => router.push(`/bella/${item._id}`)}
                activeOpacity={0.7}
              >
                <Card style={{ marginBottom: 12 }}>
                  <CardContent style={{ padding: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      {/* Level Badge */}
                      <View
                        style={{
                          backgroundColor: levelColor,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 6,
                          marginRight: 12,
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>
                          {item.level}
                        </Text>
                      </View>

                      {/* Content */}
                      <View style={{ flex: 1 }}>
                        <Text variant='title' style={{ fontSize: 16, marginBottom: 4 }}>
                          {item.title}
                        </Text>
                        <Text variant='caption' style={{ color: textMuted }} numberOfLines={2}>
                          {item.situation}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                          <Icon name={Clock} size={12} color={textMuted} />
                          <Text variant='caption' style={{ color: textMuted, marginLeft: 4 }}>
                            {formatDate(item.createdAt)}
                          </Text>
                          <Text variant='caption' style={{ color: textMuted, marginLeft: 12 }}>
                            {item.dialogue.length} exchanges
                          </Text>
                        </View>
                      </View>

                      {/* Actions */}
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity
                          onPress={() => handleToggleFavorite(item._id)}
                          style={{ padding: 8 }}
                        >
                          <Icon
                            name={Heart}
                            size={20}
                            color={item.isFavorite ? '#ef4444' : textMuted}
                            fill={item.isFavorite ? '#ef4444' : 'transparent'}
                          />
                        </TouchableOpacity>
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
            );
          }}
        />
      </Tabs>

      {/* Generate Modal */}
      <Modal
        visible={showGenerateModal}
        animationType='slide'
        presentationStyle='pageSheet'
        onRequestClose={() => setShowGenerateModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: background, padding: 20, paddingTop: 60 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Text variant='heading'>Generate Conversation</Text>
            <TouchableOpacity onPress={() => setShowGenerateModal(false)}>
              <Icon name={X} size={24} color={textMuted} />
            </TouchableOpacity>
          </View>

          {/* Level Selection */}
          <Text variant='subtitle' style={{ marginBottom: 12 }}>
            Select Level
          </Text>
          <View style={{ flexDirection: 'row', marginBottom: 24 }}>
            {(['A1', 'A2'] as const).map((level) => (
              <TouchableOpacity
                key={level}
                onPress={() => setSelectedLevel(level)}
                style={{
                  flex: 1,
                  padding: 16,
                  marginRight: level === 'A1' ? 8 : 0,
                  marginLeft: level === 'A2' ? 8 : 0,
                  borderRadius: 12,
                  backgroundColor: selectedLevel === level ? levelColors[level] : card,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: selectedLevel === level ? '#fff' : textMuted,
                  }}
                >
                  {level}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: selectedLevel === level ? 'rgba(255,255,255,0.8)' : textMuted,
                    marginTop: 4,
                  }}
                >
                  {level === 'A1' ? 'Beginner' : 'Elementary'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Situation Input */}
          <Text variant='subtitle' style={{ marginBottom: 12 }}>
            Describe the Situation
          </Text>
          <TextInput
            value={situation}
            onChangeText={setSituation}
            placeholder="e.g., Ordering food at a restaurant, Asking for directions..."
            placeholderTextColor={textMuted}
            multiline
            numberOfLines={4}
            style={{
              backgroundColor: card,
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
              minHeight: 120,
              textAlignVertical: 'top',
              color: textMuted,
            }}
          />

          {/* Example Situations */}
          <Text variant='caption' style={{ color: textMuted, marginTop: 12, marginBottom: 8 }}>
            Example situations:
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              'Ordering at a cafe',
              'Checking into a hotel',
              'Meeting someone new',
              'Shopping for clothes',
            ].map((example) => (
              <TouchableOpacity
                key={example}
                onPress={() => setSituation(example)}
                style={{
                  backgroundColor: card,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                }}
              >
                <Text variant='caption' style={{ color: primary }}>
                  {example}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Generate Button */}
          <View style={{ flex: 1 }} />
          <Button
            onPress={handleGenerate}
            disabled={!situation.trim() || generating}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: insets.bottom + 20,
            }}
          >
            {generating ? (
              <>
                <Spinner variant='circle' size='sm' />
                <Text style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                  Generating...
                </Text>
              </>
            ) : (
              <>
                <Icon name={Sparkles} color='#fff' size={18} />
                <Text style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                  Generate Conversation
                </Text>
              </>
            )}
          </Button>
        </View>
      </Modal>
    </View>
  );
}
