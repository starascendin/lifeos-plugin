import React, { useState, useCallback, useEffect } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Volume2, AlertCircle, Cloud, Smartphone } from 'lucide-react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import { useSpanishTTS } from '@/hooks/useSpanishTTS';
import { useTTSSettings } from '@/hooks/useTTSSettings';

interface SpanishAudioCardProps {
  spanishText: string;
  englishText?: string;
  subtitle?: string; // e.g., pronunciation guide
  additionalContent?: React.ReactNode;
  accentColor?: string;
  style?: ViewStyle;
  onAudioPress?: () => void; // optional override for custom audio handling
  /** Show a small badge indicating which TTS provider will be used */
  showProviderBadge?: boolean;
}

/**
 * Base audio card component for displaying Spanish content with TTS playback.
 * Reusable foundation for vocabulary, phrases, and grammar cards.
 * Shows fallback notice when Gemini TTS fails.
 */
export function SpanishAudioCard({
  spanishText,
  englishText,
  subtitle,
  additionalContent,
  accentColor,
  style,
  onAudioPress,
  showProviderBadge = false,
}: SpanishAudioCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFallbackNotice, setShowFallbackNotice] = useState(false);
  const { speak, stop, didFallback, clearFallback } = useSpanishTTS();
  const { isGeminiTTS } = useTTSSettings();

  // Show fallback notice briefly when Gemini fails
  useEffect(() => {
    if (didFallback) {
      setShowFallbackNotice(true);
      const timer = setTimeout(() => {
        setShowFallbackNotice(false);
        clearFallback();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [didFallback, clearFallback]);

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
    setShowFallbackNotice(false);
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

          <View style={styles.audioButtonContainer}>
            <TouchableOpacity
              onPress={handleAudioPress}
              style={[
                styles.audioButton,
                {
                  backgroundColor: showFallbackNotice ? '#fef3c720' : `${color}20`,
                  borderColor: showFallbackNotice ? '#f59e0b' : 'transparent',
                  borderWidth: showFallbackNotice ? 1 : 0,
                }
              ]}
              activeOpacity={0.7}
            >
              {isPlaying ? (
                <Spinner size='sm' variant='circle' color={color} />
              ) : showFallbackNotice ? (
                <Icon name={AlertCircle} size={20} color="#f59e0b" />
              ) : (
                <Icon name={Volume2} size={20} color={color} />
              )}
            </TouchableOpacity>

            {/* Provider badge */}
            {showProviderBadge && !isPlaying && (
              <View style={[styles.providerBadge, { backgroundColor: isGeminiTTS ? '#8b5cf6' : '#6b7280' }]}>
                <Icon
                  name={isGeminiTTS ? Cloud : Smartphone}
                  size={10}
                  color="#fff"
                />
              </View>
            )}
          </View>
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

        {/* Fallback notice */}
        {showFallbackNotice && (
          <View style={styles.fallbackNotice}>
            <Icon name={AlertCircle} size={12} color="#f59e0b" />
            <Text style={styles.fallbackText}>
              Gemini unavailable, used device TTS
            </Text>
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
  audioButtonContainer: {
    position: 'relative',
  },
  audioButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  additionalContent: {
    marginTop: 12,
  },
  fallbackNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
  },
  fallbackText: {
    marginLeft: 6,
    fontSize: 11,
    color: '#92400e',
  },
});
