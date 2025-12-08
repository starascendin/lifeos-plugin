import { useState } from 'react';
import { ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useColor } from '@/hooks/useColor';
import { VocabAudioCard, PhraseAudioCard, GrammarAudioCard } from '@/components/audio';
import {
  Heart,
  Languages,
  BookOpen,
  MessageSquare,
  GraduationCap,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { Id } from '@holaai/convex/_generated/dataModel';

export default function AILessonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('vocabulary');

  const lesson = useQuery(
    api.ai.getAiLesson,
    id ? { lessonId: id as Id<'aiLessons'> } : "skip"
  );
  const toggleFavorite = useMutation(api.ai.toggleAiLessonFavorite);

  const primary = useColor('primary');
  const background = useColor('background');
  const foreground = useColor('foreground');
  const textMuted = useColor('textMuted');
  const card = useColor('card');

  const handleToggleFavorite = async () => {
    if (!lesson) return;
    try {
      await toggleFavorite({ lessonId: lesson._id });
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  if (lesson === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background }}>
        <Spinner variant='circle' />
      </View>
    );
  }

  if (!lesson) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background }}>
        <Text>Lesson not found</Text>
      </View>
    );
  }

  const levelColors: Record<string, string> = {
    A1: '#22c55e',
    A2: '#3b82f6',
    B1: '#f59e0b',
  };
  const levelColor = levelColors[lesson.level] || primary;

  return (
    <>
      <Stack.Screen
        options={{
          title: lesson.title,
          headerShown: true,
          headerTintColor: foreground,
          headerStyle: { backgroundColor: background },
          headerRight: () => (
            <TouchableOpacity onPress={handleToggleFavorite} style={{ padding: 8 }}>
              <Icon
                name={Heart}
                size={24}
                color={lesson.isFavorite ? '#ef4444' : textMuted}
                fill={lesson.isFavorite ? '#ef4444' : 'transparent'}
              />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={{ flex: 1, backgroundColor: background }}>
        {/* Header */}
        <View style={{ padding: 16 }}>
          <View
            style={{
              backgroundColor: levelColor,
              padding: 16,
              borderRadius: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>
                  {lesson.level}
                </Text>
              </View>
              {lesson.estimatedMinutes && (
                <Text style={{ color: 'rgba(255,255,255,0.8)', marginLeft: 8, fontSize: 12 }}>
                  ~{lesson.estimatedMinutes} min
                </Text>
              )}
            </View>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
              {lesson.title}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 }}>
              {lesson.prompt}
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <View style={{ paddingHorizontal: 16 }}>
            <TabsList>
              <TabsTrigger value='vocabulary'>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name={Languages} size={14} color={activeTab === 'vocabulary' ? levelColor : textMuted} />
                  <Text style={{ marginLeft: 4, color: activeTab === 'vocabulary' ? levelColor : textMuted }}>
                    Vocab ({lesson.content.vocabulary.length})
                  </Text>
                </View>
              </TabsTrigger>
              <TabsTrigger value='grammar'>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name={BookOpen} size={14} color={activeTab === 'grammar' ? levelColor : textMuted} />
                  <Text style={{ marginLeft: 4, color: activeTab === 'grammar' ? levelColor : textMuted }}>
                    Grammar ({lesson.content.grammarRules.length})
                  </Text>
                </View>
              </TabsTrigger>
              <TabsTrigger value='phrases'>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name={MessageSquare} size={14} color={activeTab === 'phrases' ? levelColor : textMuted} />
                  <Text style={{ marginLeft: 4, color: activeTab === 'phrases' ? levelColor : textMuted }}>
                    Phrases ({lesson.content.phrases.length})
                  </Text>
                </View>
              </TabsTrigger>
              {lesson.content.exercises && lesson.content.exercises.length > 0 && (
                <TabsTrigger value='exercises'>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon name={GraduationCap} size={14} color={activeTab === 'exercises' ? levelColor : textMuted} />
                    <Text style={{ marginLeft: 4, color: activeTab === 'exercises' ? levelColor : textMuted }}>
                      Quiz ({lesson.content.exercises.length})
                    </Text>
                  </View>
                </TabsTrigger>
              )}
            </TabsList>
          </View>

          <ScrollView
            contentContainerStyle={{
              padding: 16,
              paddingBottom: insets.bottom + 16,
            }}
          >
            {/* Vocabulary Tab - using VocabAudioCard */}
            <TabsContent value='vocabulary'>
              {lesson.content.vocabulary.map((item, index) => (
                <VocabAudioCard
                  key={index}
                  spanish={item.spanish}
                  english={item.english}
                  exampleSentence={item.exampleSentence}
                  accentColor={levelColor}
                  style={{ marginBottom: 12 }}
                />
              ))}
            </TabsContent>

            {/* Grammar Tab - using GrammarAudioCard */}
            <TabsContent value='grammar'>
              {lesson.content.grammarRules.map((rule, index) => (
                <GrammarAudioCard
                  key={index}
                  topic={rule.title}
                  explanation={rule.explanation}
                  examples={rule.examples}
                  accentColor={levelColor}
                  style={{ marginBottom: 16 }}
                />
              ))}
            </TabsContent>

            {/* Phrases Tab - using PhraseAudioCard */}
            <TabsContent value='phrases'>
              {lesson.content.phrases.map((phrase, index) => (
                <PhraseAudioCard
                  key={index}
                  spanish={phrase.spanish}
                  english={phrase.english}
                  context={phrase.context}
                  accentColor={levelColor}
                  style={{ marginBottom: 12 }}
                />
              ))}
            </TabsContent>

            {/* Exercises Tab */}
            {lesson.content.exercises && (
              <TabsContent value='exercises'>
                {lesson.content.exercises.map((exercise, index) => (
                  <Card key={index} style={{ marginBottom: 12 }}>
                    <CardContent>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <View
                          style={{
                            backgroundColor: `${levelColor}20`,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 4,
                          }}
                        >
                          <Text style={{ color: levelColor, fontSize: 12 }}>
                            {exercise.type === 'multiple_choice' ? 'Multiple Choice' : 'Fill in Blank'}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ marginBottom: 12 }}>{exercise.question}</Text>
                      {exercise.options && (
                        <View style={{ gap: 8 }}>
                          {exercise.options.map((option, i) => (
                            <View
                              key={i}
                              style={{
                                backgroundColor: option === exercise.correctAnswer ? `${levelColor}20` : card,
                                padding: 12,
                                borderRadius: 8,
                                flexDirection: 'row',
                                alignItems: 'center',
                              }}
                            >
                              <View
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 12,
                                  backgroundColor: option === exercise.correctAnswer ? levelColor : textMuted + '30',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  marginRight: 12,
                                }}
                              >
                                <Text
                                  style={{
                                    color: option === exercise.correctAnswer ? '#fff' : textMuted,
                                    fontWeight: '600',
                                    fontSize: 12,
                                  }}
                                >
                                  {String.fromCharCode(65 + i)}
                                </Text>
                              </View>
                              <Text
                                style={{
                                  color: option === exercise.correctAnswer ? levelColor : undefined,
                                  fontWeight: option === exercise.correctAnswer ? '500' : 'normal',
                                }}
                              >
                                {option}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            )}
          </ScrollView>
        </Tabs>
      </View>
    </>
  );
}
