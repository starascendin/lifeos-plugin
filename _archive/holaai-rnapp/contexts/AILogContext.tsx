import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

export type AILogType = 'tts' | 'conversation' | 'suggestion' | 'lesson' | 'translation';
export type AILogProvider = 'ondevice' | 'gemini';

export interface AILogEntry {
  id: string;
  timestamp: number;
  type: AILogType;
  provider: AILogProvider;
  success: boolean;
  error?: string;
  inputPreview?: string;
}

interface AILogContextValue {
  logs: AILogEntry[];
  isLoading: boolean;
  addLog: (entry: Omit<AILogEntry, 'id' | 'timestamp'>) => Promise<void>;
  clearLogs: () => Promise<void>;
}

const STORAGE_KEY = 'ai_usage_logs';
const MAX_LOGS = 100;

const AILogContext = createContext<AILogContextValue | null>(null);

export function AILogProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<AILogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load logs on mount
  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AILogEntry[];
        setLogs(parsed);
      }
    } catch (error) {
      console.error('Error loading AI logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveLogs = async (newLogs: AILogEntry[]) => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newLogs));
    } catch (error) {
      console.error('Error saving AI logs:', error);
    }
  };

  const addLog = useCallback(async (entry: Omit<AILogEntry, 'id' | 'timestamp'>) => {
    const newEntry: AILogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    setLogs((prev) => {
      // Add new entry at the beginning, limit to MAX_LOGS
      const updated = [newEntry, ...prev].slice(0, MAX_LOGS);
      saveLogs(updated);
      return updated;
    });
  }, []);

  const clearLogs = useCallback(async () => {
    setLogs([]);
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing AI logs:', error);
    }
  }, []);

  return (
    <AILogContext.Provider
      value={{
        logs,
        isLoading,
        addLog,
        clearLogs,
      }}
    >
      {children}
    </AILogContext.Provider>
  );
}

export function useAILog() {
  const context = useContext(AILogContext);
  if (!context) {
    throw new Error('useAILog must be used within AILogProvider');
  }
  return context;
}
