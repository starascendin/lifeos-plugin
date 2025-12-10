import { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, Alert, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import { LearningProgressBar } from '@/components/learning/LearningProgressBar';
import { IntroStage } from '@/components/learning/stages/IntroStage';
import { TeachingStage } from '@/components/learning/stages/TeachingStage';
import { DrillStage } from '@/components/learning/stages/DrillStage';
import { SummaryStage } from '@/components/learning/stages/SummaryStage';
import { TTSProviderToggle } from '@/components/audio/TTSProviderToggle';
import type { Id } from '@holaai/convex/_generated/dataModel';

// Types for the learning flow
export type StageType =
  | 'intro'
  | 'teach_vocab'
  | 'drill_vocab'
  | 'teach_grammar'
  | 'drill_grammar'
  | 'teach_phrases'
  | 'drill_phrases'
  | 'complex_practice'
  | 'summary';

export type DrillType =
  | 'translation_en_es'
  | 'translation_es_en'
  | 'fill_blank'
  | 'listening'
  | 'multiple_choice';

export interface LessonStage {
  id: string;
  type: StageType;
  title: string;
  contentIds: string[];
  isCompleted: boolean;
  drillTypes?: DrillType[];
}

export interface ItemMastery {
  contentType: 'vocabulary' | 'grammar' | 'phrase';
  contentId: string;
  correctCount: number;
  requiredCorrect: number;
  isMastered: boolean;
  attempts: { timestamp: number; correct: boolean; drillType: string }[];
}

export interface SessionStats {
  totalDrills: number;
  correctDrills: number;
  hintsUsed: number;
  totalTimeSpent: number;
}

// Helper to chunk arrays into batches
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Generate lesson stages from lesson content
function generateLessonStages(lessonData: any): LessonStage[] {
  const stages: LessonStage[] = [];
  const vocabBatchSize = 4;
  const grammarBatchSize = 1;
  const phraseBatchSize = 4;

  // 1. Intro
  stages.push({
    id: 'intro',
    type: 'intro',
    title: 'Introduction',
    contentIds: [],
    isCompleted: false,
  });

  // 2. Vocabulary stages (batched)
  const vocabIds: string[] = lessonData.vocabulary.map((v: any) => v._id);
  const vocabBatches = chunkArray(vocabIds, vocabBatchSize);
  vocabBatches.forEach((batch, i) => {
    stages.push({
      id: `teach_vocab_${i}`,
      type: 'teach_vocab',
      title: `New Vocabulary ${vocabBatches.length > 1 ? i + 1 : ''}`.trim(),
      contentIds: batch,
      isCompleted: false,
    });
    stages.push({
      id: `drill_vocab_${i}`,
      type: 'drill_vocab',
      title: `Practice Vocabulary ${vocabBatches.length > 1 ? i + 1 : ''}`.trim(),
      contentIds: batch,
      isCompleted: false,
      drillTypes: ['translation_en_es', 'translation_es_en', 'listening'],
    });
  });

  // 3. Grammar stages (batched)
  const grammarIds: string[] = lessonData.grammar.map((g: any) => g._id);
  const grammarBatches = chunkArray(grammarIds, grammarBatchSize);
  grammarBatches.forEach((batch, i) => {
    stages.push({
      id: `teach_grammar_${i}`,
      type: 'teach_grammar',
      title: `Grammar Rule ${grammarBatches.length > 1 ? i + 1 : ''}`.trim(),
      contentIds: batch,
      isCompleted: false,
    });
    stages.push({
      id: `drill_grammar_${i}`,
      type: 'drill_grammar',
      title: `Practice Grammar ${grammarBatches.length > 1 ? i + 1 : ''}`.trim(),
      contentIds: batch,
      isCompleted: false,
      drillTypes: ['fill_blank', 'translation_en_es', 'multiple_choice'],
    });
  });

  // 4. Phrase stages (batched)
  const phraseIds: string[] = lessonData.phrases.map((p: any) => p._id);
  const phraseBatches = chunkArray(phraseIds, phraseBatchSize);
  phraseBatches.forEach((batch, i) => {
    stages.push({
      id: `teach_phrases_${i}`,
      type: 'teach_phrases',
      title: `Common Phrases ${phraseBatches.length > 1 ? i + 1 : ''}`.trim(),
      contentIds: batch,
      isCompleted: false,
    });
    stages.push({
      id: `drill_phrases_${i}`,
      type: 'drill_phrases',
      title: `Practice Phrases ${phraseBatches.length > 1 ? i + 1 : ''}`.trim(),
      contentIds: batch,
      isCompleted: false,
      drillTypes: ['translation_es_en', 'listening', 'fill_blank'],
    });
  });

  // 5. Complex practice (all content mixed) - only if we have content
  const allContentIds = [...vocabIds, ...grammarIds, ...phraseIds];
  if (allContentIds.length > 0) {
    stages.push({
      id: 'complex_practice',
      type: 'complex_practice',
      title: 'Final Practice',
      contentIds: allContentIds,
      isCompleted: false,
      drillTypes: ['translation_en_es', 'translation_es_en', 'fill_blank', 'listening'],
    });
  }

  // 6. Summary
  stages.push({
    id: 'summary',
    type: 'summary',
    title: 'Lesson Complete!',
    contentIds: [],
    isCompleted: false,
  });

  return stages;
}

// Initialize mastery tracking for all content items
function initializeMastery(lessonData: any): Record<string, ItemMastery> {
  const mastery: Record<string, ItemMastery> = {};

  lessonData.vocabulary.forEach((item: any) => {
    mastery[item._id] = {
      contentType: 'vocabulary',
      contentId: item._id,
      correctCount: 0,
      requiredCorrect: 2,
      isMastered: false,
      attempts: [],
    };
  });

  lessonData.grammar.forEach((item: any) => {
    mastery[item._id] = {
      contentType: 'grammar',
      contentId: item._id,
      correctCount: 0,
      requiredCorrect: 2,
      isMastered: false,
      attempts: [],
    };
  });

  lessonData.phrases.forEach((item: any) => {
    mastery[item._id] = {
      contentType: 'phrase',
      contentId: item._id,
      correctCount: 0,
      requiredCorrect: 2,
      isMastered: false,
      attempts: [],
    };
  });

  return mastery;
}

export default function LearnLessonScreen() {
  const router = useRouter();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const insets = useSafeAreaInsets();

  const background = useColor('background');
  const textMuted = useColor('textMuted');

  // Convex queries
  const currentUser = useQuery(api.common.users.currentUser);
  const lessonData = useQuery(
    api.holaai.journey.getLessonContent,
    lessonId ? { lessonId: lessonId as Id<'hola_moduleLessons'> } : 'skip'
  );

  // Learning session state
  const [stages, setStages] = useState<LessonStage[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [itemMastery, setItemMastery] = useState<Record<string, ItemMastery>>({});
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    totalDrills: 0,
    correctDrills: 0,
    hintsUsed: 0,
    totalTimeSpent: 0,
  });
  const [startTime] = useState(Date.now());
  const [isInitialized, setIsInitialized] = useState(false);

  // Mutations
  const completeLesson = useMutation(api.holaai.journey.completeLesson);

  // Initialize session when lesson data loads
  useEffect(() => {
    if (lessonData && !isInitialized) {
      const generatedStages = generateLessonStages(lessonData);
      const initialMastery = initializeMastery(lessonData);
      setStages(generatedStages);
      setItemMastery(initialMastery);
      setIsInitialized(true);
    }
  }, [lessonData, isInitialized]);

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleExit();
      return true;
    });
    return () => backHandler.remove();
  }, [currentStageIndex]);

  const currentStage = stages[currentStageIndex];

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    if (stages.length === 0) return 0;
    const completedStages = stages.filter((s) => s.isCompleted).length;
    return Math.round((completedStages / stages.length) * 100);
  }, [stages]);

  // Get content items for current stage
  const getContentForStage = useCallback(
    (stage: LessonStage) => {
      if (!lessonData) return [];

      const contentMap: Record<string, any> = {};
      lessonData.vocabulary.forEach((v: any) => (contentMap[v._id] = { ...v, type: 'vocabulary' }));
      lessonData.grammar.forEach((g: any) => (contentMap[g._id] = { ...g, type: 'grammar' }));
      lessonData.phrases.forEach((p: any) => (contentMap[p._id] = { ...p, type: 'phrase' }));

      return stage.contentIds.map((id) => contentMap[id]).filter(Boolean);
    },
    [lessonData]
  );

  // Handle stage completion
  const handleStageComplete = useCallback(() => {
    setStages((prev) =>
      prev.map((s, i) => (i === currentStageIndex ? { ...s, isCompleted: true } : s))
    );

    if (currentStageIndex < stages.length - 1) {
      setCurrentStageIndex((prev) => prev + 1);
    }
  }, [currentStageIndex, stages.length]);

  // Handle drill answer
  const handleDrillAnswer = useCallback(
    (contentId: string, correct: boolean, drillType: string) => {
      setSessionStats((prev) => ({
        ...prev,
        totalDrills: prev.totalDrills + 1,
        correctDrills: correct ? prev.correctDrills + 1 : prev.correctDrills,
      }));

      setItemMastery((prev) => {
        const item = prev[contentId];
        if (!item) return prev;

        const newCorrectCount = correct ? item.correctCount + 1 : item.correctCount;
        const isMastered = newCorrectCount >= item.requiredCorrect;

        return {
          ...prev,
          [contentId]: {
            ...item,
            correctCount: newCorrectCount,
            isMastered,
            attempts: [
              ...item.attempts,
              { timestamp: Date.now(), correct, drillType },
            ],
          },
        };
      });
    },
    []
  );

  // Handle hint used
  const handleHintUsed = useCallback(() => {
    setSessionStats((prev) => ({
      ...prev,
      hintsUsed: prev.hintsUsed + 1,
    }));
  }, []);

  // Handle lesson completion
  const handleLessonComplete = useCallback(async () => {
    if (!currentUser || !lessonId) return;

    // Calculate final stats
    const totalTimeSpent = Math.round((Date.now() - startTime) / 1000);

    try {
      await completeLesson({
        userId: currentUser._id,
        lessonId: lessonId as Id<'hola_moduleLessons'>,
      });
      router.back();
    } catch (error) {
      console.error('Error completing lesson:', error);
      Alert.alert('Error', 'Failed to save progress. Please try again.');
    }
  }, [currentUser, lessonId, startTime, completeLesson, router]);

  // Handle exit
  const handleExit = useCallback(() => {
    if (currentStageIndex > 0) {
      Alert.alert(
        'Exit Learning?',
        'Your progress will be lost. Are you sure you want to exit?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Exit', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  }, [currentStageIndex, router]);

  // Loading state
  if (lessonData === undefined || !isInitialized) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <Spinner variant="circle" />
        <Text variant="caption" style={{ color: textMuted, marginTop: 12 }}>
          Preparing your lesson...
        </Text>
      </View>
    );
  }

  // Error state
  if (!lessonData) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <Text variant="body" style={{ color: textMuted }}>
          Lesson not found
        </Text>
      </View>
    );
  }

  // Render current stage
  const renderStage = () => {
    if (!currentStage) return null;

    const content = getContentForStage(currentStage);

    switch (currentStage.type) {
      case 'intro':
        return (
          <IntroStage
            lessonData={lessonData}
            onContinue={handleStageComplete}
          />
        );

      case 'teach_vocab':
      case 'teach_grammar':
      case 'teach_phrases':
        return (
          <TeachingStage
            stageType={currentStage.type}
            content={content}
            onContinue={handleStageComplete}
          />
        );

      case 'drill_vocab':
      case 'drill_grammar':
      case 'drill_phrases':
      case 'complex_practice':
        return (
          <DrillStage
            stageType={currentStage.type}
            content={content}
            drillTypes={currentStage.drillTypes || []}
            itemMastery={itemMastery}
            onAnswer={handleDrillAnswer}
            onHintUsed={handleHintUsed}
            onStageComplete={handleStageComplete}
          />
        );

      case 'summary':
        return (
          <SummaryStage
            lessonData={lessonData}
            sessionStats={{
              ...sessionStats,
              totalTimeSpent: Math.round((Date.now() - startTime) / 1000),
            }}
            itemMastery={itemMastery}
            onComplete={handleLessonComplete}
            onReviewAgain={() => {
              // Reset and start over
              setCurrentStageIndex(0);
              setStages(generateLessonStages(lessonData));
              setItemMastery(initializeMastery(lessonData));
              setSessionStats({
                totalDrills: 0,
                correctDrills: 0,
                hintsUsed: 0,
                totalTimeSpent: 0,
              });
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: lessonData.lessonNumber,
          headerBackTitle: 'Exit',
          headerRight: () => <TTSProviderToggle />,
        }}
      />
      <View style={[styles.container, { backgroundColor: background }]}>
        {/* Progress Header */}
        <LearningProgressBar
          progress={overallProgress}
          currentStage={currentStage?.title || ''}
          onExit={handleExit}
        />

        {/* Stage Content */}
        <View style={[styles.content, { paddingBottom: insets.bottom }]}>
          {renderStage()}
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
  content: {
    flex: 1,
  },
});
