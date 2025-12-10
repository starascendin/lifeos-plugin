import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

export type TTSProvider = 'ondevice' | 'gemini';

export interface TTSSettings {
  provider: TTSProvider;
  speed: number; // 0.5 to 1.0
}

interface TTSSettingsContextValue {
  settings: TTSSettings;
  isLoading: boolean;
  setProvider: (provider: TTSProvider) => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
  isGeminiTTS: boolean;
}

const STORAGE_KEY = 'tts_settings';
const DEFAULT_SETTINGS: TTSSettings = {
  provider: 'ondevice',
  speed: 0.8,
};

const TTSSettingsContext = createContext<TTSSettingsContextValue | null>(null);

export function TTSSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<TTSSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TTSSettings;
        setSettings(parsed);
      }
    } catch (error) {
      console.error('Error loading TTS settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: TTSSettings) => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving TTS settings:', error);
    }
  };

  const setProvider = useCallback(async (provider: TTSProvider) => {
    const newSettings = { ...settings, provider };
    await saveSettings(newSettings);
    setSettings(newSettings); // Updates ALL consumers via Context
  }, [settings]);

  const setSpeed = useCallback(async (speed: number) => {
    // Clamp speed between 0.5 and 1.0
    const clampedSpeed = Math.min(1.0, Math.max(0.5, speed));
    const newSettings = { ...settings, speed: clampedSpeed };
    await saveSettings(newSettings);
    setSettings(newSettings); // Updates ALL consumers via Context
  }, [settings]);

  const isGeminiTTS = settings.provider === 'gemini';

  return (
    <TTSSettingsContext.Provider
      value={{
        settings,
        isLoading,
        setProvider,
        setSpeed,
        isGeminiTTS,
      }}
    >
      {children}
    </TTSSettingsContext.Provider>
  );
}

export function useTTSSettings() {
  const context = useContext(TTSSettingsContext);
  if (!context) {
    throw new Error('useTTSSettings must be used within TTSSettingsProvider');
  }
  return context;
}
