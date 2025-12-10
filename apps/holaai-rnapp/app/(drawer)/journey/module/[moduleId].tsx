import { useState } from 'react';
import { FlatList, TouchableOpacity, RefreshControl, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import {
  BookOpen,
  CheckCircle,
  Circle,
  Clock,
  FileQuestion,
  Play,
  RotateCcw,
  Sparkles
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { TTSProviderToggle } from '@/components/audio/TTSProviderToggle';
import type { Id } from '@holaai/convex/_generated/dataModel';

export default function ModuleDetailScreen() {
  const router = useRouter();
  const { moduleId } = useLocalSearchParams<{ moduleId: string }>();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const currentUser = useQuery(api.common.users.currentUser);

  const moduleData = useQuery(
    api.holaai.journey.getModuleWithLessons,
    moduleId
      ? { moduleId: moduleId as Id<"hola_learningModules">, userId: currentUser?._id }
      : 'skip'
  );

  const resetProgress = useMutation(api.holaai.journey.resetModuleProgress);

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const text = useColor('text');

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleResetProgress = () => {
    Alert.alert(
      'Reset Progress',
      'This will reset all your progress in this module. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            if (currentUser && moduleId) {
              await resetProgress({
                userId: currentUser._id,
                moduleId: moduleId as Id<"hola_learningModules">,
              });
            }
          },
        },
      ]
    );
  };

  const navigateToLesson = (lessonId: Id<"hola_moduleLessons">) => {
    router.push(`/journey/lesson/${lessonId}`);
  };

  const navigateToGenerate = () => {
    router.push(`/journey/generate/${moduleId}`);
  };

  if (moduleData === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <Spinner variant='circle' />
      </View>
    );
  }

  if (!moduleData) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <Text variant='body' style={{ color: textMuted }}>
          Module not found
        </Text>
      </View>
    );
  }

  const completedCount = moduleData.lessons.filter(l => l.isCompleted).length;
  const totalCount = moduleData.lessons.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Separate regular lessons from quiz
  const regularLessons = moduleData.lessons.filter(l => !l.isQuiz);
  const quizLesson = moduleData.lessons.find(l => l.isQuiz);

  return (
    <>
      <Stack.Screen options={{ title: `Module ${moduleData.moduleNumber}`, headerRight: () => <TTSProviderToggle /> }} />
      <View style={{ flex: 1, backgroundColor: background }}>
        <FlatList
          data={regularLessons}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 16,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            <View style={{ marginBottom: 20 }}>
              {/* Module Header */}
              <Card style={{ marginBottom: 16 }}>
                <CardContent style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <View
                      style={[
                        styles.moduleBadge,
                        { backgroundColor: primary }
                      ]}
                    >
                      <Text style={styles.moduleBadgeText}>
                        {moduleData.moduleNumber}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant='heading'>{moduleData.title}</Text>
                      {moduleData.level && (
                        <Text variant='caption' style={{ color: textMuted }}>
                          {moduleData.level.displayName}
                        </Text>
                      )}
                    </View>
                  </View>

                  <Text variant='body' style={{ color: textMuted, marginBottom: 12 }}>
                    {moduleData.description}
                  </Text>

                  {/* Progress Bar */}
                  <View style={styles.progressContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        { width: `${progressPercent}%`, backgroundColor: primary }
                      ]}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text variant='caption' style={{ color: textMuted }}>
                      {completedCount} / {totalCount} lessons completed
                    </Text>
                    <Text variant='caption' style={{ color: primary, fontWeight: '600' }}>
                      {progressPercent}%
                    </Text>
                  </View>

                  {/* Reset button */}
                  {completedCount > 0 && (
                    <TouchableOpacity
                      onPress={handleResetProgress}
                      style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}
                    >
                      <Icon name={RotateCcw} color={textMuted} size={14} />
                      <Text variant='caption' style={{ color: textMuted, marginLeft: 4 }}>
                        Reset progress
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Generate Conversation Button */}
                  <Button
                    onPress={navigateToGenerate}
                    variant='outline'
                    style={{
                      marginTop: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderColor: primary,
                    }}
                  >
                    <Icon name={Sparkles} color={primary} size={18} />
                    <Text style={{ color: primary, marginLeft: 8, fontWeight: '600' }}>
                      Generate Practice Conversation
                    </Text>
                  </Button>
                </CardContent>
              </Card>

              <Text variant='title' style={{ marginBottom: 8 }}>
                Lessons
              </Text>
            </View>
          }
          renderItem={({ item: lesson, index }) => {
            const LessonIcon = lesson.isCompleted ? CheckCircle : Circle;
            const iconColor = lesson.isCompleted ? '#22c55e' : textMuted;

            return (
              <TouchableOpacity
                onPress={() => navigateToLesson(lesson._id)}
                activeOpacity={0.7}
              >
                <Card style={styles.lessonCard}>
                  <CardContent style={{ padding: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {/* Lesson number & status */}
                      <View style={{ marginRight: 12, alignItems: 'center' }}>
                        <Text variant='caption' style={{ color: textMuted, marginBottom: 4 }}>
                          {lesson.lessonNumber}
                        </Text>
                        <Icon name={LessonIcon} color={iconColor} size={24} />
                      </View>

                      {/* Content */}
                      <View style={{ flex: 1 }}>
                        <Text variant='body' style={{ fontWeight: '600', marginBottom: 2 }}>
                          {lesson.title}
                        </Text>
                        <Text variant='caption' style={{ color: textMuted }} numberOfLines={2}>
                          {lesson.description}
                        </Text>

                        {/* Meta info */}
                        <View style={{ flexDirection: 'row', marginTop: 8 }}>
                          {lesson.estimatedMinutes && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
                              <Icon name={Clock} color={textMuted} size={12} />
                              <Text variant='caption' style={{ color: textMuted, marginLeft: 4 }}>
                                {lesson.estimatedMinutes} min
                              </Text>
                            </View>
                          )}
                          {lesson.objectives.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Icon name={BookOpen} color={textMuted} size={12} />
                              <Text variant='caption' style={{ color: textMuted, marginLeft: 4 }}>
                                {lesson.objectives.length} objectives
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <Icon name={Play} color={primary} size={20} />
                    </View>
                  </CardContent>
                </Card>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            quizLesson ? (
              <View style={{ marginTop: 24 }}>
                <Text variant='title' style={{ marginBottom: 12 }}>
                  Module Quiz
                </Text>
                <TouchableOpacity
                  onPress={() => navigateToLesson(quizLesson._id)}
                  activeOpacity={0.7}
                >
                  <Card style={[styles.quizCard, { borderColor: '#f59e0b' }]}>
                    <CardContent style={{ padding: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View
                          style={[
                            styles.quizBadge,
                            { backgroundColor: '#f59e0b' }
                          ]}
                        >
                          <Icon name={FileQuestion} color='#fff' size={24} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text variant='title' style={{ marginBottom: 4 }}>
                            {quizLesson.title}
                          </Text>
                          <Text variant='caption' style={{ color: textMuted }}>
                            Pass with 70% to unlock the next module
                          </Text>
                          {moduleData.progress?.quizScore !== undefined && moduleData.progress?.quizScore !== null && (
                            <Text
                              variant='caption'
                              style={{
                                color: moduleData.progress.quizScore >= 70 ? '#22c55e' : '#ef4444',
                                marginTop: 4,
                                fontWeight: '600'
                              }}
                            >
                              {`Best score: ${moduleData.progress.quizScore}%${moduleData.progress.quizScore >= 70 ? ' - Passed!' : ' - Try again'}`}
                            </Text>
                          )}
                        </View>
                        <Icon
                          name={moduleData.progress?.quizScore && moduleData.progress.quizScore >= 70 ? CheckCircle : Play}
                          color={moduleData.progress?.quizScore && moduleData.progress.quizScore >= 70 ? '#22c55e' : '#f59e0b'}
                          size={28}
                        />
                      </View>
                    </CardContent>
                  </Card>
                </TouchableOpacity>

                {/* Quiz attempts info */}
                {moduleData.progress?.quizAttempts !== undefined && moduleData.progress.quizAttempts > 0 && (
                  <Text variant='caption' style={{ color: textMuted, textAlign: 'center', marginTop: 8 }}>
                    {`${moduleData.progress.quizAttempts} attempt${moduleData.progress.quizAttempts !== 1 ? 's' : ''}`}
                  </Text>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <Card>
              <CardContent>
                <Text variant='body' style={{ color: textMuted, textAlign: 'center' }}>
                  No lessons available in this module yet.
                </Text>
              </CardContent>
            </Card>
          }
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
  moduleBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  moduleBadgeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  lessonCard: {
    marginBottom: 12,
  },
  quizCard: {
    borderWidth: 2,
  },
  quizBadge: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
});
