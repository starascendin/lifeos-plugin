import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

export interface JourneySettings {
  freeMode: boolean; // When true, all modules are unlocked
}

interface JourneySettingsContextValue {
  settings: JourneySettings;
  isLoading: boolean;
  setFreeMode: (enabled: boolean) => Promise<void>;
}

const STORAGE_KEY = 'journey_settings';
const DEFAULT_SETTINGS: JourneySettings = {
  freeMode: false,
};

const JourneySettingsContext = createContext<JourneySettingsContextValue | null>(null);

export function JourneySettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<JourneySettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as JourneySettings;
        setSettings(parsed);
      }
    } catch (error) {
      console.error('Error loading Journey settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: JourneySettings) => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving Journey settings:', error);
    }
  };

  const setFreeMode = useCallback(async (enabled: boolean) => {
    const newSettings = { ...settings, freeMode: enabled };
    await saveSettings(newSettings);
    setSettings(newSettings);
  }, [settings]);

  return (
    <JourneySettingsContext.Provider
      value={{
        settings,
        isLoading,
        setFreeMode,
      }}
    >
      {children}
    </JourneySettingsContext.Provider>
  );
}

export function useJourneySettings() {
  const context = useContext(JourneySettingsContext);
  if (!context) {
    throw new Error('useJourneySettings must be used within JourneySettingsProvider');
  }
  return context;
}
