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
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useColor } from '@/hooks/useColor';
import {
  Sparkles,
  Plus,
  Heart,
  Trash2,
  Clock,
  ChevronRight,
  BookOpen,
  X,
  Languages,
  MessageSquare,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { Id } from '@holaai/convex/_generated/dataModel';

export default function AILessonsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('all');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<'A1' | 'A2' | 'B1'>('A1');
  const [generating, setGenerating] = useState(false);

  const convexUser = useQuery(api.common.users.currentUser);
  const allLessons = useQuery(
    api.holaai.ai.listAiLessons,
    convexUser ? { userId: convexUser._id } : "skip"
  );
  const favoriteLessons = useQuery(
    api.holaai.ai.listAiLessons,
    convexUser ? { userId: convexUser._id, favoritesOnly: true } : "skip"
  );

  const generateLesson = useAction(api.holaai.ai.generateLesson);
  const toggleFavorite = useMutation(api.holaai.ai.toggleAiLessonFavorite);
  const deleteLesson = useMutation(api.holaai.ai.deleteAiLesson);

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const card = useColor('card');

  const handleGenerate = async () => {
    if (!prompt.trim() || !convexUser) return;

    setGenerating(true);
    try {
      const result = await generateLesson({
        userId: convexUser._id,
        prompt: prompt.trim(),
        level: selectedLevel,
      });
      setShowGenerateModal(false);
      setPrompt('');
      router.push(`/ai-lessons/${result.lessonId}`);
    } catch (error) {
      console.error('Error generating lesson:', error);
      Alert.alert('Error', 'Failed to generate lesson. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleFavorite = async (lessonId: Id<"hola_aiLessons">) => {
    try {
      await toggleFavorite({ lessonId });
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleDelete = async (lessonId: Id<"hola_aiLessons">) => {
    Alert.alert(
      'Delete Lesson',
      'Are you sure you want to delete this lesson?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLesson({ lessonId });
            } catch (error) {
              console.error('Error deleting lesson:', error);
            }
          },
        },
      ]
    );
  };

  const lessons = activeTab === 'favorites' ? favoriteLessons : allLessons;

  // Show loading while fetching user or initial lessons
  if (convexUser === undefined || (convexUser && lessons === undefined)) {
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
          Please sign in to access AI lessons
        </Text>
      </View>
    );
  }

  const levelColors: Record<string, string> = {
    A1: '#22c55e',
    A2: '#3b82f6',
    B1: '#f59e0b',
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
            Custom lessons generated by AI based on your topics
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
                All ({allLessons?.length || 0})
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
                  Favorites ({favoriteLessons?.length || 0})
                </Text>
              </View>
            </TabsTrigger>
          </TabsList>
        </View>

        <FlatList
          data={lessons}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 16,
          }}
          ListEmptyComponent={
            <Card style={{ marginTop: 20 }}>
              <CardContent style={{ alignItems: 'center', padding: 32 }}>
                <Icon name={Sparkles} color={textMuted} size={48} />
                <Text variant='subtitle' style={{ marginTop: 16, textAlign: 'center' }}>
                  No lessons yet
                </Text>
                <Text variant='caption' style={{ color: textMuted, textAlign: 'center', marginTop: 8 }}>
                  Generate your first custom AI lesson!
                </Text>
                <Button
                  onPress={() => setShowGenerateModal(true)}
                  style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center' }}
                >
                  <Icon name={Sparkles} color='#fff' size={18} />
                  <Text style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                    Generate Lesson
                  </Text>
                </Button>
              </CardContent>
            </Card>
          }
          renderItem={({ item: lesson }) => {
            const levelColor = levelColors[lesson.level] || primary;
            const vocabCount = lesson.content.vocabulary.length;
            const grammarCount = lesson.content.grammarRules.length;
            const phraseCount = lesson.content.phrases.length;

            return (
              <TouchableOpacity
                onPress={() => router.push(`/ai-lessons/${lesson._id}`)}
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
                          {lesson.level}
                        </Text>
                      </View>

                      {/* Content */}
                      <View style={{ flex: 1 }}>
                        <Text variant='title' style={{ fontSize: 16, marginBottom: 4 }}>
                          {lesson.title}
                        </Text>
                        <Text variant='caption' style={{ color: textMuted }} numberOfLines={2}>
                          {lesson.prompt}
                        </Text>

                        {/* Content counts */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Icon name={Languages} size={12} color={textMuted} />
                            <Text variant='caption' style={{ color: textMuted, marginLeft: 4 }}>
                              {vocabCount} words
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Icon name={BookOpen} size={12} color={textMuted} />
                            <Text variant='caption' style={{ color: textMuted, marginLeft: 4 }}>
                              {grammarCount} rules
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Icon name={MessageSquare} size={12} color={textMuted} />
                            <Text variant='caption' style={{ color: textMuted, marginLeft: 4 }}>
                              {phraseCount} phrases
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                          <Icon name={Clock} size={12} color={textMuted} />
                          <Text variant='caption' style={{ color: textMuted, marginLeft: 4 }}>
                            {formatDate(lesson.createdAt)}
                          </Text>
                          {lesson.estimatedMinutes && (
                            <Text variant='caption' style={{ color: textMuted, marginLeft: 8 }}>
                              ~{lesson.estimatedMinutes} min
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Actions */}
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity
                          onPress={() => handleToggleFavorite(lesson._id)}
                          style={{ padding: 8 }}
                        >
                          <Icon
                            name={Heart}
                            size={20}
                            color={lesson.isFavorite ? '#ef4444' : textMuted}
                            fill={lesson.isFavorite ? '#ef4444' : 'transparent'}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(lesson._id)}
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
            <Text variant='heading'>Generate Lesson</Text>
            <TouchableOpacity onPress={() => setShowGenerateModal(false)}>
              <Icon name={X} size={24} color={textMuted} />
            </TouchableOpacity>
          </View>

          {/* Level Selection */}
          <Text variant='subtitle' style={{ marginBottom: 12 }}>
            Select Level
          </Text>
          <View style={{ flexDirection: 'row', marginBottom: 24 }}>
            {(['A1', 'A2', 'B1'] as const).map((level) => (
              <TouchableOpacity
                key={level}
                onPress={() => setSelectedLevel(level)}
                style={{
                  flex: 1,
                  padding: 16,
                  marginRight: level !== 'B1' ? 8 : 0,
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
              </TouchableOpacity>
            ))}
          </View>

          {/* Topic Input */}
          <Text variant='subtitle' style={{ marginBottom: 12 }}>
            What do you want to learn?
          </Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="e.g., Vocabulary for going to the doctor, How to order at a Mexican restaurant..."
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

          {/* Example Topics */}
          <Text variant='caption' style={{ color: textMuted, marginTop: 12, marginBottom: 8 }}>
            Example topics:
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              'Going to the doctor',
              'Job interview phrases',
              'Making friends',
              'Emergency situations',
            ].map((example) => (
              <TouchableOpacity
                key={example}
                onPress={() => setPrompt(example)}
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
            disabled={!prompt.trim() || generating}
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
                  Generate Lesson
                </Text>
              </>
            )}
          </Button>
        </View>
      </Modal>
    </View>
  );
}
