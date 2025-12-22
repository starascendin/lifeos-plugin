import { useCallback } from 'react';
import { useCouncilStore, type Stage1Result, type Stage2Result, type Stage3Result } from '../store/councilStore';
import { useAppStore } from '../store/appStore';
import { useCouncilHistoryStore } from '../store/councilHistoryStore';
import { sendChatGPTMessage } from '../services/chatgpt';
import { sendClaudeMessage } from '../services/claude';
import { sendGeminiMessage } from '../services/gemini';
import { buildRankingPrompt, buildSynthesisPrompt, parseRanking, parseEvaluations, calculateAggregateRankings } from '../services/council';
import { MODEL_TIERS, LLM_CONFIG, type LLMType } from '../config/llm';
import type { StreamCallbacks } from '../services/types';

/**
 * Query a single LLM and collect the full response.
 * Uses fresh context (no conversation history).
 */
async function queryLLM(
  llmType: LLMType,
  model: string,
  prompt: string
): Promise<{ model: string; llmType: LLMType; response: string }> {
  return new Promise((resolve, reject) => {
    let fullResponse = '';

    const callbacks: StreamCallbacks = {
      onToken: (content) => {
        fullResponse = content;
      },
      onComplete: () => {
        resolve({
          model: LLM_CONFIG[llmType].name,
          llmType,
          response: fullResponse
        });
      },
      onError: (error) => {
        reject(error);
      },
      onStatus: () => {}
    };

    if (llmType === 'chatgpt') {
      sendChatGPTMessage(
        prompt,
        model,
        { conversationId: null, parentMessageId: crypto.randomUUID() },
        callbacks
      ).catch(reject);
    } else if (llmType === 'claude') {
      sendClaudeMessage(
        prompt,
        model,
        { conversationId: null, claudeOrgUuid: null },
        callbacks
      ).catch(reject);
    } else if (llmType === 'gemini') {
      sendGeminiMessage(
        prompt,
        { geminiContextIds: ['', '', ''] },
        callbacks
      ).catch(reject);
    }
  });
}

export function useCouncil() {
  const currentTier = useAppStore((state) => state.currentTier);
  const chairman = useCouncilStore((state) => state.chairman);
  const addUserMessage = useCouncilStore((state) => state.addUserMessage);
  const addAssistantMessage = useCouncilStore((state) => state.addAssistantMessage);
  const updateMessage = useCouncilStore((state) => state.updateMessage);
  const setIsLoading = useCouncilStore((state) => state.setIsLoading);
  const currentConversationId = useCouncilHistoryStore((state) => state.currentConversationId);
  const createNewConversation = useCouncilHistoryStore((state) => state.createNewConversation);

  const runCouncil = useCallback(async (query: string) => {
    if (!query.trim()) return;

    // Ensure we have a conversation ID before starting
    if (!currentConversationId) {
      createNewConversation();
    }

    setIsLoading(true);
    addUserMessage(query);
    const assistantId = addAssistantMessage();

    const models = MODEL_TIERS[currentTier];
    const llmTypes: LLMType[] = ['chatgpt', 'claude', 'gemini'];

    try {
      // Stage 1: Query all LLMs in parallel
      updateMessage(assistantId, { loading: { stage1: true, stage2: false, stage3: false } });

      const stage1Promises = llmTypes.map((llmType) =>
        queryLLM(llmType, models[llmType], query).catch((err) => {
          console.error(`Stage 1 ${llmType} error:`, err);
          return null;
        })
      );

      const stage1Results = (await Promise.all(stage1Promises)).filter(
        (r): r is Stage1Result => r !== null
      );

      if (stage1Results.length === 0) {
        throw new Error('All models failed to respond in Stage 1');
      }

      updateMessage(assistantId, {
        stage1: stage1Results,
        loading: { stage1: false, stage2: true, stage3: false }
      });

      // Stage 2: Each LLM ranks the anonymized responses
      const { prompt: rankingPrompt, labelToModel } = buildRankingPrompt(query, stage1Results);

      const stage2Promises = llmTypes.map((llmType) =>
        queryLLM(llmType, models[llmType], rankingPrompt)
          .then((result): Stage2Result => ({
            model: result.model,
            llmType: result.llmType,
            ranking: result.response,
            parsedRanking: parseRanking(result.response),
            evaluations: parseEvaluations(result.response)
          }))
          .catch((err) => {
            console.error(`Stage 2 ${llmType} error:`, err);
            return null;
          })
      );

      const stage2RawResults = await Promise.all(stage2Promises);
      const stage2Results: Stage2Result[] = stage2RawResults.filter(
        (r): r is Stage2Result => r !== null
      );

      const aggregateRankings = calculateAggregateRankings(stage2Results, labelToModel);

      updateMessage(assistantId, {
        stage2: stage2Results,
        metadata: { labelToModel, aggregateRankings },
        loading: { stage1: false, stage2: false, stage3: true }
      });

      // Stage 3: Chairman synthesizes the final answer
      const synthesisPrompt = buildSynthesisPrompt(query, stage1Results, stage2Results);
      const chairmanModel = models[chairman];

      const stage3Result = await queryLLM(chairman, chairmanModel, synthesisPrompt);

      const finalStage3: Stage3Result = {
        model: stage3Result.model,
        llmType: stage3Result.llmType,
        response: stage3Result.response
      };

      updateMessage(assistantId, {
        stage3: finalStage3,
        loading: { stage1: false, stage2: false, stage3: false }
      });

    } catch (error) {
      console.error('Council error:', error);
      updateMessage(assistantId, {
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: { stage1: false, stage2: false, stage3: false }
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentTier, chairman, addUserMessage, addAssistantMessage, updateMessage, setIsLoading, currentConversationId, createNewConversation]);

  return { runCouncil };
}
