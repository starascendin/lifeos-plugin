import { useState, useCallback } from 'react';
import { useAction } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { useAILog } from '@/contexts/AILogContext';
import { useNetworkStatus } from './useNetworkStatus';
import { useTTSSettings } from '@/contexts/TTSSettingsContext';
import { onTranslateTask } from 'expo-translate-text';

export interface TranslateParams {
  text: string;
  sourceLanguage: 'es' | 'en' | 'auto';
  targetLanguage: 'es' | 'en';
}

export interface TranslationResult {
  translation: string;
  detectedLanguage?: string;
  isOffline?: boolean;
}

export interface UseTranslationReturn {
  translate: (params: TranslateParams) => Promise<TranslationResult>;
  isTranslating: boolean;
  error: string | null;
  clearError: () => void;
  lastTranslation: TranslationResult | null;
  isUsingGemini: boolean;
}

/**
 * Custom hook for translating text between Spanish and English
 *
 * Features:
 * - Respects TTS provider setting (on-device vs Gemini)
 * - On-device mode uses expo-translate-text (Apple Translation API on iOS 18+, ML Kit on Android)
 * - Gemini mode uses cloud AI for translations
 * - Logs all translation attempts via AILogContext
 */
export function useTranslation(): UseTranslationReturn {
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTranslation, setLastTranslation] = useState<TranslationResult | null>(null);

  const translateAction = useAction(api.holaai.translate.translateText);
  const { addLog } = useAILog();
  const { isOnline } = useNetworkStatus();
  const { isGeminiTTS } = useTTSSettings();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const translate = useCallback(async (params: TranslateParams): Promise<TranslationResult> => {
    const { text, sourceLanguage, targetLanguage } = params;

    // Don't translate empty text
    if (!text.trim()) {
      return { translation: '' };
    }

    setIsTranslating(true);
    setError(null);

    const inputPreview = text.slice(0, 30) + (text.length > 30 ? '...' : '');

    // Use on-device translation if user selected on-device mode
    if (!isGeminiTTS) {
      try {
        // Use expo-translate-text for on-device translation
        const result = await onTranslateTask({
          input: text,
          sourceLangCode: sourceLanguage === 'auto' ? undefined : sourceLanguage,
          targetLangCode: targetLanguage,
        });

        const translatedText = Array.isArray(result.translatedTexts)
          ? result.translatedTexts[0]
          : result.translatedTexts;

        const translationResult: TranslationResult = {
          translation: translatedText || '',
          detectedLanguage: result.sourceLanguage,
          isOffline: true,
        };

        setLastTranslation(translationResult);

        addLog({
          type: 'translation',
          provider: 'ondevice',
          success: true,
          inputPreview,
        });

        setIsTranslating(false);
        return translationResult;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'On-device translation failed';
        setError(errorMessage);

        addLog({
          type: 'translation',
          provider: 'ondevice',
          success: false,
          error: errorMessage,
          inputPreview,
        });

        setIsTranslating(false);
        return { translation: '', isOffline: true };
      }
    }

    // Online + Gemini mode: use cloud AI translation
    if (!isOnline) {
      setError('No internet connection');
      addLog({
        type: 'translation',
        provider: 'gemini',
        success: false,
        error: 'No internet connection',
        inputPreview,
      });
      setIsTranslating(false);
      return { translation: '' };
    }

    try {
      const result = await translateAction({
        text,
        sourceLanguage,
        targetLanguage,
      });

      if (result.error) {
        setError(result.error);
        addLog({
          type: 'translation',
          provider: 'gemini',
          success: false,
          error: result.error,
          inputPreview,
        });
        setIsTranslating(false);
        return { translation: '', detectedLanguage: result.detectedLanguage };
      }

      const translationResult: TranslationResult = {
        translation: result.translation,
        detectedLanguage: result.detectedLanguage,
        isOffline: false,
      };

      setLastTranslation(translationResult);

      addLog({
        type: 'translation',
        provider: 'gemini',
        success: true,
        inputPreview,
      });

      return translationResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Translation failed';
      setError(errorMessage);

      addLog({
        type: 'translation',
        provider: 'gemini',
        success: false,
        error: errorMessage,
        inputPreview,
      });

      throw err;
    } finally {
      setIsTranslating(false);
    }
  }, [translateAction, addLog, isOnline, isGeminiTTS]);

  return {
    translate,
    isTranslating,
    error,
    clearError,
    lastTranslation,
    isUsingGemini: isGeminiTTS,
  };
}
