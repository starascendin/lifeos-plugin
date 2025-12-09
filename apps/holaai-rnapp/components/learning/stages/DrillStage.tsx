import { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { useColor } from '@/hooks/useColor';
import { TranslationDrill } from '../drills/TranslationDrill';
import { FillBlankDrill } from '../drills/FillBlankDrill';
import { ListeningDrill } from '../drills/ListeningDrill';
import { MultipleChoiceDrill } from '../drills/MultipleChoiceDrill';
import type { StageType, DrillType, ItemMastery } from '@/app/(drawer)/journey/learn/[lessonId]';

interface DrillStageProps {
  stageType: StageType;
  content: any[];
  drillTypes: DrillType[];
  itemMastery: Record<string, ItemMastery>;
  onAnswer: (contentId: string, correct: boolean, drillType: string) => void;
  onHintUsed: () => void;
  onStageComplete: () => void;
}

interface DrillQueueItem {
  contentId: string;
  content: any;
  drillType: DrillType;
}

// Select appropriate drill type for content
function selectDrillType(
  content: any,
  availableTypes: DrillType[],
  recentDrills: DrillType[]
): DrillType {
  // Filter out recently used types for variety
  let candidates = availableTypes.filter((t) => !recentDrills.slice(-2).includes(t));
  if (candidates.length === 0) candidates = availableTypes;

  // Content-specific filtering
  if (content.type === 'grammar') {
    // Grammar prefers fill_blank and multiple_choice
    const grammarTypes = candidates.filter((t) =>
      ['fill_blank', 'multiple_choice', 'translation_en_es'].includes(t)
    );
    if (grammarTypes.length > 0) candidates = grammarTypes;
  }

  // Random selection from candidates
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Build initial drill queue
function buildDrillQueue(
  content: any[],
  drillTypes: DrillType[],
  mastery: Record<string, ItemMastery>
): DrillQueueItem[] {
  const queue: DrillQueueItem[] = [];
  const recentDrills: DrillType[] = [];

  content.forEach((item) => {
    const itemMastery = mastery[item._id];
    if (!itemMastery || itemMastery.isMastered) return;

    // Add item to queue with selected drill type
    const drillType = selectDrillType(item, drillTypes, recentDrills);
    queue.push({
      contentId: item._id,
      content: item,
      drillType,
    });
    recentDrills.push(drillType);
  });

  return queue;
}

export function DrillStage({
  stageType,
  content,
  drillTypes,
  itemMastery,
  onAnswer,
  onHintUsed,
  onStageComplete,
}: DrillStageProps) {
  const insets = useSafeAreaInsets();
  const primary = useColor('primary');
  const textMuted = useColor('textMuted');
  const success = '#22c55e';

  // Drill queue state
  const [queue, setQueue] = useState<DrillQueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recentDrills, setRecentDrills] = useState<DrillType[]>([]);

  // Initialize queue
  useEffect(() => {
    const initialQueue = buildDrillQueue(content, drillTypes, itemMastery);
    setQueue(initialQueue);
    setCurrentIndex(0);
  }, [content, drillTypes]);

  // Check for stage completion
  const isComplete = useMemo(() => {
    return content.every((item) => itemMastery[item._id]?.isMastered);
  }, [content, itemMastery]);

  // Calculate progress
  const masteredCount = useMemo(() => {
    return content.filter((item) => itemMastery[item._id]?.isMastered).length;
  }, [content, itemMastery]);

  // Current drill item
  const currentDrill = queue[currentIndex];

  // Handle drill answer
  const handleAnswer = useCallback(
    (correct: boolean) => {
      if (!currentDrill) return;

      onAnswer(currentDrill.contentId, correct, currentDrill.drillType);
      setRecentDrills((prev) => [...prev.slice(-3), currentDrill.drillType]);
    },
    [currentDrill, onAnswer]
  );

  // Handle continue to next drill
  const handleContinue = useCallback(() => {
    if (!currentDrill) return;

    const currentMastery = itemMastery[currentDrill.contentId];
    const isMastered = currentMastery?.isMastered;

    // Update queue based on mastery
    setQueue((prev) => {
      const newQueue = [...prev];

      if (isMastered) {
        // Item mastered, remove from queue
        return newQueue.filter((_, i) => i !== currentIndex);
      } else {
        // Not mastered yet, move to back of queue with new drill type
        const item = newQueue.splice(currentIndex, 1)[0];
        const newDrillType = selectDrillType(item.content, drillTypes, recentDrills);
        newQueue.push({ ...item, drillType: newDrillType });
        return newQueue;
      }
    });

    // Reset index if needed
    setCurrentIndex((prev) => {
      const newQueueLength = isMastered ? queue.length - 1 : queue.length;
      if (prev >= newQueueLength) return 0;
      return prev;
    });
  }, [currentDrill, currentIndex, itemMastery, drillTypes, recentDrills, queue.length]);

  // Check completion after queue changes
  useEffect(() => {
    if (isComplete) {
      onStageComplete();
    }
  }, [isComplete, onStageComplete]);

  // Get distractors for listening drill
  const getDistractors = useCallback(
    (item: any) => {
      return content
        .filter((c) => c._id !== item._id)
        .slice(0, 3)
        .map((c) => ({ spanish: c.spanish, english: c.english }));
    },
    [content]
  );

  // Render the appropriate drill component
  const renderDrill = () => {
    if (!currentDrill) return null;

    const { content: item, drillType } = currentDrill;

    switch (drillType) {
      case 'translation_en_es':
        return (
          <TranslationDrill
            item={item}
            direction="en_to_es"
            onAnswer={handleAnswer}
            onContinue={handleContinue}
          />
        );

      case 'translation_es_en':
        return (
          <TranslationDrill
            item={item}
            direction="es_to_en"
            onAnswer={handleAnswer}
            onContinue={handleContinue}
          />
        );

      case 'fill_blank':
        return (
          <FillBlankDrill
            item={item}
            onAnswer={handleAnswer}
            onContinue={handleContinue}
          />
        );

      case 'listening':
        return (
          <ListeningDrill
            item={item}
            distractors={getDistractors(item)}
            onAnswer={handleAnswer}
            onContinue={handleContinue}
          />
        );

      case 'multiple_choice':
        // For grammar rules, create a multiple choice question
        if (item.type === 'grammar' && item.examples?.length > 0) {
          const example = item.examples[0];
          return (
            <MultipleChoiceDrill
              question={`Choose the correct translation:`}
              questionSpanish={example.spanish}
              options={[
                example.english,
                'I want to eat',
                'She is walking',
                'We are studying',
              ]}
              correctAnswer={example.english}
              explanation={item.explanation}
              onAnswer={handleAnswer}
              onContinue={handleContinue}
            />
          );
        }
        // For vocab/phrases, fall back to translation
        return (
          <TranslationDrill
            item={item}
            direction="en_to_es"
            onAnswer={handleAnswer}
            onContinue={handleContinue}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Mastery progress indicator */}
      <View style={styles.masteryHeader}>
        <View style={styles.masteryDots}>
          {content.map((item, index) => {
            const isMastered = itemMastery[item._id]?.isMastered;
            const inProgress = itemMastery[item._id]?.correctCount > 0 && !isMastered;
            return (
              <View
                key={item._id}
                style={[
                  styles.masteryDot,
                  {
                    backgroundColor: isMastered
                      ? success
                      : inProgress
                        ? `${primary}50`
                        : `${textMuted}30`,
                  },
                ]}
              />
            );
          })}
        </View>
        <Text variant="caption" style={{ color: textMuted }}>
          {masteredCount} / {content.length} mastered
        </Text>
      </View>

      {/* Drill content */}
      <ScrollView
        style={styles.drillContainer}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {renderDrill()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  masteryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  masteryDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  masteryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  drillContainer: {
    flex: 1,
  },
});
