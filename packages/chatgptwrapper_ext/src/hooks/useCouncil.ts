import { useCallback, useEffect, useRef } from 'react';
import { useCouncilStore, type Stage1Result, type Stage2Result, type Stage3Result } from '../store/councilStore';
import { useAppStore } from '../store/appStore';
import { useCouncilHistoryStore } from '../store/councilHistoryStore';
import { sendChatGPTMessage } from '../services/chatgpt';
import { sendClaudeMessage } from '../services/claude';
import { sendGeminiMessage } from '../services/gemini';
import { buildRankingPrompt, buildSynthesisPrompt, parseRanking, parseEvaluations, calculateAggregateRankings } from '../services/council';
import { MODEL_TIERS, LLM_CONFIG, type LLMType } from '../config/llm';
import type { StreamCallbacks } from '../services/types';
import { generateUUID } from '../utils/uuid';

// Keys for localStorage persistence
const PENDING_REQUEST_KEY = 'council_pending_request';
const PENDING_ASSISTANT_ID_KEY = 'council_pending_assistant_id';
const PENDING_QUERY_KEY = 'council_pending_query';

/**
 * Check if we're running in server mode (no chrome APIs available).
 * Server mode uses HTTP POST to /prompt instead of direct LLM calls.
 */
function isServerMode(): boolean {
  return typeof chrome === 'undefined' || !chrome.storage?.local;
}

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
        { conversationId: null, parentMessageId: generateUUID() },
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
  const messages = useCouncilStore((state) => state.messages);
  const addUserMessage = useCouncilStore((state) => state.addUserMessage);
  const addAssistantMessage = useCouncilStore((state) => state.addAssistantMessage);
  const updateMessage = useCouncilStore((state) => state.updateMessage);
  const setIsLoading = useCouncilStore((state) => state.setIsLoading);
  const currentConversationId = useCouncilHistoryStore((state) => state.currentConversationId);
  const createNewConversation = useCouncilHistoryStore((state) => state.createNewConversation);

  // Track if we've already restored a pending request
  const restoredRef = useRef(false);

  /**
   * Poll for a pending request's status and update UI when complete.
   */
  const pollForResult = useCallback(async (requestId: string, assistantId: string): Promise<boolean> => {
    const baseUrl = window.location.origin;

    try {
      const response = await fetch(`${baseUrl}/requests/${requestId}`);
      const data = await response.json();

      if (!data.success || !data.request) {
        return false;
      }

      const request = data.request;

      if (request.status === 'completed') {
        // Update UI with the completed result
        updateMessage(assistantId, {
          stage1: request.stage1 as Stage1Result[],
          stage2: request.stage2 as Stage2Result[],
          stage3: request.stage3 as Stage3Result[],
          metadata: request.metadata,
          loading: { stage1: false, stage2: false, stage3: false }
        });

        // Clear pending request from localStorage
        localStorage.removeItem(PENDING_REQUEST_KEY);
        localStorage.removeItem(PENDING_ASSISTANT_ID_KEY);
        localStorage.removeItem(PENDING_QUERY_KEY);

        return true; // Done
      } else if (request.status === 'error') {
        updateMessage(assistantId, {
          error: request.error || 'Request failed',
          loading: { stage1: false, stage2: false, stage3: false }
        });

        // Clear pending request
        localStorage.removeItem(PENDING_REQUEST_KEY);
        localStorage.removeItem(PENDING_ASSISTANT_ID_KEY);
        localStorage.removeItem(PENDING_QUERY_KEY);

        return true; // Done (with error)
      }

      // Still processing
      return false;
    } catch (error) {
      console.error('Poll error:', error);
      return false;
    }
  }, [updateMessage]);

  /**
   * Run council via HTTP POST to server (for server/mobile mode).
   * The server proxies to the Chrome extension via WebSocket.
   * Persists request ID so we can recover if disconnected.
   */
  const runCouncilViaServer = useCallback(async (
    query: string,
    assistantId: string
  ) => {
    updateMessage(assistantId, {
      loading: { stage1: true, stage2: false, stage3: false }
    });

    const baseUrl = window.location.origin;

    // Start the request - we'll get the requestId back immediately
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout

    try {
      const response = await fetch(`${baseUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          tier: currentTier,
          timeout: 180000
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const result = await response.json();

      // Save the request ID to localStorage in case we get disconnected
      if (result.requestId) {
        localStorage.setItem(PENDING_REQUEST_KEY, result.requestId);
        localStorage.setItem(PENDING_ASSISTANT_ID_KEY, assistantId);
        localStorage.setItem(PENDING_QUERY_KEY, query);
      }

      if (result.success) {
        // Clear pending request
        localStorage.removeItem(PENDING_REQUEST_KEY);
        localStorage.removeItem(PENDING_ASSISTANT_ID_KEY);
        localStorage.removeItem(PENDING_QUERY_KEY);

        // Update stages progressively for better UX
        updateMessage(assistantId, {
          stage1: result.stage1,
          loading: { stage1: false, stage2: false, stage3: false }
        });

        await new Promise(r => setTimeout(r, 100));

        updateMessage(assistantId, {
          stage2: result.stage2,
          metadata: result.metadata
        });

        await new Promise(r => setTimeout(r, 100));

        updateMessage(assistantId, {
          stage3: result.stage3
        });
      } else {
        throw new Error(result.error || 'Council request failed');
      }
    } catch (error) {
      clearTimeout(timeoutId);

      // If aborted or network error, check if there's a pending request to poll
      const pendingRequestId = localStorage.getItem(PENDING_REQUEST_KEY);
      if (pendingRequestId) {
        console.log('Request interrupted, will poll for result...');
        // Don't throw - the polling mechanism will pick this up
        updateMessage(assistantId, {
          loading: { stage1: true, stage2: false, stage3: false }
        });
        return;
      }

      throw error;
    }
  }, [currentTier, updateMessage]);

  /**
   * Run council directly using LLM APIs (for extension mode).
   */
  const runCouncilDirect = useCallback(async (
    query: string,
    assistantId: string
  ) => {
    const models = MODEL_TIERS[currentTier];
    const llmTypes: LLMType[] = ['chatgpt', 'claude', 'gemini'];

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

    // Stage 3: All LLMs synthesize as chairmen in parallel
    const synthesisPrompt = buildSynthesisPrompt(query, stage1Results, stage2Results);

    const stage3Promises = llmTypes.map((llmType) =>
      queryLLM(llmType, models[llmType], synthesisPrompt)
        .then((result): Stage3Result => ({
          model: result.model,
          llmType: result.llmType,
          response: result.response
        }))
        .catch((err) => {
          console.error(`Stage 3 ${llmType} error:`, err);
          return null;
        })
    );

    const stage3RawResults = await Promise.all(stage3Promises);
    const stage3Results: Stage3Result[] = stage3RawResults.filter(
      (r): r is Stage3Result => r !== null
    );

    updateMessage(assistantId, {
      stage3: stage3Results,
      loading: { stage1: false, stage2: false, stage3: false }
    });
  }, [currentTier, updateMessage]);

  const runCouncil = useCallback(async (query: string) => {
    if (!query.trim()) return;

    // Ensure we have a conversation ID before starting
    if (!currentConversationId) {
      createNewConversation();
    }

    setIsLoading(true);
    addUserMessage(query);
    const assistantId = addAssistantMessage();

    try {
      if (isServerMode()) {
        // Server mode: use HTTP POST to /prompt
        await runCouncilViaServer(query, assistantId);
      } else {
        // Extension mode: use direct LLM API calls
        await runCouncilDirect(query, assistantId);
      }
    } catch (error) {
      console.error('Council error:', error);
      updateMessage(assistantId, {
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: { stage1: false, stage2: false, stage3: false }
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentConversationId, createNewConversation, setIsLoading, addUserMessage, addAssistantMessage, updateMessage, runCouncilViaServer, runCouncilDirect]);

  /**
   * On mount (in server mode), check for any pending requests and poll for results.
   * This handles the case where the phone disconnected mid-request.
   */
  useEffect(() => {
    if (!isServerMode() || restoredRef.current) return;

    const pendingRequestId = localStorage.getItem(PENDING_REQUEST_KEY);
    const pendingAssistantId = localStorage.getItem(PENDING_ASSISTANT_ID_KEY);
    const pendingQuery = localStorage.getItem(PENDING_QUERY_KEY);

    if (!pendingRequestId) return;

    console.log('Found pending request:', pendingRequestId);
    restoredRef.current = true;

    // If we don't have the assistant message in the store, recreate the conversation
    let assistantId = pendingAssistantId;
    const hasAssistantMessage = assistantId && messages.some(m => m.id === assistantId);

    if (!hasAssistantMessage && pendingQuery) {
      // Recreate the conversation
      if (!currentConversationId) {
        createNewConversation();
      }
      addUserMessage(pendingQuery);
      assistantId = addAssistantMessage();
      localStorage.setItem(PENDING_ASSISTANT_ID_KEY, assistantId);
    }

    if (!assistantId) {
      // Can't restore without assistant ID
      localStorage.removeItem(PENDING_REQUEST_KEY);
      localStorage.removeItem(PENDING_ASSISTANT_ID_KEY);
      localStorage.removeItem(PENDING_QUERY_KEY);
      return;
    }

    // Set loading state
    setIsLoading(true);
    updateMessage(assistantId, {
      loading: { stage1: true, stage2: false, stage3: false }
    });

    // Start polling
    const poll = async () => {
      const done = await pollForResult(pendingRequestId, assistantId!);
      if (done) {
        setIsLoading(false);
        return true;
      }
      return false;
    };

    // Poll immediately
    poll().then(done => {
      if (done) return;

      // If not done, set up interval
      const intervalId = setInterval(async () => {
        const done = await poll();
        if (done) {
          clearInterval(intervalId);
        }
      }, 2000); // Poll every 2 seconds

      // Cleanup on unmount
      return () => clearInterval(intervalId);
    });
  }, [messages, currentConversationId, createNewConversation, addUserMessage, addAssistantMessage, updateMessage, setIsLoading, pollForResult]);

  return { runCouncil };
}
