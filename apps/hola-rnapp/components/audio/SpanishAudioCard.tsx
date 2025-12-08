import React, { useState, useCallback } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import { useSpanishTTS } from '@/hooks/useSpanishTTS';

interface SpanishAudioCardProps {
  spanishText: string;
  englishText?: string;
  subtitle?: string; // e.g., pronunciation guide
  additionalContent?: React.ReactNode;
  accentColor?: string;
  style?: ViewStyle;
  onAudioPress?: () => void; // optional override for custom audio handling
}

/**
 * Base audio card component for displaying Spanish content with TTS playback.
 * Reusable foundation for vocabulary, phrases, and grammar cards.
 */
export function SpanishAudioCard({
  spanishText,
  englishText,
  subtitle,
  additionalContent,
  accentColor,
  style,
  onAudioPress,
}: SpanishAudioCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const { speak, stop } = useSpanishTTS();

  const primary = useColor('primary');
  const textMuted = useColor('textMuted');
  const foreground = useColor('foreground');

  const color = accentColor || primary;

  const handleAudioPress = useCallback(async () => {
    if (onAudioPress) {
      onAudioPress();
      return;
    }

    if (isPlaying) {
      await stop();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    try {
      await speak(spanishText);
    } finally {
      setIsPlaying(false);
    }
  }, [isPlaying, onAudioPress, speak, stop, spanishText]);

  return (
    <Card style={style}>
      <CardContent>
        <View style={styles.mainRow}>
          <View style={styles.textContainer}>
            <Text style={[styles.spanishText, { color: foreground }]}>
              {spanishText}
            </Text>
            {subtitle && (
              <Text style={[styles.subtitle, { color: textMuted }]}>
                {subtitle}
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={handleAudioPress}
            style={[styles.audioButton, { backgroundColor: `${color}20` }]}
            activeOpacity={0.7}
          >
            {isPlaying ? (
              <Spinner size='sm' variant='circle' color={color} />
            ) : (
              <Icon name={Volume2} size={20} color={color} />
            )}
          </TouchableOpacity>
        </View>

        {englishText && (
          <Text style={[styles.englishText, { color: textMuted }]}>
            {englishText}
          </Text>
        )}

        {additionalContent && (
          <View style={styles.additionalContent}>
            {additionalContent}
          </View>
        )}
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  spanishText: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  englishText: {
    marginTop: 6,
    fontSize: 14,
  },
  audioButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  additionalContent: {
    marginTop: 12,
  },
});
