import React, { useState, useCallback, useEffect } from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Volume2, AlertCircle, Cloud, Smartphone } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { useSpanishTTS } from '@/hooks/useSpanishTTS';
import { useTTSSettings } from '@/contexts/TTSSettingsContext';

interface SmallAudioButtonProps {
  text: string;
  color?: string;
  size?: number;
  /** Show a small badge indicating which TTS provider will be used */
  showProviderBadge?: boolean;
}

/**
 * Compact audio button for inline use in example sentences, grammar examples, etc.
 * Manages its own playback state and shows fallback notices.
 */
export function SmallAudioButton({
  text,
  color = '#3b82f6',
  size = 18,
  showProviderBadge = false
}: SmallAudioButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFallbackNotice, setShowFallbackNotice] = useState(false);
  const { speak, stop, didFallback, clearFallback, error } = useSpanishTTS();
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

  const handlePress = useCallback(async () => {
    if (isPlaying) {
      await stop();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    setShowFallbackNotice(false);
    try {
      await speak(text);
    } finally {
      setIsPlaying(false);
    }
  }, [isPlaying, speak, stop, text]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePress}
        style={[
          styles.button,
          {
            backgroundColor: showFallbackNotice ? '#fef3c720' : `${color}20`,
            borderColor: showFallbackNotice ? '#f59e0b' : 'transparent',
            borderWidth: showFallbackNotice ? 1 : 0,
            width: size + 14,
            height: size + 14,
          },
        ]}
        activeOpacity={0.7}
      >
        {isPlaying ? (
          <Spinner size='sm' variant='circle' color={color} />
        ) : showFallbackNotice ? (
          <Icon name={AlertCircle} size={size} color="#f59e0b" />
        ) : (
          <Icon name={Volume2} size={size} color={color} />
        )}
      </TouchableOpacity>

      {/* Provider badge */}
      {showProviderBadge && !isPlaying && (
        <View style={[styles.providerBadge, { backgroundColor: isGeminiTTS ? '#8b5cf6' : '#6b7280' }]}>
          <Icon
            name={isGeminiTTS ? Cloud : Smartphone}
            size={8}
            color="#fff"
          />
        </View>
      )}

      {/* Fallback notice tooltip */}
      {showFallbackNotice && (
        <View style={styles.fallbackTooltip}>
          <Text style={styles.fallbackText}>
            Gemini unavailable, used device
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  button: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackTooltip: {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: [{ translateX: -60 }],
    marginTop: 4,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    width: 120,
  },
  fallbackText: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
  },
});
