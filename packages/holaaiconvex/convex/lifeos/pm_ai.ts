/**
 * PM AI Agent
 * AI assistant for managing projects, issues, cycles, and labels
 * Using @convex-dev/agent for built-in thread persistence and tool execution
 */
import { Agent } from "@convex-dev/agent";
import { gateway } from "@ai-sdk/gateway";
import { v } from "convex/values";
import { action, query } from "../_generated/server";
import { components, internal } from "../_generated/api";
import { pmTools } from "./lib/pm_tools";
import { createMeteredUsageHandler } from "../common/ai";
import { requireUser } from "../_lib/auth";

// ==================== AGENT DEFINITION ====================

export const pmAgent = new Agent(components.agent, {
  name: "PM Assistant",
  languageModel: gateway("google/gemini-2.5-flash"),
  instructions: `You are a helpful project management assistant for LifeOS.
You can help users manage their projects, issues, cycles, and labels.

**CRITICAL: Always provide a natural language response to the user after using tools.**
- After calling list_projects, summarize the projects you found
- After calling list_issues, describe the issues
- After calling get_pm_context, explain what you learned
- After creating/updating items, confirm what was done

Available actions:
- Create, update, delete issues
- Create, update, archive projects
- Create, update, delete cycles
- Create labels

Guidelines:
- When creating issues, use clear, actionable titles
- When listing items, format the response clearly with the data returned
- Be concise but helpful
- Ask clarifying questions when the request is ambiguous
- Confirm destructive actions (delete, archive) before executing
- After creating items, report the ID/identifier so the user can reference it
- Always call get_pm_context first to understand the current state if you need context`,
  tools: pmTools,
  // Allow multiple steps so the model can:
  // 1. Make tool call(s)
  // 2. Receive tool result(s)
  // 3. Generate final text response
  maxSteps: 5,
  // Use centralized metered usage handler for automatic credit deduction
  usageHandler: createMeteredUsageHandler("pm_agent"),
});

// ==================== EXPOSED ACTIONS ====================

/**
 * Create a new thread for PM AI chat
 * Associates thread with authenticated user for persistence
 */
export const createThread = action({
  args: {
    title: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ threadId: string }> => {
    // Get user ID for thread association
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;

    const { threadId } = await pmAgent.createThread(ctx, {
      userId,
      title: args.title ?? "PM Chat",
    });
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyResult = result as any;

    // Extract tool calls, results, and text from steps[].content[]
    const extractedToolCalls: Array<{ name: string; args: unknown }> = [];
    const extractedToolResults: Array<{ name: string; result: unknown }> = [];
    const textParts: string[] = [];

    if (anyResult.steps && Array.isArray(anyResult.steps)) {
      for (const step of anyResult.steps) {
        // Check for text in step.text (the LLM's text response in this step)
        if (step.text && typeof step.text === "string" && step.text.trim()) {
          textParts.push(step.text);
        }

        if (step.content && Array.isArray(step.content)) {
          for (const item of step.content) {
            if (item.type === "tool-call" && item.toolName) {
              extractedToolCalls.push({
                name: item.toolName,
                args: item.input,
              });
            }
            if (item.type === "tool-result" && item.toolName) {
              extractedToolResults.push({
                name: item.toolName,
                result: item.output,
              });
            }
            // Also check for text content type
            if (item.type === "text" && item.text) {
              textParts.push(item.text);
            }
          }
        }
      }
    }

    // Use result.text if available, otherwise join text parts from steps
    const finalText = result.text || textParts.join("\n");

    return {
      text: finalText,
      toolCalls: extractedToolCalls.length > 0 ? extractedToolCalls : undefined,
      toolResults: extractedToolResults.length > 0 ? extractedToolResults : undefined,
    };
  },
});

// ==================== THREAD & MESSAGE QUERIES ====================

/**
 * List all PM AI threads for the current user
 */
export const listThreads = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const userId = identity.subject;

    const result = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      {
        userId,
        paginationOpts: {
          numItems: args.limit ?? 20,
          cursor: null,
        },
        order: "desc",
      }
    );

    return result.page.filter((t) => t.status === "active");
  },
});

/**
 * Get messages for a specific thread
 * Returns messages in ascending order (oldest first) for chat display
 */
export const getThreadMessages = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    const result = await ctx.runQuery(
      components.agent.messages.listMessagesByThreadId,
      {
        threadId,
        order: "asc",
        statuses: ["success"],
        paginationOpts: {
          numItems: 100,
          cursor: null,
        },
      }
    );

    // Transform messages to a simpler format for the frontend
    return result.page.map((msg) => {
      const message = msg.message;
      if (!message) return null;

      // Extract text content from message
      let textContent = "";
      const toolCalls: Array<{ name: string; args: unknown }> = [];
      const toolResults: Array<{ name: string; result: unknown }> = [];

      if (typeof message.content === "string") {
        textContent = message.content;
      } else if (Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part.type === "text" && "text" in part) {
            textContent += part.text;
          } else if (part.type === "tool-call" && "toolName" in part) {
            toolCalls.push({
              name: part.toolName,
              args: part.args,
            });
          } else if (part.type === "tool-result" && "toolName" in part) {
            toolResults.push({
              name: part.toolName,
              result: "output" in part ? part.output : undefined,
            });
          }
        }
      }

      return {
        id: msg._id,
        role: message.role as "user" | "assistant",
        content: textContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        createdAt: msg._creationTime,
      };
    }).filter(Boolean);
  },
});

/**
 * Update thread title
 */
export const updateThreadTitle = action({
  args: {
    threadId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, { threadId, title }) => {
    await ctx.runMutation(components.agent.threads.updateThread, {
      threadId,
      patch: { title },
    });
    return { success: true };
  },
});
