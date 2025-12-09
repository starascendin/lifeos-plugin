import { useState, useMemo } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';
import { SmallAudioButton } from '@/components/audio/SmallAudioButton';
import { DrillFeedback } from './DrillFeedback';
import { ArrowRight, Check } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

interface TranslationDrillProps {
  item: {
    _id: string;
    spanish: string;
    english: string;
    pronunciation?: string;
  };
  direction: 'en_to_es' | 'es_to_en';
  distractors: { spanish: string; english: string }[];
  onAnswer: (correct: boolean) => void;
  onContinue: () => void;
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function TranslationDrill({
  item,
  direction,
  distractors,
  onAnswer,
  onContinue,
}: TranslationDrillProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const primary = useColor('primary');
  const textMuted = useColor('textMuted');
  const card = useColor('card');
  const text = useColor('text');
  const success = '#22c55e';
  const error = '#ef4444';

  const isEnToEs = direction === 'en_to_es';
  const promptText = isEnToEs ? item.english : item.spanish;
  const correctAnswer = isEnToEs ? item.spanish : item.english;

  // Generate shuffled options: correct answer + distractors
  const options = useMemo(() => {
    const distractorAnswers = distractors
      .map((d) => (isEnToEs ? d.spanish : d.english))
      .filter((answer) => answer !== correctAnswer)
      .slice(0, 3);

    // Ensure we have enough options (fill with variations if needed)
    while (distractorAnswers.length < 3) {
      distractorAnswers.push(`Option ${distractorAnswers.length + 2}`);
    }

    return shuffleArray([correctAnswer, ...distractorAnswers]);
  }, [correctAnswer, distractors, isEnToEs]);

  const handleSubmit = () => {
    if (!selectedOption) return;
    const correct = selectedOption === correctAnswer;
    setIsCorrect(correct);
    setShowFeedback(true);
    onAnswer(correct);
  };

  const handleContinue = () => {
    setShowFeedback(false);
    setSelectedOption(null);
    onContinue();
  };

  if (showFeedback) {
    return (
      <DrillFeedback
        isCorrect={isCorrect}
        correctAnswer={correctAnswer}
        userAnswer={selectedOption || ''}
        pronunciation={isEnToEs ? item.pronunciation : undefined}
        onContinue={handleContinue}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Instruction */}
      <Text variant="caption" style={[styles.instruction, { color: textMuted }]}>
        Translate to {isEnToEs ? 'Spanish' : 'English'}:
      </Text>

      {/* Prompt card */}
      <Card style={styles.promptCard}>
        <CardContent style={styles.promptContent}>
          <View style={styles.promptRow}>
            <Text variant="title" style={styles.promptText}>
              "{promptText}"
            </Text>
            {!isEnToEs && (
              <SmallAudioButton text={item.spanish} color={primary} size={24} />
            )}
          </View>
        </CardContent>
      </Card>

      {/* Multiple choice options */}
      <View style={styles.optionsContainer}>
        {options.map((option, index) => {
          const isSelected = selectedOption === option;
          const optionLetter = String.fromCharCode(65 + index); // A, B, C, D

          return (
            <Pressable
              key={option}
              style={[
                styles.optionButton,
                {
                  backgroundColor: isSelected ? `${primary}15` : card,
                  borderColor: isSelected ? primary : `${textMuted}30`,
                },
              ]}
              onPress={() => setSelectedOption(option)}
            >
              <View
                style={[
                  styles.optionLetter,
                  {
                    backgroundColor: isSelected ? primary : `${textMuted}20`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionLetterText,
                    { color: isSelected ? '#fff' : textMuted },
                  ]}
                >
                  {optionLetter}
                </Text>
              </View>
              <Text
                variant="body"
                style={[styles.optionText, { color: text }]}
                numberOfLines={2}
              >
                {option}
              </Text>
              {isSelected && (
                <View style={[styles.checkIcon, { backgroundColor: primary }]}>
                  <Icon name={Check} size={14} color="#fff" />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Submit button */}
      <Button
        onPress={handleSubmit}
        disabled={!selectedOption}
        style={[
          styles.submitButton,
          { opacity: selectedOption ? 1 : 0.5 },
        ]}
      >
        <Text style={styles.submitText}>Check Answer</Text>
        <Icon name={ArrowRight} size={20} color="#fff" />
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  instruction: {
    textAlign: 'center',
    marginBottom: 16,
  },
  promptCard: {
    marginBottom: 24,
  },
  promptContent: {
    padding: 24,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptText: {
    fontSize: 24,
    textAlign: 'center',
    marginRight: 8,
  },
  optionsContainer: {
    marginBottom: 24,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  optionLetter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionLetterText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  optionText: {
    flex: 1,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginRight: 8,
  },
});
