/**
 * Token Extractors
 *
 * Unified token extraction utilities for different AI providers.
 * Each provider returns usage data in a different format - these functions
 * normalize them into our standard TokenUsage interface.
 */

import type { TokenUsage } from "./types";

/**
 * Extract token usage from Vercel AI Gateway / OpenAI format
 *
 * Format: { prompt_tokens, completion_tokens, total_tokens }
 */
export function extractGatewayUsage(usage: unknown): TokenUsage {
  const u = usage as Record<string, number> | undefined;
  return {
    promptTokens: u?.prompt_tokens ?? 0,
    completionTokens: u?.completion_tokens ?? 0,
    totalTokens: u?.total_tokens ?? 0,
  };
}

/**
 * Extract token usage from Google Gemini usageMetadata format
 *
 * Format: { promptTokenCount, candidatesTokenCount, totalTokenCount? }
 */
export function extractGeminiUsage(usageMetadata: unknown): TokenUsage {
  const u = usageMetadata as Record<string, number> | undefined;
  const prompt = u?.promptTokenCount ?? 0;
  const completion = u?.candidatesTokenCount ?? 0;
  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: u?.totalTokenCount ?? prompt + completion,
  };
}

/**
 * Extract token usage from Vercel AI SDK format (v3+)
 *
 * The AI SDK changed field names between versions:
 * - v2: { promptTokens, completionTokens, totalTokens }
 * - v3: { inputTokens, outputTokens, totalTokens }
 *
 * This function handles both formats.
 */
export function extractAISDKUsage(usage: unknown): TokenUsage {
  const u = usage as Record<string, number> | undefined;

  // Handle both v2 and v3 field names
  const promptTokens = u?.promptTokens ?? u?.inputTokens ?? 0;
  const completionTokens = u?.completionTokens ?? u?.outputTokens ?? 0;
  const totalTokens = u?.totalTokens ?? promptTokens + completionTokens;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

/**
 * Create a flat-rate token usage (for features that can't track real usage)
 *
 * Used for:
 * - Voice/audio features (LiveKit doesn't provide token counts)
 * - Streaming responses where we estimate based on content length
 */
export function createFlatRateUsage(estimatedTokens: number): TokenUsage {
  return {
    promptTokens: Math.floor(estimatedTokens * 0.3),
    completionTokens: Math.floor(estimatedTokens * 0.7),
    totalTokens: estimatedTokens,
  };
}

/**
 * Estimate token count from text content
 *
 * Rough approximation: ~4 characters per token for English text
 * This is used for streaming responses where we don't get usage data
 */
export function estimateTokensFromText(text: string): number {
  // Average of ~4 characters per token for English
  // This is a rough estimate - actual varies by model and language
  return Math.ceil(text.length / 4);
}

/**
 * Merge multiple token usages (for multi-step operations)
 */
export function mergeTokenUsages(...usages: TokenUsage[]): TokenUsage {
  return usages.reduce(
    (acc, usage) => ({
      promptTokens: acc.promptTokens + usage.promptTokens,
      completionTokens: acc.completionTokens + usage.completionTokens,
      totalTokens: acc.totalTokens + usage.totalTokens,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  );
}
