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
import { createMeteredUsageHandler } from "../common/ai";

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
  // Use centralized metered usage handler for automatic credit deduction
  usageHandler: createMeteredUsageHandler("pm_agent"),
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
 * Credit deduction is handled automatically by the usageHandler in pmAgent
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
    // Check credits before making AI call (fail fast)
    const creditCheck = await ctx.runQuery(
      internal.common.credits.checkCreditsForAction
    );
    if (!creditCheck.allowed) {
      throw new Error(creditCheck.reason || "OUT_OF_CREDITS");
    }

    // Make AI call - credit deduction handled by usageHandler
    const { thread } = await pmAgent.continueThread(ctx, { threadId });
    const result = await thread.generateText({ prompt: message });

    return {
      text: result.text,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toolCalls: result.toolCalls?.map((tc: any) => ({
        name: tc.toolName,
        args: tc.args,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toolResults: result.toolResults?.map((tr: any) => ({
        name: tr.toolName,
        result: tr.result,
      })),
    };
  },
});

// Note: Message listing will be handled via the agent's built-in thread context
// Each sendMessage call includes the full conversation history automatically
