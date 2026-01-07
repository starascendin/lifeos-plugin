import { useState, useMemo } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Keyboard } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';
import { SmallAudioButton } from '@/components/audio/SmallAudioButton';
import { DrillFeedback } from './DrillFeedback';

interface FillBlankDrillProps {
  item: {
    _id: string;
    spanish: string;
    english: string;
    pronunciation?: string;
    exampleSentence?: string;
  };
  onAnswer: (correct: boolean) => void;
  onContinue: () => void;
}

// Generate a fill-in-the-blank exercise from a Spanish sentence
function generateFillBlank(spanish: string): { sentence: string; blank: string; options: string[] } {
  const words = spanish.split(' ');

  // Pick a word to blank out (prefer longer words, avoid first/last)
  const candidates = words
    .map((word, index) => ({ word, index }))
    .filter(({ word, index }) => {
      // Skip very short words and punctuation
      const cleanWord = word.replace(/[¿¡.,!?]/g, '');
      return cleanWord.length >= 3 && index > 0 && index < words.length - 1;
    });

  // If no good candidates, use the longest word
  const target = candidates.length > 0
    ? candidates.reduce((a, b) =>
        a.word.replace(/[¿¡.,!?]/g, '').length > b.word.replace(/[¿¡.,!?]/g, '').length ? a : b
      )
    : { word: words[Math.floor(words.length / 2)], index: Math.floor(words.length / 2) };

  // Create sentence with blank
  const sentence = words
    .map((w, i) => (i === target.index ? '_______' : w))
    .join(' ');

  // Get the blank word (preserve punctuation separately)
  const blank = target.word.replace(/[¿¡.,!?]/g, '');

  // Generate distractor options
  const distractors = generateDistractors(blank);
  const options = shuffleArray([blank, ...distractors]);

  return { sentence, blank, options };
}

// Generate plausible wrong answers
function generateDistractors(correctWord: string): string[] {
  const commonWords = [
    'es', 'está', 'son', 'están', 'tiene', 'tienen', 'hace', 'hacen',
    'va', 'van', 'quiere', 'quieren', 'puede', 'pueden', 'sabe', 'saben',
    'come', 'comen', 'bebe', 'beben', 'vive', 'viven', 'habla', 'hablan',
    'muy', 'más', 'bien', 'mal', 'aquí', 'allí', 'ahora', 'después',
    'grande', 'pequeño', 'bueno', 'malo', 'nuevo', 'viejo',
  ];

  // Filter out the correct word and pick random distractors
  const available = commonWords.filter(
    (w) => w.toLowerCase() !== correctWord.toLowerCase()
  );

  const shuffled = shuffleArray(available);
  return shuffled.slice(0, 3);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function FillBlankDrill({
  item,
  onAnswer,
  onContinue,
}: FillBlankDrillProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [useTyping, setUseTyping] = useState(false);

  const primary = useColor('primary');
  const textMuted = useColor('textMuted');
  const card = useColor('card');
  const text = useColor('text');

  // Generate the fill-blank exercise
  const exercise = useMemo(() => {
    // Use example sentence if available, otherwise use the spanish word in a simple context
    const sourceText = item.exampleSentence || `Yo quiero ${item.spanish}`;
    return generateFillBlank(sourceText);
  }, [item]);

  const handleOptionSelect = (option: string) => {
    if (showFeedback) return;
    setSelectedOption(option);
  };

  const handleSubmit = () => {
    Keyboard.dismiss();
    const answer = useTyping ? typedAnswer.trim() : selectedOption;
    if (!answer) return;

    const correct = answer.toLowerCase() === exercise.blank.toLowerCase();
    setIsCorrect(correct);
    setShowFeedback(true);
    onAnswer(correct);
  };

  const handleContinue = () => {
    setShowFeedback(false);
    setSelectedOption(null);
    setTypedAnswer('');
    onContinue();
  };

  if (showFeedback) {
    return (
      <DrillFeedback
        isCorrect={isCorrect}
        correctAnswer={exercise.blank}
        userAnswer={useTyping ? typedAnswer : selectedOption || ''}
        onContinue={handleContinue}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Instruction */}
      <Text variant="caption" style={[styles.instruction, { color: textMuted }]}>
        Complete the sentence:
      </Text>

      {/* Sentence with blank */}
      <Card style={styles.sentenceCard}>
        <CardContent style={styles.sentenceContent}>
          <View style={styles.sentenceRow}>
            <Text variant="body" style={styles.sentence}>
              {exercise.sentence}
            </Text>
            <SmallAudioButton
              text={item.exampleSentence || item.spanish}
              color={primary}
              size={22}
            />
          </View>
          <Text variant="caption" style={[styles.translation, { color: textMuted }]}>
            ({item.english})
          </Text>
        </CardContent>
      </Card>

      {/* Options or typing toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          onPress={() => setUseTyping(false)}
          style={[
            styles.toggleButton,
            { backgroundColor: !useTyping ? primary : card },
          ]}
        >
          <Text style={{ color: !useTyping ? '#fff' : textMuted, fontWeight: '600' }}>
            Choose
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setUseTyping(true)}
          style={[
            styles.toggleButton,
            { backgroundColor: useTyping ? primary : card },
          ]}
        >
          <Text style={{ color: useTyping ? '#fff' : textMuted, fontWeight: '600' }}>
            Type
          </Text>
        </TouchableOpacity>
      </View>

      {/* Options grid or text input */}
      {!useTyping ? (
        <View style={styles.optionsGrid}>
          {exercise.options.map((option, index) => {
            const isSelected = selectedOption === option;
            return (
              <TouchableOpacity
                key={index}
                onPress={() => handleOptionSelect(option)}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: isSelected ? primary : card,
                    borderColor: isSelected ? primary : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: isSelected ? '#fff' : text },
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: card,
              color: text,
              borderColor: typedAnswer ? primary : `${textMuted}30`,
            },
          ]}
          value={typedAnswer}
          onChangeText={setTypedAnswer}
          placeholder="Type the missing word..."
          placeholderTextColor={textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={typedAnswer.trim() ? handleSubmit : undefined}
        />
      )}

      {/* Submit button */}
      <Button
        onPress={handleSubmit}
        disabled={useTyping ? !typedAnswer.trim() : !selectedOption}
        style={[
          styles.submitButton,
          {
            opacity: (useTyping ? typedAnswer.trim() : selectedOption) ? 1 : 0.5,
          },
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
  instruction: {
    textAlign: 'center',
    marginBottom: 16,
  },
  sentenceCard: {
    marginBottom: 20,
  },
  sentenceContent: {
    padding: 20,
  },
  sentenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentence: {
    fontSize: 20,
    textAlign: 'center',
    marginRight: 8,
  },
  translation: {
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 6,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 24,
  },
  optionButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    margin: 6,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 2,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    fontSize: 18,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 24,
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
