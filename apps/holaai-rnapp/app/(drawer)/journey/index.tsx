import { useState, useEffect } from 'react';
import { FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import { useJourneySettings } from '@/contexts/JourneySettingsContext';
import {
  BookOpen,
  ChevronRight,
  Lock,
  CheckCircle,
  PlayCircle,
  Trophy,
  Target,
  Database,
  Sparkles,
  MessageSquare,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { TTSProviderToggle } from '@/components/audio/TTSProviderToggle';
import { useAuth } from '@clerk/clerk-expo';
import type { Id } from '@holaai/convex/_generated/dataModel';

export default function JourneyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const { settings: journeySettings } = useJourneySettings();
  const [refreshing, setRefreshing] = useState(false);

  // Get A1 level first
  const levels = useQuery(api.holaai.content.listLevels);
  const a1Level = levels?.find(l => l.name === 'A1');

  // Get current user
  const currentUser = useQuery(api.common.users.currentUser);

  // Get journey progress for A1
  const journeyProgress = useQuery(
    api.holaai.journey.getUserJourneyProgress,
    currentUser && a1Level
      ? { userId: currentUser._id, levelId: a1Level._id }
      : 'skip'
  );

  // Get modules
  const modules = useQuery(
    api.holaai.journey.listModules,
    a1Level
      ? { levelId: a1Level._id, userId: currentUser?._id }
      : 'skip'
  );

  // Get all user's AI conversation sessions
  const sessions = useQuery(
    api.holaai.ai.listSessions,
    currentUser ? { userId: currentUser._id } : 'skip'
  );

  const initializeJourney = useMutation(api.holaai.journey.initializeJourney);
  const seedA1Journey = useMutation(api.holaai.seed.seedA1Journey);
  const [seeding, setSeeding] = useState(false);

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const text = useColor('text');
  const card = useColor('card');

  // Initialize journey when user first visits
  useEffect(() => {
    if (currentUser && a1Level && modules?.length && journeyProgress === null) {
      initializeJourney({ userId: currentUser._id, levelId: a1Level._id });
    }
  }, [currentUser, a1Level, modules, journeyProgress]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const navigateToModule = (moduleId: Id<"hola_learningModules">) => {
    router.push(`/journey/module/${moduleId}`);
  };

  const navigateToSession = (sessionId: Id<"hola_conversationSessions">) => {
    router.push(`/journey/session/${sessionId}`);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (levels === undefined || modules === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <Spinner variant='circle' />
      </View>
    );
  }

  if (!a1Level) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <Text variant='body' style={{ color: textMuted, textAlign: 'center' }}>
          A1 content not available.{'\n'}Please seed the database first.
        </Text>
        <Button
          onPress={() => router.push('/learn')}
          style={{ marginTop: 16 }}
        >
          <Text style={{ color: '#fff' }}>Go to Learn</Text>
        </Button>
      </View>
    );
  }

  const getModuleStatus = (module: any) => {
    if (module.progress?.completedAt) return 'completed';
    // Free mode unlocks all modules, otherwise check normal unlock logic
    if (journeySettings.freeMode || module.progress?.isUnlocked || module.moduleNumber === 1) {
      return 'unlocked';
    }
    return 'locked';
  };

  const getModuleIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'unlocked': return PlayCircle;
      default: return Lock;
    }
  };

  const getModuleColor = (status: string, moduleNumber: number) => {
    if (status === 'completed') return '#22c55e';
    if (status === 'unlocked') return primary;
    return textMuted;
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => <TTSProviderToggle />,
        }}
      />
      <View style={{ flex: 1, backgroundColor: background }}>
        <FlatList
          data={modules}
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
            {/* Progress Overview */}
            <Card style={{ marginBottom: 16 }}>
              <CardContent style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Icon name={Target} color={primary} size={24} />
                  <Text variant='title' style={{ marginLeft: 8 }}>
                    Your A1 Progress
                  </Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${journeyProgress?.overallProgress ?? 0}%`,
                        backgroundColor: primary
                      }
                    ]}
                  />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text variant='caption' style={{ color: textMuted }}>
                    {journeyProgress?.completedLessons ?? 0} / {journeyProgress?.totalLessons ?? 0} lessons
                  </Text>
                  <Text variant='caption' style={{ color: primary, fontWeight: '600' }}>
                    {journeyProgress?.overallProgress ?? 0}%
                  </Text>
                </View>
              </CardContent>
            </Card>

            <Text variant='body' style={{ color: textMuted, marginBottom: 16 }}>
              Complete each module to unlock the next. Pass the quiz with 70% or higher to progress.
            </Text>

            {/* My AI Sessions Button - Always visible */}
            <TouchableOpacity
              onPress={() => router.push('/journey/sessions')}
              style={[styles.sessionsButton, { backgroundColor: `${primary}15` }]}
            >
              <View style={[styles.sessionsButtonIcon, { backgroundColor: primary }]}>
                <Icon name={Sparkles} size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant='body' style={{ fontWeight: '600', color: text }}>
                  My AI Sessions
                </Text>
                <Text variant='caption' style={{ color: textMuted }}>
                  {sessions?.length ?? 0} saved conversation{(sessions?.length ?? 0) !== 1 ? 's' : ''}
                </Text>
              </View>
              <Icon name={ChevronRight} size={20} color={primary} />
            </TouchableOpacity>

            {/* My AI Conversation Sessions Preview */}
            {sessions && sessions.length > 0 && (
              <Card style={{ marginBottom: 16 }}>
                <CardContent style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Icon name={Sparkles} color={primary} size={20} />
                    <Text variant='title' style={{ marginLeft: 8, flex: 1 }}>
                      My AI Sessions
                    </Text>
                    <Text variant='caption' style={{ color: textMuted }}>
                      {sessions.length} saved
                    </Text>
                  </View>

                  {/* Show latest 3 sessions */}
                  {sessions.slice(0, 3).map((session, index, arr) => (
                    <TouchableOpacity
                      key={session._id}
                      onPress={() => navigateToSession(session._id)}
                      style={[
                        styles.conversationItem,
                        index === arr.length - 1 && { borderBottomWidth: 0 }
                      ]}
                    >
                      <View style={[styles.conversationIcon, { backgroundColor: `${primary}15` }]}>
                        <Icon name={MessageSquare} size={16} color={primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant='body' style={{ fontWeight: '500' }} numberOfLines={1}>
                          {session.title}
                        </Text>
                        <Text variant='caption' style={{ color: textMuted }} numberOfLines={1}>
                          {session.scenarioDescription}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text variant='caption' style={{ color: textMuted }}>
                          {formatDate(session.createdAt)}
                        </Text>
                        <Text variant='caption' style={{ color: primary, fontSize: 11 }}>
                          {session.conversationCount} conversation{session.conversationCount !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Icon name={ChevronRight} size={16} color={textMuted} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ))}

                </CardContent>
              </Card>
            )}

            <Text variant='subtitle' style={{ marginBottom: 8 }}>
              Modules
            </Text>
          </View>
          }
          ListEmptyComponent={
          <Card style={{ marginTop: 20 }}>
            <CardHeader>
              <CardTitle>No Modules Available</CardTitle>
              <CardDescription>
                The A1 learning journey hasn't been set up yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onPress={async () => {
                  setSeeding(true);
                  try {
                    await seedA1Journey();
                  } catch (error) {
                    console.error('Error seeding A1 journey:', error);
                  } finally {
                    setSeeding(false);
                  }
                }}
                disabled={seeding}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
              >
                {seeding ? (
                  <Spinner variant='circle' size='sm' />
                ) : (
                  <>
                    <Icon name={Database} color='#fff' size={18} />
                    <Text style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                      Seed A1 Journey
                    </Text>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
          }
          renderItem={({ item: module, index }) => {
          const status = getModuleStatus(module);
          const StatusIcon = getModuleIcon(status);
          const moduleColor = getModuleColor(status, module.moduleNumber);
          const isLocked = status === 'locked';

          return (
            <TouchableOpacity
              onPress={() => !isLocked && navigateToModule(module._id)}
              activeOpacity={isLocked ? 1 : 0.7}
              disabled={isLocked}
            >
              <Card style={[styles.moduleCard, isLocked && styles.lockedCard]}>
                <CardContent style={{ padding: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {/* Module Number */}
                    <View
                      style={[
                        styles.moduleBadge,
                        { backgroundColor: moduleColor }
                      ]}
                    >
                      <Text style={styles.moduleBadgeText}>
                        {module.moduleNumber}
                      </Text>
                    </View>

                    {/* Content */}
                    <View style={{ flex: 1 }}>
                      <Text
                        variant='title'
                        style={[
                          { marginBottom: 4 },
                          isLocked && { color: textMuted }
                        ]}
                      >
                        {module.title}
                      </Text>
                      <Text
                        variant='caption'
                        style={{ color: textMuted }}
                        numberOfLines={2}
                      >
                        {module.description}
                      </Text>

                      {/* Progress indicator for unlocked modules */}
                      {!isLocked && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                          <View style={[styles.miniProgressContainer, { flex: 1, marginRight: 8 }]}>
                            <View
                              style={[
                                styles.miniProgressBar,
                                {
                                  width: module.lessonsCount > 0
                                    ? `${(module.completedLessonsCount / module.lessonsCount) * 100}%`
                                    : '0%',
                                  backgroundColor: moduleColor
                                }
                              ]}
                            />
                          </View>
                          <Text variant='caption' style={{ color: textMuted, minWidth: 40 }}>
                            {module.completedLessonsCount}/{module.lessonsCount}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Status Icon */}
                    <Icon
                      name={StatusIcon}
                      color={moduleColor}
                      size={28}
                    />
                  </View>
                </CardContent>
              </Card>
            </TouchableOpacity>
          );
          }}
          ListFooterComponent={
          modules.length > 0 ? (
            <View style={{ marginTop: 24, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Icon name={Trophy} color='#f59e0b' size={20} />
                <Text variant='body' style={{ marginLeft: 8, fontWeight: '600' }}>
                  Final Assessment
                </Text>
              </View>
              <Text variant='caption' style={{ color: textMuted, textAlign: 'center' }}>
                Complete all modules to unlock{'\n'}A1 Practice Tests & Mock Exam
              </Text>
              <Button
                variant='outline'
                onPress={() => router.push('/tests')}
                style={{ marginTop: 12 }}
                disabled={journeyProgress?.completedModules !== journeyProgress?.totalModules}
              >
                <Text style={{ color: primary }}>View Practice Tests</Text>
              </Button>
            </View>
          ) : null
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
  miniProgressContainer: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressBar: {
    height: '100%',
    borderRadius: 2,
  },
  moduleCard: {
    marginBottom: 12,
  },
  lockedCard: {
    opacity: 0.6,
  },
  moduleBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  moduleBadgeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  conversationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sessionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  sessionsButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
