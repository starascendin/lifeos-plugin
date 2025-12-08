import { useState } from 'react';
import { ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import {
  BookOpen,
  CheckCircle,
  FileText,
  Languages,
  MessageSquare,
  Target
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { SmallAudioButton } from '@/components/audio/SmallAudioButton';
import type { Id } from '@holaai/convex/_generated/dataModel';

type TabType = 'objectives' | 'vocabulary' | 'grammar' | 'phrases' | 'exercises';

export default function LessonScreen() {
  const router = useRouter();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('objectives');

  const currentUser = useQuery(api.common.users.currentUser);

  const lessonData = useQuery(
    api.holaai.journey.getLessonContent,
    lessonId ? { lessonId: lessonId as Id<"hola_moduleLessons"> } : 'skip'
  );

  const completeLesson = useMutation(api.holaai.journey.completeLesson);

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const text = useColor('text');
  const card = useColor('card');

  const handleCompleteLesson = async () => {
    if (currentUser && lessonId) {
      await completeLesson({
        userId: currentUser._id,
        lessonId: lessonId as Id<"hola_moduleLessons">,
      });
      router.back();
    }
  };

  if (lessonData === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <Spinner variant='circle' />
      </View>
    );
  }

  if (!lessonData) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <Text variant='body' style={{ color: textMuted }}>
          Lesson not found
        </Text>
      </View>
    );
  }

  const tabs: { key: TabType; label: string; icon: any; count: number }[] = [
    { key: 'objectives', label: 'Goals', icon: Target, count: lessonData.objectives.length },
    { key: 'vocabulary', label: 'Vocab', icon: Languages, count: lessonData.vocabulary.length },
    { key: 'grammar', label: 'Grammar', icon: FileText, count: lessonData.grammar.length },
    { key: 'phrases', label: 'Phrases', icon: MessageSquare, count: lessonData.phrases.length },
    { key: 'exercises', label: 'Practice', icon: BookOpen, count: lessonData.exercises.length },
  ].filter(tab => tab.count > 0 || tab.key === 'objectives');

  const renderObjectives = () => (
    <View style={{ padding: 16 }}>
      <Text variant='title' style={{ marginBottom: 16 }}>
        Learning Objectives
      </Text>
      {lessonData.objectives.map((objective, index) => (
        <View key={index} style={styles.objectiveItem}>
          <View style={[styles.objectiveBullet, { backgroundColor: primary }]}>
            <Text style={styles.objectiveBulletText}>{index + 1}</Text>
          </View>
          <Text variant='body' style={{ flex: 1 }}>
            {objective}
          </Text>
        </View>
      ))}

      {lessonData.objectives.length === 0 && (
        <Text variant='body' style={{ color: textMuted }}>
          No specific objectives for this lesson.
        </Text>
      )}
    </View>
  );

  const renderVocabulary = () => (
    <View style={{ padding: 16 }}>
      <Text variant='title' style={{ marginBottom: 16 }}>
        Vocabulary ({lessonData.vocabulary.length} words)
      </Text>
      {lessonData.vocabulary.map((item) => (
        <Card key={item._id} style={{ marginBottom: 12 }}>
          <CardContent style={{ padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text variant='title' style={{ color: primary }}>
                    {item.spanish}
                  </Text>
                  <View style={{ marginLeft: 8 }}>
                    <SmallAudioButton text={item.spanish} color={primary} size={20} />
                  </View>
                </View>
                {item.pronunciation && (
                  <Text variant='caption' style={{ color: textMuted, fontStyle: 'italic' }}>
                    /{item.pronunciation}/
                  </Text>
                )}
                <Text variant='body' style={{ marginTop: 4 }}>
                  {item.english}
                </Text>
                {item.exampleSentence && (
                  <View style={styles.exampleContainer}>
                    <Text variant='caption' style={{ color: primary }}>
                      {item.exampleSentence}
                    </Text>
                    {item.exampleTranslation && (
                      <Text variant='caption' style={{ color: textMuted }}>
                        {item.exampleTranslation}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          </CardContent>
        </Card>
      ))}
    </View>
  );

  const renderGrammar = () => (
    <View style={{ padding: 16 }}>
      <Text variant='title' style={{ marginBottom: 16 }}>
        Grammar Rules ({lessonData.grammar.length})
      </Text>
      {lessonData.grammar.map((rule) => (
        <Card key={rule._id} style={{ marginBottom: 16 }}>
          <CardContent style={{ padding: 16 }}>
            <Text variant='title' style={{ marginBottom: 8 }}>
              {rule.title}
            </Text>
            <Text variant='body' style={{ marginBottom: 12 }}>
              {rule.explanation}
            </Text>

            {rule.formula && (
              <View style={[styles.formulaContainer, { backgroundColor: card }]}>
                <Text variant='caption' style={{ color: textMuted, marginBottom: 4 }}>
                  Formula:
                </Text>
                <Text variant='body' style={{ fontWeight: '600', color: primary }}>
                  {rule.formula}
                </Text>
              </View>
            )}

            {rule.examples.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text variant='caption' style={{ color: textMuted, marginBottom: 8 }}>
                  Examples:
                </Text>
                {rule.examples.map((example, idx) => (
                  <View key={idx} style={styles.exampleRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text variant='body' style={{ color: primary, flex: 1 }}>
                        {example.spanish}
                      </Text>
                      <SmallAudioButton text={example.spanish} color={primary} size={16} />
                    </View>
                    <Text variant='caption' style={{ color: textMuted }}>
                      {example.english}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {rule.tips.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text variant='caption' style={{ color: textMuted, marginBottom: 4 }}>
                  Tips:
                </Text>
                {rule.tips.map((tip, idx) => (
                  <Text key={idx} variant='caption' style={{ color: text, marginBottom: 2 }}>
                    • {tip}
                  </Text>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
      ))}
    </View>
  );

  const renderPhrases = () => (
    <View style={{ padding: 16 }}>
      <Text variant='title' style={{ marginBottom: 16 }}>
        Common Phrases ({lessonData.phrases.length})
      </Text>
      {lessonData.phrases.map((phrase) => (
        <Card key={phrase._id} style={{ marginBottom: 12 }}>
          <CardContent style={{ padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text variant='body' style={{ fontWeight: '600', color: primary }}>
                    {phrase.spanish}
                  </Text>
                  <View style={{ marginLeft: 8 }}>
                    <SmallAudioButton text={phrase.spanish} color={primary} size={18} />
                  </View>
                </View>
                <Text variant='body' style={{ marginTop: 2 }}>
                  {phrase.english}
                </Text>
                {phrase.context && (
                  <Text variant='caption' style={{ color: textMuted, marginTop: 4 }}>
                    Context: {phrase.context}
                  </Text>
                )}
                {phrase.formalityLevel && (
                  <View style={[styles.formalityBadge, {
                    backgroundColor: phrase.formalityLevel === 'formal' ? '#3b82f6' :
                      phrase.formalityLevel === 'informal' ? '#22c55e' : '#6b7280'
                  }]}>
                    <Text style={styles.formalityText}>
                      {phrase.formalityLevel}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </CardContent>
        </Card>
      ))}
    </View>
  );

  const renderExercises = () => (
    <View style={{ padding: 16 }}>
      <Text variant='title' style={{ marginBottom: 16 }}>
        Practice Exercises ({lessonData.exercises.length})
      </Text>
      {lessonData.exercises.length > 0 ? (
        <Button
          onPress={() => router.push('/practice')}
          style={{ marginBottom: 16 }}
        >
          <Text style={{ color: '#fff' }}>Start Practice Quiz</Text>
        </Button>
      ) : (
        <Text variant='body' style={{ color: textMuted }}>
          No exercises available for this lesson yet.
        </Text>
      )}

      {lessonData.exercises.map((exercise, index) => (
        <Card key={exercise._id} style={{ marginBottom: 12 }}>
          <CardContent style={{ padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={[styles.exerciseTypeBadge, { backgroundColor: primary }]}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>
                  {exercise.type.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
              <Text variant='caption' style={{ color: textMuted, marginLeft: 8 }}>
                Difficulty: {exercise.difficulty}/5
              </Text>
            </View>
            <Text variant='body'>
              {exercise.question}
            </Text>
          </CardContent>
        </Card>
      ))}
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'objectives': return renderObjectives();
      case 'vocabulary': return renderVocabulary();
      case 'grammar': return renderGrammar();
      case 'phrases': return renderPhrases();
      case 'exercises': return renderExercises();
      default: return null;
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: lessonData.lessonNumber }} />
      <View style={{ flex: 1, backgroundColor: background }}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: card }]}>
          <Text variant='heading' numberOfLines={2}>
            {lessonData.title}
          </Text>
          {lessonData.module && (
            <Text variant='caption' style={{ color: textMuted, marginTop: 4 }}>
              Module {lessonData.module.moduleNumber}: {lessonData.module.title}
            </Text>
          )}
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabsContainer, { borderBottomColor: card }]}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tab,
                  isActive && { borderBottomColor: primary, borderBottomWidth: 2 }
                ]}
              >
                <Icon
                  name={tab.icon}
                  color={isActive ? primary : textMuted}
                  size={18}
                />
                <Text
                  variant='caption'
                  style={[
                    styles.tabText,
                    { color: isActive ? primary : textMuted }
                  ]}
                >
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: isActive ? primary : textMuted }]}>
                    <Text style={styles.tabBadgeText}>{tab.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Content */}
        <ScrollView style={{ flex: 1 }}>
          {renderContent()}
        </ScrollView>

        {/* Complete Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button
            onPress={handleCompleteLesson}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name={CheckCircle} color='#fff' size={20} />
            <Text style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}>
              Mark as Complete
            </Text>
          </Button>
        </View>
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
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    maxHeight: 50,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 4,
  },
  tabText: {
    marginLeft: 6,
    fontWeight: '600',
  },
  tabBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  objectiveItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  objectiveBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  objectiveBulletText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  exampleContainer: {
    marginTop: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#e5e7eb',
  },
  formulaContainer: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  exampleRow: {
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#e5e7eb',
  },
  formalityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 8,
  },
  formalityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  exerciseTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});
