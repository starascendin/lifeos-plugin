import { useState, useCallback } from 'react';
import { useAction } from 'convex/react';
import { useQuery } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { useAILog } from '@/contexts/AILogContext';
import type { Id } from '@holaai/convex/_generated/dataModel';

export interface GenerateConversationParams {
  moduleId: Id<"hola_learningModules">;
  situation: string;
  sessionId?: Id<"hola_conversationSessions">;
}

export interface GenerateConversationResult {
  sessionId: Id<"hola_conversationSessions">;
  conversationId: Id<"hola_journeyConversations">;
}

export interface UseConversationGenerationReturn {
  generate: (params: GenerateConversationParams) => Promise<GenerateConversationResult>;
  isGenerating: boolean;
  error: string | null;
  clearError: () => void;
}

export function useConversationGeneration(): UseConversationGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUser = useQuery(api.common.users.currentUser);
  const generateConversation = useAction(api.holaai.ai.generateJourneyConversation);
  const { addLog } = useAILog();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const generate = useCallback(async (params: GenerateConversationParams): Promise<GenerateConversationResult> => {
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    setIsGenerating(true);
    setError(null);

    const inputPreview = params.situation.slice(0, 50) + (params.situation.length > 50 ? '...' : '');

    try {
      const result = await generateConversation({
        userId: currentUser._id,
        moduleId: params.moduleId,
        sessionId: params.sessionId,
        situation: params.situation,
      });

      // Log successful generation
      addLog({
        type: 'conversation',
        provider: 'gemini',
        success: true,
        inputPreview,
      });

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate conversation';
      setError(errorMessage);

      // Log failed generation
      addLog({
        type: 'conversation',
        provider: 'gemini',
        success: false,
        error: errorMessage,
        inputPreview,
      });

      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, [currentUser, generateConversation, addLog]);

  return {
    generate,
    isGenerating,
    error,
    clearError,
  };
}
