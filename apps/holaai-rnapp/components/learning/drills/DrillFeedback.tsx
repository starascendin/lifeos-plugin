import { StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';
import { SmallAudioButton } from '@/components/audio/SmallAudioButton';
import { CheckCircle, XCircle, Lightbulb } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

interface DrillFeedbackProps {
  isCorrect: boolean;
  correctAnswer: string;
  userAnswer?: string;
  explanation?: string;
  pronunciation?: string;
  onContinue: () => void;
}

export function DrillFeedback({
  isCorrect,
  correctAnswer,
  userAnswer,
  explanation,
  pronunciation,
  onContinue,
}: DrillFeedbackProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const success = '#22c55e';
  const error = '#ef4444';
  const textMuted = useColor('textMuted');
  const card = useColor('card');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          backgroundColor: isCorrect ? `${success}15` : `${error}15`,
          borderColor: isCorrect ? success : error,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Icon
          name={isCorrect ? CheckCircle : XCircle}
          size={28}
          color={isCorrect ? success : error}
        />
        <Text
          variant="title"
          style={[styles.headerText, { color: isCorrect ? success : error }]}
        >
          {isCorrect ? 'Correct!' : 'Not quite'}
        </Text>
      </View>

      {/* Show user's incorrect answer */}
      {!isCorrect && userAnswer && (
        <View style={styles.answerSection}>
          <Text variant="caption" style={{ color: textMuted }}>
            Your answer:
          </Text>
          <Text
            variant="body"
            style={[styles.userAnswer, { color: error, textDecorationLine: 'line-through' }]}
          >
            {userAnswer}
          </Text>
        </View>
      )}

      {/* Correct answer */}
      <View style={styles.answerSection}>
        <Text variant="caption" style={{ color: textMuted }}>
          {isCorrect ? 'Answer:' : 'Correct answer:'}
        </Text>
        <View style={styles.correctAnswerRow}>
          <Text variant="subtitle" style={[styles.correctAnswer, { color: success }]}>
            {correctAnswer}
          </Text>
          <SmallAudioButton text={correctAnswer} color={success} size={22} />
        </View>
        {pronunciation && (
          <Text variant="caption" style={[styles.pronunciation, { color: textMuted }]}>
            /{pronunciation}/
          </Text>
        )}
      </View>

      {/* Explanation */}
      {explanation && !isCorrect && (
        <View style={[styles.explanationBox, { backgroundColor: card }]}>
          <View style={styles.explanationHeader}>
            <Icon name={Lightbulb} size={16} color="#f59e0b" />
            <Text variant="caption" style={[styles.explanationLabel, { color: '#f59e0b' }]}>
              Tip
            </Text>
          </View>
          <Text variant="caption" style={{ lineHeight: 20 }}>
            {explanation}
          </Text>
        </View>
      )}

      {/* Continue button */}
      <Button
        onPress={onContinue}
        style={[styles.button, { backgroundColor: isCorrect ? success : error }]}
      >
        <Text style={styles.buttonText}>
          {isCorrect ? 'Continue' : 'Got it'}
        </Text>
      </Button>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    marginHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    marginLeft: 12,
    fontWeight: '600',
  },
  answerSection: {
    marginBottom: 12,
  },
  userAnswer: {
    marginTop: 4,
  },
  correctAnswerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  correctAnswer: {
    fontWeight: '600',
    marginRight: 8,
  },
  pronunciation: {
    fontStyle: 'italic',
    marginTop: 2,
  },
  explanationBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  explanationLabel: {
    marginLeft: 6,
    fontWeight: '600',
  },
  button: {
    marginTop: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
