/**
 * Pure function version of the council logic for headless/remote execution.
 * No React hooks or Zustand store dependencies.
 */

import { sendChatGPTMessage } from './chatgpt';
import { sendClaudeMessage } from './claude';
import { sendGeminiMessage } from './gemini';
import {
  buildRankingPrompt,
  buildSynthesisPrompt,
  parseRanking,
  parseEvaluations,
  calculateAggregateRankings
} from './council';
import { MODEL_TIERS, LLM_CONFIG, type LLMType, type Tier } from '../config/llm';
import type { StreamCallbacks } from './types';
import type {
  Stage1Result,
  Stage2Result,
  Stage3Result,
  AggregateRanking
} from '../store/councilStore';

export interface CouncilConfig {
  tier: Tier;
}

export interface CouncilResult {
  stage1: Stage1Result[];
  stage2: Stage2Result[];
  stage3: Stage3Result[];
  metadata: {
    labelToModel: Record<string, { model: string; llmType: LLMType }>;
    aggregateRankings: AggregateRanking[];
  };
}

export type ProgressCallback = (
  stage: 'stage1' | 'stage2' | 'stage3',
  status: string
) => void;

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

/**
 * Run the full council process without React/Zustand dependencies.
 * Returns complete results for all 3 stages.
 */
export async function runCouncilHeadless(
  query: string,
  config: CouncilConfig,
  onProgress?: ProgressCallback
): Promise<CouncilResult> {
  if (!query.trim()) {
    throw new Error('Query cannot be empty');
  }

  const { tier } = config;
  const models = MODEL_TIERS[tier];
  const llmTypes: LLMType[] = ['chatgpt', 'claude', 'gemini'];

  // Stage 1: Query all LLMs in parallel
  onProgress?.('stage1', 'Querying all models...');

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

  onProgress?.('stage1', `Got ${stage1Results.length} responses`);

  // Stage 2: Each LLM ranks the anonymized responses
  onProgress?.('stage2', 'Peer ranking in progress...');

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

  onProgress?.('stage2', `Got ${stage2Results.length} rankings`);

  // Stage 3: All LLMs synthesize as chairmen in parallel
  onProgress?.('stage3', 'All models synthesizing final answers...');

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

  onProgress?.('stage3', 'Complete');

  return {
    stage1: stage1Results,
    stage2: stage2Results,
    stage3: stage3Results,
    metadata: {
      labelToModel,
      aggregateRankings
    }
  };
}
