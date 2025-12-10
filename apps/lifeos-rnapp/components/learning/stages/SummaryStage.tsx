import { StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';
import {
  Trophy,
  Clock,
  Target,
  CheckCircle,
  RotateCcw,
  ArrowRight,
  Star,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { ItemMastery, SessionStats } from '@/app/(drawer)/journey/learn/[lessonId]';

interface SummaryStageProps {
  lessonData: {
    title: string;
    lessonNumber: string;
    vocabulary: any[];
    grammar: any[];
    phrases: any[];
  };
  sessionStats: SessionStats;
  itemMastery: Record<string, ItemMastery>;
  onComplete: () => void;
  onReviewAgain: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function getGrade(accuracy: number): { label: string; color: string; stars: number } {
  if (accuracy >= 95) return { label: 'Perfect!', color: '#f59e0b', stars: 5 };
  if (accuracy >= 85) return { label: 'Excellent!', color: '#22c55e', stars: 4 };
  if (accuracy >= 70) return { label: 'Great job!', color: '#3b82f6', stars: 3 };
  if (accuracy >= 50) return { label: 'Good effort!', color: '#8b5cf6', stars: 2 };
  return { label: 'Keep practicing!', color: '#ef4444', stars: 1 };
}

export function SummaryStage({
  lessonData,
  sessionStats,
  itemMastery,
  onComplete,
  onReviewAgain,
}: SummaryStageProps) {
  const insets = useSafeAreaInsets();
  const primary = useColor('primary');
  const textMuted = useColor('textMuted');
  const card = useColor('card');
  const success = '#22c55e';

  // Calculate stats
  const accuracy =
    sessionStats.totalDrills > 0
      ? Math.round((sessionStats.correctDrills / sessionStats.totalDrills) * 100)
      : 100;

  const grade = getGrade(accuracy);

  const masteredVocab = lessonData.vocabulary.filter(
    (v) => itemMastery[v._id]?.isMastered
  ).length;
  const masteredGrammar = lessonData.grammar.filter(
    (g) => itemMastery[g._id]?.isMastered
  ).length;
  const masteredPhrases = lessonData.phrases.filter(
    (p) => itemMastery[p._id]?.isMastered
  ).length;

  const totalMastered = masteredVocab + masteredGrammar + masteredPhrases;
  const totalItems =
    lessonData.vocabulary.length + lessonData.grammar.length + lessonData.phrases.length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Celebration header */}
        <View style={styles.header}>
          <View style={[styles.trophyContainer, { backgroundColor: `${grade.color}20` }]}>
            <Icon name={Trophy} size={48} color={grade.color} />
          </View>
          <Text variant="heading" style={styles.title}>
            Lesson Complete!
          </Text>
          <Text variant="subtitle" style={[styles.gradeText, { color: grade.color }]}>
            {grade.label}
          </Text>

          {/* Stars */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Icon
                key={star}
                name={Star}
                size={28}
                color={star <= grade.stars ? '#f59e0b' : `${textMuted}30`}
                fill={star <= grade.stars ? '#f59e0b' : 'transparent'}
              />
            ))}
          </View>
        </View>

        {/* Accuracy card */}
        <Card style={styles.card}>
          <CardContent style={styles.accuracyContent}>
            <Text style={[styles.accuracyNumber, { color: primary }]}>{accuracy}%</Text>
            <Text variant="caption" style={{ color: textMuted }}>
              Accuracy
            </Text>
            <Text variant="caption" style={[styles.drillCount, { color: textMuted }]}>
              {sessionStats.correctDrills} / {sessionStats.totalDrills} drills correct
            </Text>
          </CardContent>
        </Card>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <CardContent style={styles.statContent}>
              <Icon name={Clock} size={24} color={primary} />
              <Text variant="subtitle" style={styles.statValue}>
                {formatTime(sessionStats.totalTimeSpent)}
              </Text>
              <Text variant="caption" style={{ color: textMuted }}>
                Time
              </Text>
            </CardContent>
          </Card>
          <Card style={styles.statCard}>
            <CardContent style={styles.statContent}>
              <Icon name={Target} size={24} color={success} />
              <Text variant="subtitle" style={styles.statValue}>
                {totalMastered} / {totalItems}
              </Text>
              <Text variant="caption" style={{ color: textMuted }}>
                Mastered
              </Text>
            </CardContent>
          </Card>
        </View>

        {/* Items mastered breakdown */}
        <Card style={styles.card}>
          <CardContent style={styles.breakdownContent}>
            <Text variant="subtitle" style={styles.sectionTitle}>
              Items Mastered
            </Text>

            {lessonData.vocabulary.length > 0 && (
              <View style={styles.breakdownRow}>
                <Icon name={CheckCircle} size={18} color={success} />
                <Text variant="body" style={styles.breakdownText}>
                  {masteredVocab} Vocabulary words
                </Text>
              </View>
            )}

            {lessonData.grammar.length > 0 && (
              <View style={styles.breakdownRow}>
                <Icon name={CheckCircle} size={18} color={success} />
                <Text variant="body" style={styles.breakdownText}>
                  {masteredGrammar} Grammar rule{masteredGrammar !== 1 ? 's' : ''}
                </Text>
              </View>
            )}

            {lessonData.phrases.length > 0 && (
              <View style={styles.breakdownRow}>
                <Icon name={CheckCircle} size={18} color={success} />
                <Text variant="body" style={styles.breakdownText}>
                  {masteredPhrases} Phrase{masteredPhrases !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </CardContent>
        </Card>
      </ScrollView>

      {/* Fixed bottom buttons */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button onPress={onComplete} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Continue to Next Lesson</Text>
          <Icon name={ArrowRight} size={20} color="#fff" />
        </Button>
        <Button
          onPress={onReviewAgain}
          style={[styles.secondaryButton, { backgroundColor: card }]}
        >
          <Icon name={RotateCcw} size={18} color={textMuted} />
          <Text style={[styles.secondaryButtonText, { color: textMuted }]}>
            Practice Again
          </Text>
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  trophyContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
  },
  gradeText: {
    fontWeight: '600',
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  card: {
    marginBottom: 16,
  },
  accuracyContent: {
    padding: 24,
    alignItems: 'center',
  },
  accuracyNumber: {
    fontSize: 56,
    fontWeight: 'bold',
  },
  drillCount: {
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
  },
  statContent: {
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    marginTop: 8,
    fontWeight: '600',
  },
  breakdownContent: {
    padding: 16,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  breakdownText: {
    marginLeft: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginRight: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  secondaryButtonText: {
    fontWeight: '600',
    marginLeft: 8,
  },
});
