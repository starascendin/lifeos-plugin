"use node";

/**
 * AI Application Service
 *
 * This is the SINGLE ENTRY POINT for all AI operations.
 * It automatically handles:
 * - Credit checking before AI calls
 * - Provider routing based on model
 * - Token usage extraction
 * - Credit deduction after successful calls
 *
 * Usage:
 * ```typescript
 * const result = await ctx.runAction(internal.common.ai.executeAICall, {
 *   request: {
 *     model: "openai/gpt-4o-mini",
 *     messages: [{ role: "user", content: "Hello" }],
 *   },
 *   context: { feature: "my_feature" },
 * });
 * ```
 *
 * For streaming credits deduction, use:
 * - internal.common.credits.deductStreamingCredits
 * - internal.common.credits.deductStreamingCreditsFromText
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

import {
  callProvider,
  getProviderForModel,
  getAPIKeyForModel,
  extractAISDKUsage,
} from "../_lib/ai";
import type { AIRequest, AIResponse } from "../_lib/ai";
import type { MeteringFeature } from "../_lib/credits";

// ==================== MAIN ENTRY POINT ====================

/**
 * Execute an AI call with automatic credit metering
 *
 * This is the RECOMMENDED way to make AI calls.
 * It handles everything: credit check, provider routing, and billing.
 */
export const executeAICall = internalAction({
  args: {
    request: v.object({
      model: v.string(),
      messages: v.array(
        v.object({
          role: v.string(),
          content: v.string(),
        })
      ),
      maxTokens: v.optional(v.number()),
      temperature: v.optional(v.number()),
      responseFormat: v.optional(v.string()),
    }),
    context: v.object({
      feature: v.string(),
      description: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { request, context }): Promise<AIResponse> => {
    // 1. Check credits
    const creditCheck = await ctx.runQuery(
      internal.common.credits.checkCreditsForAction
    );
    if (!creditCheck.allowed) {
      throw new Error(creditCheck.reason || "OUT_OF_CREDITS");
    }

    // 2. Get API key for the model's provider
    const apiKey = getAPIKeyForModel(request.model);
    if (!apiKey) {
      const provider = getProviderForModel(request.model);
      throw new Error(`API key not configured for provider: ${provider}`);
    }

    // 3. Make AI call
    const aiRequest: AIRequest = {
      model: request.model,
      messages: request.messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      })),
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      responseFormat: request.responseFormat as "text" | "json" | undefined,
    };

    const response = await callProvider(aiRequest, apiKey);

    // 4. Deduct credits if not unlimited
    if (!creditCheck.hasUnlimitedAccess && response.usage.totalTokens > 0) {
      await ctx.runMutation(internal.common.credits.deductCreditsInternal, {
        userId: creditCheck.userId,
        feature: context.feature,
        tokenUsage: response.usage,
        model: request.model,
        description: context.description || `AI call: ${context.feature}`,
      });
    }

    return response;
  },
});

// ==================== AGENT INTEGRATION ====================

/**
 * Create a metered usage handler for @convex-dev/agent
 *
 * Use this when creating agents that should be metered:
 * ```typescript
 * import { createMeteredUsageHandler } from "../common/ai";
 *
 * const myAgent = new Agent(components.agent, {
 *   languageModel: gateway("openai/gpt-4o-mini"),
 *   usageHandler: createMeteredUsageHandler("my_feature"),
 * });
 * ```
 */
export function createMeteredUsageHandler(feature: MeteringFeature) {
  // Return a handler compatible with @convex-dev/agent's UsageHandler type
  // Using 'any' for ctx to avoid TypeScript variance issues between different ActionCtx types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (
    ctx: any,
    args: {
      usage: unknown;
      model?: string;
      provider?: string;
      promptTokens?: number;
      completionTokens?: number;
    }
  ) => {
    // Get credit check result
    const creditCheck = await ctx.runQuery(
      internal.common.credits.checkCreditsForAction
    );

    // Skip deduction for unlimited access users
    if (creditCheck.hasUnlimitedAccess) {
      return;
    }

    // Extract usage from agent callback
    const usage = extractAISDKUsage(args.usage);

    // Deduct credits
    await ctx.runMutation(internal.common.credits.deductCreditsInternal, {
      userId: creditCheck.userId,
      feature,
      tokenUsage: usage,
      model: args.model || "unknown",
      description: `${feature} agent call`,
    });
  };
}
