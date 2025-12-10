import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { useColor } from '@/hooks/useColor';
import { SpanishAudioCard } from './SpanishAudioCard';

interface PhraseAudioCardProps {
  spanish: string;
  english: string;
  context?: string; // When to use this phrase
  formality?: 'formal' | 'informal' | 'neutral';
  accentColor: string;
  style?: ViewStyle;
}

/**
 * Phrase card with phrase, translation, context, and optional formality indicator.
 */
export function PhraseAudioCard({
  spanish,
  english,
  context,
  formality,
  accentColor,
  style,
}: PhraseAudioCardProps) {
  const textMuted = useColor('textMuted');

  const formalityColors = {
    formal: '#3b82f6',
    informal: '#22c55e',
    neutral: '#8b5cf6',
  };

  const additionalContent = (context || formality) ? (
    <View style={styles.metaContainer}>
      {formality && (
        <View style={[styles.formalityBadge, { backgroundColor: `${formalityColors[formality]}20` }]}>
          <Text style={[styles.formalityText, { color: formalityColors[formality] }]}>
            {formality.charAt(0).toUpperCase() + formality.slice(1)}
          </Text>
        </View>
      )}
      {context && (
        <Text style={[styles.contextText, { color: textMuted }]}>
          {context}
        </Text>
      )}
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
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  formalityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  formalityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  contextText: {
    fontSize: 13,
    fontStyle: 'italic',
    flex: 1,
  },
});
