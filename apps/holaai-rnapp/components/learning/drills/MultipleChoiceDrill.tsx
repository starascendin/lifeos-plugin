import { useState, useMemo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';
import { SmallAudioButton } from '@/components/audio/SmallAudioButton';
import { DrillFeedback } from './DrillFeedback';
import { CheckCircle, XCircle } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

interface MultipleChoiceDrillProps {
  question: string;
  questionSpanish?: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  onAnswer: (correct: boolean) => void;
  onContinue: () => void;
}

export function MultipleChoiceDrill({
  question,
  questionSpanish,
  options,
  correctAnswer,
  explanation,
  onAnswer,
  onContinue,
}: MultipleChoiceDrillProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const primary = useColor('primary');
  const textMuted = useColor('textMuted');
  const card = useColor('card');
  const text = useColor('text');
  const success = '#22c55e';
  const error = '#ef4444';

  // Shuffle options on mount
  const shuffledOptions = useMemo(() => {
    const shuffled = [...options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [options]);

  const handleOptionSelect = (option: string) => {
    if (showFeedback) return;
    setSelectedOption(option);
  };

  const handleSubmit = () => {
    if (!selectedOption) return;

    const correct = selectedOption.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
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
        explanation={explanation}
        onContinue={handleContinue}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Question card */}
      <Card style={styles.questionCard}>
        <CardContent style={styles.questionContent}>
          <Text variant="body" style={styles.question}>
            {question}
          </Text>
          {questionSpanish && (
            <View style={styles.spanishRow}>
              <Text variant="caption" style={[styles.spanishText, { color: primary }]}>
                {questionSpanish}
              </Text>
              <SmallAudioButton text={questionSpanish} color={primary} size={18} />
            </View>
          )}
        </CardContent>
      </Card>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {shuffledOptions.map((option, index) => {
          const isSelected = selectedOption === option;
          const isCorrectOption = option === correctAnswer;
          const showCorrect = showFeedback && isCorrectOption;
          const showWrong = showFeedback && isSelected && !isCorrectOption;

          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleOptionSelect(option)}
              disabled={showFeedback}
              style={[
                styles.optionButton,
                {
                  backgroundColor: showCorrect
                    ? `${success}20`
                    : showWrong
                      ? `${error}20`
                      : isSelected
                        ? `${primary}20`
                        : card,
                  borderColor: showCorrect
                    ? success
                    : showWrong
                      ? error
                      : isSelected
                        ? primary
                        : 'transparent',
                },
              ]}
            >
              <View style={styles.optionContent}>
                <View
                  style={[
                    styles.optionLetter,
                    {
                      backgroundColor: showCorrect
                        ? success
                        : showWrong
                          ? error
                          : isSelected
                            ? primary
                            : `${textMuted}30`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.letterText,
                      {
                        color: isSelected || showCorrect || showWrong ? '#fff' : textMuted,
                      },
                    ]}
                  >
                    {String.fromCharCode(65 + index)}
                  </Text>
                </View>
                <Text
                  variant="body"
                  style={[styles.optionText, { color: text, flex: 1 }]}
                >
                  {option}
                </Text>
                {showCorrect && <Icon name={CheckCircle} size={20} color={success} />}
                {showWrong && <Icon name={XCircle} size={20} color={error} />}
              </View>
            </TouchableOpacity>
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
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  questionCard: {
    marginBottom: 24,
  },
  questionContent: {
    padding: 20,
  },
  question: {
    fontSize: 18,
    lineHeight: 26,
  },
  spanishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  spanishText: {
    fontStyle: 'italic',
    marginRight: 8,
  },
  optionsContainer: {
    marginBottom: 24,
  },
  optionButton: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionLetter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  letterText: {
    fontWeight: '600',
    fontSize: 14,
  },
  optionText: {
    fontSize: 16,
  },
  submitButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
