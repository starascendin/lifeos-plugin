import { useState } from 'react';
import { StyleSheet, TextInput, Keyboard } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';
import { SmallAudioButton } from '@/components/audio/SmallAudioButton';
import { DrillFeedback } from './DrillFeedback';
import { ArrowRight } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

interface TranslationDrillProps {
  item: {
    _id: string;
    spanish: string;
    english: string;
    pronunciation?: string;
  };
  direction: 'en_to_es' | 'es_to_en';
  onAnswer: (correct: boolean) => void;
  onContinue: () => void;
}

// Normalize answer for comparison (handle accents, spacing, punctuation)
function normalizeAnswer(answer: string): string {
  return answer
    .toLowerCase()
    .trim()
    // Normalize common accent variations
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics for comparison
    .replace(/[¿¡.,!?]/g, '') // Remove punctuation
    .replace(/\s+/g, ' '); // Normalize whitespace
}

// Check if answers match (with some flexibility)
function checkAnswer(userAnswer: string, correctAnswer: string): boolean {
  const normalizedUser = normalizeAnswer(userAnswer);
  const normalizedCorrect = normalizeAnswer(correctAnswer);

  // Exact match after normalization
  if (normalizedUser === normalizedCorrect) return true;

  // Allow for common variations
  // Remove articles for comparison
  const withoutArticles = (s: string) =>
    s.replace(/^(el|la|los|las|un|una|unos|unas|the|a|an)\s+/gi, '');

  if (withoutArticles(normalizedUser) === withoutArticles(normalizedCorrect)) return true;

  return false;
}

export function TranslationDrill({
  item,
  direction,
  onAnswer,
  onContinue,
}: TranslationDrillProps) {
  const [userInput, setUserInput] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const primary = useColor('primary');
  const textMuted = useColor('textMuted');
  const card = useColor('card');
  const background = useColor('background');
  const text = useColor('text');

  const isEnToEs = direction === 'en_to_es';
  const promptText = isEnToEs ? item.english : item.spanish;
  const correctAnswer = isEnToEs ? item.spanish : item.english;

  const handleSubmit = () => {
    Keyboard.dismiss();
    const correct = checkAnswer(userInput, correctAnswer);
    setIsCorrect(correct);
    setShowFeedback(true);
    onAnswer(correct);
  };

  const handleContinue = () => {
    setShowFeedback(false);
    setUserInput('');
    onContinue();
  };

  if (showFeedback) {
    return (
      <DrillFeedback
        isCorrect={isCorrect}
        correctAnswer={correctAnswer}
        userAnswer={userInput}
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

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: card,
              color: text,
              borderColor: userInput ? primary : `${textMuted}30`,
            },
          ]}
          value={userInput}
          onChangeText={setUserInput}
          placeholder={`Type in ${isEnToEs ? 'Spanish' : 'English'}...`}
          placeholderTextColor={textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={userInput.trim() ? handleSubmit : undefined}
        />
        {isEnToEs && (
          <View style={styles.previewButton}>
            <SmallAudioButton
              text={userInput || item.spanish}
              color={textMuted}
              size={20}
            />
          </View>
        )}
      </View>

      {/* Submit button */}
      <Button
        onPress={handleSubmit}
        disabled={!userInput.trim()}
        style={[
          styles.submitButton,
          { opacity: userInput.trim() ? 1 : 0.5 },
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
  inputContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  input: {
    fontSize: 18,
    padding: 16,
    paddingRight: 50,
    borderRadius: 12,
    borderWidth: 2,
    minHeight: 56,
  },
  previewButton: {
    position: 'absolute',
    right: 12,
    top: 16,
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
