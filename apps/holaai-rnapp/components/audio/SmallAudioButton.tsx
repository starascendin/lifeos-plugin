import React, { useState, useCallback } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { useSpanishTTS } from '@/hooks/useSpanishTTS';

interface SmallAudioButtonProps {
  text: string;
  color?: string;
  size?: number;
}

/**
 * Compact audio button for inline use in example sentences, grammar examples, etc.
 * Manages its own playback state.
 */
export function SmallAudioButton({ text, color = '#3b82f6', size = 18 }: SmallAudioButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const { speak, stop } = useSpanishTTS();

  const handlePress = useCallback(async () => {
    if (isPlaying) {
      await stop();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    try {
      await speak(text);
    } finally {
      setIsPlaying(false);
    }
  }, [isPlaying, speak, stop, text]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.button,
        {
          backgroundColor: `${color}20`,
          width: size + 14,
          height: size + 14,
        },
      ]}
      activeOpacity={0.7}
    >
      {isPlaying ? (
        <Spinner size='sm' variant='circle' color={color} />
      ) : (
        <Icon name={Volume2} size={size} color={color} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
