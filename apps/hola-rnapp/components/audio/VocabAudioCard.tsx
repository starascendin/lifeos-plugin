import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { useColor } from '@/hooks/useColor';
import { SpanishAudioCard } from './SpanishAudioCard';
import { SmallAudioButton } from './SmallAudioButton';

interface VocabAudioCardProps {
  spanish: string;
  english: string;
  exampleSentence?: string;
  exampleTranslation?: string;
  accentColor: string;
  style?: ViewStyle;
}

/**
 * Vocabulary card with word, translation, and optional example sentence with audio.
 */
export function VocabAudioCard({
  spanish,
  english,
  exampleSentence,
  exampleTranslation,
  accentColor,
  style,
}: VocabAudioCardProps) {
  const textMuted = useColor('textMuted');

  const additionalContent = exampleSentence ? (
    <View style={[styles.exampleBox, { backgroundColor: `${accentColor}10` }]}>
      <View style={styles.exampleRow}>
        <View style={styles.exampleTextContainer}>
          <Text style={[styles.exampleSpanish, { color: accentColor }]}>
            {exampleSentence}
          </Text>
          {exampleTranslation && (
            <Text style={[styles.exampleEnglish, { color: textMuted }]}>
              {exampleTranslation}
            </Text>
          )}
        </View>
        <SmallAudioButton text={exampleSentence} color={accentColor} size={16} />
      </View>
    </View>
  ) : undefined;

  return (
    <SpanishAudioCard
      spanishText={spanish}
      englishText={english}
      accentColor={accentColor}
      additionalContent={additionalContent}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  exampleBox: {
    padding: 12,
    borderRadius: 8,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  exampleTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  exampleSpanish: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  exampleEnglish: {
    fontSize: 12,
    marginTop: 4,
  },
});
