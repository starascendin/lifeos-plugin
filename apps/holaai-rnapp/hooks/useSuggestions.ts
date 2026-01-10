import { useState, useCallback } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { useAILog } from '@/contexts/AILogContext';
import type { Id } from '@holaai/convex/_generated/dataModel';

export interface Suggestion {
  title: string;
  description: string;
  scenario: string;
}

export type SuggestionContext = 'before_generation' | 'after_conversation';

export interface FetchSuggestionsParams {
  moduleId: Id<"hola_learningModules">;
  context: SuggestionContext;
}

export interface UseSuggestionsReturn {
  suggestions: Suggestion[];
  isLoading: boolean;
  error: string | null;
  fetchSuggestions: (params: FetchSuggestionsParams) => Promise<Suggestion[]>;
  clearSuggestions: () => void;
  clearError: () => void;
}

export function useSuggestions(): UseSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUser = useQuery(api.common.users.currentUser);
  const generateSuggestions = useAction(api.holaai.ai.generateSuggestions);
  const { addLog } = useAILog();

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchSuggestions = useCallback(async (params: FetchSuggestionsParams): Promise<Suggestion[]> => {
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await generateSuggestions({
        userId: currentUser._id,
        moduleId: params.moduleId,
        context: params.context,
      });

      setSuggestions(result.suggestions);

      // Log successful suggestions fetch
      addLog({
        type: 'suggestion',
        provider: 'gemini',
        success: true,
        inputPreview: `${params.context} (${result.suggestions.length} suggestions)`,
      });

      return result.suggestions;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch suggestions';
      setError(errorMessage);

      // Log failed suggestions fetch
      addLog({
        type: 'suggestion',
        provider: 'gemini',
        success: false,
        error: errorMessage,
        inputPreview: params.context,
      });

      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, generateSuggestions, addLog]);

  return {
    suggestions,
    isLoading,
    error,
    fetchSuggestions,
    clearSuggestions,
    clearError,
  };
}
