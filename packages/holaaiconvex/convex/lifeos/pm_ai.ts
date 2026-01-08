/**
 * PM AI Agent
 * AI assistant for managing projects, issues, cycles, and labels
 * Using @convex-dev/agent for built-in thread persistence and tool execution
 */
import { Agent } from "@convex-dev/agent";
import { gateway } from "@ai-sdk/gateway";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { components, internal } from "../_generated/api";
import { pmTools } from "./lib/pm_tools";
import type { MeteringFeature } from "../_lib/credits";

// ==================== AGENT DEFINITION ====================

export const pmAgent = new Agent(components.agent, {
  name: "PM Assistant",
  languageModel: gateway("google/gemini-2.5-flash-lite"),
  instructions: `You are a helpful project management assistant for LifeOS.
You can help users manage their projects, issues, cycles, and labels.

Available actions:
- Create, update, delete issues
- Create, update, archive projects
- Create, update, delete cycles
- Create labels

Guidelines:
- When creating issues, use clear, actionable titles
- When listing items, format the response in a clear, readable way
- Be concise but helpful
- Ask clarifying questions when the request is ambiguous
- Confirm destructive actions (delete, archive) before executing
- After creating items, report the ID/identifier so the user can reference it
- Always call get_pm_context first to understand the current state if you need context`,
  tools: pmTools,
});

// ==================== EXPOSED ACTIONS ====================

/**
 * Create a new thread for PM AI chat
 */
export const createThread = action({
  args: {},
  handler: async (ctx): Promise<{ threadId: string }> => {
    const { threadId } = await pmAgent.createThread(ctx, {});
    return { threadId };
  },
});

/**
 * Send a message to the PM AI and get a response
 */
export const sendMessage = action({
  args: {
    threadId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { threadId, message }): Promise<{
    text: string;
    toolCalls?: Array<{ name: string; args: unknown }>;
    toolResults?: Array<{ name: string; result: unknown }>;
  }> => {
    const feature: MeteringFeature = "pm_agent";

    // Check credits before making AI call
    const creditCheck = await ctx.runQuery(
      internal.common.credits.checkCreditsForAction
    );
    if (!creditCheck.allowed) {
      throw new Error(creditCheck.reason || "OUT_OF_CREDITS");
    }

    const { thread } = await pmAgent.continueThread(ctx, { threadId });
    const result = await thread.generateText({ prompt: message });

    // Deduct credits if not unlimited access and we have usage data
    if (!creditCheck.hasUnlimitedAccess && result.usage) {
      // AI SDK v3+ uses inputTokens/outputTokens instead of promptTokens/completionTokens
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const usageAny = result.usage as any;
      const tokenUsage = {
        promptTokens: usageAny.promptTokens ?? usageAny.inputTokens ?? 0,
        completionTokens: usageAny.completionTokens ?? usageAny.outputTokens ?? 0,
        totalTokens: usageAny.totalTokens ?? 0,
      };
      await ctx.runMutation(internal.common.credits.deductCreditsInternal, {
        userId: creditCheck.userId,
        feature,
        tokenUsage,
        model: "google/gemini-2.5-flash-lite",
        description: "PM Agent message",
      });
    }

    return {
      text: result.text,
      toolCalls: result.toolCalls?.map((tc: any) => ({
        name: tc.toolName,
        args: tc.args,
      })),
      toolResults: result.toolResults?.map((tr: any) => ({
        name: tr.toolName,
        result: tr.result,
      })),
    };
  },
});

// Note: Message listing will be handled via the agent's built-in thread context
// Each sendMessage call includes the full conversation history automatically
