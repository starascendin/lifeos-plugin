import { useState, useMemo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';
import { useSpanishTTS } from '@/hooks/useSpanishTTS';
import { DrillFeedback } from './DrillFeedback';
import { Volume2, Loader } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

interface ListeningDrillProps {
  item: {
    _id: string;
    spanish: string;
    english: string;
    pronunciation?: string;
  };
  distractors: { spanish: string; english: string }[];
  onAnswer: (correct: boolean) => void;
  onContinue: () => void;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function ListeningDrill({
  item,
  distractors,
  onAnswer,
  onContinue,
}: ListeningDrillProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  const primary = useColor('primary');
  const textMuted = useColor('textMuted');
  const card = useColor('card');
  const text = useColor('text');
  const success = '#22c55e';

  const { speak, isPlaying } = useSpanishTTS();

  // Shuffle options (correct + distractors)
  const options = useMemo(() => {
    const allOptions = [
      { spanish: item.spanish, english: item.english, isCorrect: true },
      ...distractors.slice(0, 3).map((d) => ({ ...d, isCorrect: false })),
    ];
    return shuffleArray(allOptions);
  }, [item, distractors]);

  const handlePlayAudio = async () => {
    await speak(item.spanish);
    setHasPlayed(true);
  };

  const handleOptionSelect = (option: typeof options[0]) => {
    if (showFeedback) return;
    setSelectedOption(option.english);
  };

  const handleSubmit = () => {
    const selected = options.find((o) => o.english === selectedOption);
    if (!selected) return;

    const correct = selected.isCorrect;
    setIsCorrect(correct);
    setShowFeedback(true);
    onAnswer(correct);
  };

  const handleContinue = () => {
    setShowFeedback(false);
    setSelectedOption(null);
    setHasPlayed(false);
    onContinue();
  };

  if (showFeedback) {
    return (
      <DrillFeedback
        isCorrect={isCorrect}
        correctAnswer={item.spanish}
        userAnswer={selectedOption || ''}
        pronunciation={item.pronunciation}
        onContinue={handleContinue}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Instruction */}
      <Text variant="caption" style={[styles.instruction, { color: textMuted }]}>
        Listen and identify what you hear:
      </Text>

      {/* Audio player */}
      <Card style={styles.audioCard}>
        <CardContent style={styles.audioContent}>
          <TouchableOpacity
            onPress={handlePlayAudio}
            disabled={isPlaying}
            style={[
              styles.playButton,
              { backgroundColor: hasPlayed ? `${success}20` : `${primary}20` },
            ]}
          >
            {isPlaying ? (
              <Icon name={Loader} size={48} color={primary} />
            ) : (
              <Icon name={Volume2} size={48} color={hasPlayed ? success : primary} />
            )}
          </TouchableOpacity>
          <Text variant="caption" style={{ color: textMuted, marginTop: 12 }}>
            {isPlaying ? 'Playing...' : hasPlayed ? 'Tap to play again' : 'Tap to listen'}
          </Text>
        </CardContent>
      </Card>

      {/* Question */}
      <Text variant="subtitle" style={styles.question}>
        What did you hear?
      </Text>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {options.map((option, index) => {
          const isSelected = selectedOption === option.english;
          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleOptionSelect(option)}
              style={[
                styles.optionButton,
                {
                  backgroundColor: isSelected ? `${primary}20` : card,
                  borderColor: isSelected ? primary : 'transparent',
                },
              ]}
            >
              <View style={styles.optionContent}>
                <View
                  style={[
                    styles.optionRadio,
                    {
                      borderColor: isSelected ? primary : textMuted,
                      backgroundColor: isSelected ? primary : 'transparent',
                    },
                  ]}
                >
                  {isSelected && <View style={styles.radioInner} />}
                </View>
                <Text
                  variant="body"
                  style={[
                    styles.optionText,
                    { color: isSelected ? primary : text },
                  ]}
                >
                  {option.english}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Submit button */}
      <Button
        onPress={handleSubmit}
        disabled={!selectedOption || !hasPlayed}
        style={[
          styles.submitButton,
          { opacity: selectedOption && hasPlayed ? 1 : 0.5 },
        ]}
      >
        <Text style={styles.submitText}>Check Answer</Text>
      </Button>

      {!hasPlayed && (
        <Text variant="caption" style={[styles.hint, { color: textMuted }]}>
          Listen to the audio first
        </Text>
      )}
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
  audioCard: {
    marginBottom: 24,
  },
  audioContent: {
    padding: 32,
    alignItems: 'center',
  },
  playButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  question: {
    textAlign: 'center',
    marginBottom: 16,
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
  optionRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  optionText: {
    flex: 1,
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
  hint: {
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
