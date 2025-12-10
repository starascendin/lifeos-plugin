import React from 'react';
import { TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Cloud, Smartphone } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/ui/icon';
import { useTTSSettings, TTSProvider } from '@/contexts/TTSSettingsContext';

interface TTSProviderToggleProps {
  size?: number;
}

/**
 * Quick toggle button for switching between on-device and Gemini TTS providers.
 * Shows phone icon for on-device, cloud icon for Gemini.
 */
export function TTSProviderToggle({ size = 22 }: TTSProviderToggleProps) {
  const { settings, setProvider, isGeminiTTS } = useTTSSettings();

  const handleToggle = async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const newProvider: TTSProvider = isGeminiTTS ? 'ondevice' : 'gemini';
    await setProvider(newProvider);
  };

  const iconColor = isGeminiTTS ? '#8b5cf6' : '#6b7280';
  const IconComponent = isGeminiTTS ? Cloud : Smartphone;

  return (
    <TouchableOpacity
      onPress={handleToggle}
      style={[styles.button, { backgroundColor: `${iconColor}15` }]}
      activeOpacity={0.7}
    >
      <Icon name={IconComponent} size={size} color={iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
    borderRadius: 8,
    marginRight: 4,
  },
});
