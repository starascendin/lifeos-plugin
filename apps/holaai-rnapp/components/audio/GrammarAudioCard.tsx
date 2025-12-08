import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { useColor } from '@/hooks/useColor';
import { SmallAudioButton } from './SmallAudioButton';

interface GrammarExample {
  spanish: string;
  english: string;
}

interface GrammarAudioCardProps {
  topic: string;
  explanation: string;
  examples: GrammarExample[];
  tips?: string;
  accentColor: string;
  style?: ViewStyle;
}

/**
 * Grammar card with topic, explanation, examples with audio, and optional tips.
 */
export function GrammarAudioCard({
  topic,
  explanation,
  examples,
  tips,
  accentColor,
  style,
}: GrammarAudioCardProps) {
  const foreground = useColor('foreground');
  const textMuted = useColor('textMuted');

  return (
    <Card style={style}>
      <CardContent>
        {/* Topic Header */}
        <Text style={[styles.topic, { color: accentColor }]}>
          {topic}
        </Text>

        {/* Explanation */}
        <Text style={[styles.explanation, { color: foreground }]}>
          {explanation}
        </Text>

        {/* Examples */}
        {examples.length > 0 && (
          <View style={[styles.examplesBox, { backgroundColor: `${accentColor}10` }]}>
            {examples.map((example, index) => (
              <View
                key={index}
                style={[
                  styles.exampleRow,
                  index < examples.length - 1 && styles.exampleBorder,
                ]}
              >
                <View style={styles.exampleTextContainer}>
                  <Text style={[styles.exampleSpanish, { color: accentColor }]}>
                    {example.spanish}
                  </Text>
                  <Text style={[styles.exampleEnglish, { color: textMuted }]}>
                    {example.english}
                  </Text>
                </View>
                <SmallAudioButton text={example.spanish} color={accentColor} size={14} />
              </View>
            ))}
          </View>
        )}

        {/* Tips */}
        {tips && (
          <View style={styles.tipsBox}>
            <Text style={styles.tipsLabel}>Tip</Text>
            <Text style={[styles.tipsText, { color: foreground }]}>
              {tips}
            </Text>
          </View>
        )}
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  topic: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  explanation: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  examplesBox: {
    padding: 12,
    borderRadius: 8,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  exampleBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  exampleTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  exampleSpanish: {
    fontSize: 14,
  },
  exampleEnglish: {
    fontSize: 12,
    marginTop: 2,
  },
  tipsBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f59e0b15',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  tipsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f59e0b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  tipsText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
