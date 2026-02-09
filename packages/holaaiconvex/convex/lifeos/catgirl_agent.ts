/**
 * CatGirl AI Agent
 * AI assistant for LifeOS with access to projects, tasks, contacts, and notes
 * Using @convex-dev/agent for built-in thread persistence and tool execution
 * Authenticated via Clerk JWT (no API key required)
 */
import { Agent } from "@convex-dev/agent";
import { gateway } from "@ai-sdk/gateway";
import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "../_generated/server";
import { components, internal } from "../_generated/api";
import { catgirlTools } from "./lib/catgirl_tools";
import { vCatgirlTokenUsage } from "./catgirl_agent_schema";
import { setCurrentUserId } from "./lib/catgirl_context";
import { Id } from "../_generated/dataModel";

// ==================== AVAILABLE MODELS ====================

/**
 * Whitelisted models for the CatGirl agent
 * Format: provider/model-name (Vercel AI Gateway format)
 */
export const CATGIRL_AGENT_MODELS = [
  "google/gemini-3-flash",
  "openai/gpt-5",
] as const;

export type CatgirlAgentModelId = (typeof CATGIRL_AGENT_MODELS)[number];

// Default model if none specified
const DEFAULT_MODEL: CatgirlAgentModelId = "google/gemini-3-flash";

// ==================== INTERNAL MUTATIONS FOR USAGE TRACKING ====================

/**
 * Save token usage to the database
 * Called by the usageHandler in the Agent
 */
export const saveUsage = internalMutation({
  args: {
    threadId: v.string(),
    userId: v.id("users"),
    agentName: v.string(),
    model: v.string(),
    provider: v.string(),
    usage: vCatgirlTokenUsage,
    providerMetadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("lifeos_catgirlAgentUsage", {
      threadId: args.threadId,
      userId: args.userId,
      agentName: args.agentName,
      model: args.model,
      provider: args.provider,
      usage: args.usage,
      providerMetadata: args.providerMetadata,
      createdAt: Date.now(),
    });
  },
});

/**
 * Get total usage for a thread
 */
export const getThreadUsage = internalQuery({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    const usageRecords = await ctx.db
      .query("lifeos_catgirlAgentUsage")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();

    // Aggregate all usage records
    const totalUsage = usageRecords.reduce(
      (acc, record) => ({
        promptTokens: acc.promptTokens + record.usage.promptTokens,
        completionTokens: acc.completionTokens + record.usage.completionTokens,
        totalTokens: acc.totalTokens + record.usage.totalTokens,
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );

    return {
      usage: totalUsage,
      recordCount: usageRecords.length,
    };
  },
});

/**
 * Register a thread to a user for ownership validation
 */
export const registerThread = internalMutation({
  args: {
    threadId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("lifeos_catgirlAgentThreads", {
      threadId: args.threadId,
      userId: args.userId,
      createdAt: Date.now(),
    });
  },
});

/**
 * Validate thread ownership
 */
export const validateThreadOwnership = internalQuery({
  args: {
    threadId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, { threadId, userId }) => {
    const thread = await ctx.db
      .query("lifeos_catgirlAgentThreads")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .first();

    return thread?.userId === userId;
  },
});

/**
 * Get thread owner userId
 */
export const getThreadOwner = internalQuery({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    const thread = await ctx.db
      .query("lifeos_catgirlAgentThreads")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .first();

    return thread?.userId ?? null;
  },
});

// ==================== AGENT INSTRUCTIONS ====================

const AGENT_INSTRUCTIONS = `You are CatGirlAI, a helpful and friendly AI assistant for LifeOS personal productivity. You have access to the user's projects, tasks, contacts, notes, and AI conversation summaries.

Your personality:
- Friendly, helpful, and occasionally playful
- Efficient and focused on helping the user be productive
- Supportive and encouraging about their goals

Available tools:
- get_projects: List all projects with completion stats
- get_project: Get detailed info about a specific project
- get_tasks: List tasks with optional filters (project, status, priority)
- get_todays_tasks: Get tasks due today and top priorities
- create_issue: Create a new task/issue
- update_issue: Update task details (title, status, priority, due date)
- mark_issue_complete: Mark a task as done
- get_daily_agenda: Today's full agenda with tasks and events
- get_weekly_agenda: Weekly overview with tasks and events
- get_people: List contacts with optional filters
- search_people: Search contacts by name
- get_person: Get detailed info about a contact
- get_memos_for_person: Get voice memos/notes linked to a contact
- get_person_timeline: Get chronological timeline of interactions with a contact
- search_notes: Search voice memos/notes
- get_recent_notes: Get recent notes
- create_quick_note: Create a quick note
- get_ai_convo_summaries: List past AI conversation summaries/crystallized notes
- search_ai_convo_summaries: Search AI conversation summaries by content
- get_ai_convo_summary: Get a single AI conversation summary with full details
- create_ai_convo_summary: Save a crystallized summary from this conversation

Guidelines:
- When users ask about their day, use get_daily_agenda or get_todays_tasks
- When creating tasks, confirm what was created with the identifier (e.g., PROJ-123)
- Use project keys (like ACME) when referencing projects
- When users ask about interactions with a person, use get_person_timeline or get_memos_for_person
- When users want to save insights from this conversation, use create_ai_convo_summary
- When users reference past conversations or decisions, use search_ai_convo_summaries
- Be concise but friendly in responses
- If a tool returns an error, explain it helpfully
- IMPORTANT: After using any tool, always provide a natural language response explaining the result`;

// ==================== AGENT FACTORY ====================

/**
 * Create a CatGirl agent with a specific model
 * Uses the gateway provider to connect to Vercel AI Gateway
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createCatgirlAgent(modelId: CatgirlAgentModelId = DEFAULT_MODEL): any {
  return new Agent(components.agent, {
    name: "CatGirlAI",
    languageModel: gateway(modelId),
    instructions: AGENT_INSTRUCTIONS,
    tools: catgirlTools,
    // Allow multiple steps for complex multi-tool workflows
    maxSteps: 10,
    // Track token usage - saves to database AND deducts credits
    usageHandler: async (ctx, args) => {
      const { usage, model, provider, agentName, threadId } = args;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const usageAny = usage as any;
      const promptTokens = usageAny.promptTokens ?? usageAny.inputTokens ?? 0;
      const completionTokens = usageAny.completionTokens ?? usageAny.outputTokens ?? 0;
      const tokenUsage = {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      };

      // Get userId from thread ownership
      const userId = threadId
        ? await ctx.runQuery(internal.lifeos.catgirl_agent.getThreadOwner, { threadId })
        : null;

      if (userId) {
        // Save usage to database (for analytics)
        await ctx.runMutation(internal.lifeos.catgirl_agent.saveUsage, {
          threadId: threadId ?? "unknown",
          userId,
          agentName: agentName ?? "CatGirlAI",
          model: model ?? modelId,
          provider: provider ?? modelId.split("/")[0],
          usage: tokenUsage,
          providerMetadata: args.providerMetadata,
        });

        // Deduct credits (skip for unlimited access users)
        const creditCheck = await ctx.runQuery(
          internal.common.credits.checkCreditsForAction
        );
        if (!creditCheck.hasUnlimitedAccess && tokenUsage.totalTokens > 0) {
          await ctx.runMutation(internal.common.credits.deductCreditsInternal, {
            userId,
            feature: "catgirl_agent",
            tokenUsage,
            model: model ?? modelId,
            description: "CatGirl AI call",
          });
        }
      }
    },
  });
}

// Default agent instance
export const catgirlAgent = createCatgirlAgent(DEFAULT_MODEL);

// ==================== EXPOSED ACTIONS ====================

/**
 * Create a new thread for CatGirl AI chat
 * Requires Clerk authentication
 */
export const createThread = action({
  args: {},
  handler: async (ctx): Promise<{ threadId: string }> => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Get user from database
    const user = await ctx.runQuery(internal.common.users.getUserByTokenIdentifier, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) {
      throw new Error("User not found");
    }

    const userId = user._id as Id<"users">;
    const agent = createCatgirlAgent(DEFAULT_MODEL);
    const { threadId } = await agent.createThread(ctx, {
      userId: identity.subject,
      title: "New Chat",
    });

    // Register thread ownership
    await ctx.runMutation(internal.lifeos.catgirl_agent.registerThread, {
      threadId,
      userId,
    });

    return { threadId };
  },
});

/**
 * Send a message to CatGirl AI and get a response
 * Supports dynamic model selection and returns token usage
 * Requires Clerk authentication
 */
export const sendMessage = action({
  args: {
    threadId: v.string(),
    message: v.string(),
    modelId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { threadId, message, modelId }
  ): Promise<{
    text: string;
    toolCalls?: Array<{ name: string; args: unknown }>;
    toolResults?: Array<{ name: string; result: unknown }>;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    modelUsed: string;
  }> => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Get user from database
    const user = await ctx.runQuery(internal.common.users.getUserByTokenIdentifier, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) {
      throw new Error("User not found");
    }

    const userId = user._id as Id<"users">;

    // Validate thread ownership
    const isOwner = await ctx.runQuery(
      internal.lifeos.catgirl_agent.validateThreadOwnership,
      { threadId, userId }
    );
    if (!isOwner) {
      throw new Error("Thread not found or access denied");
    }

    // Check credits before making AI call (fail fast)
    const creditCheck = await ctx.runQuery(
      internal.common.credits.checkCreditsForAction
    );
    if (!creditCheck.allowed) {
      throw new Error(creditCheck.reason || "OUT_OF_CREDITS");
    }

    // Validate and use the specified model, or fall back to default
    const validModelId = (
      modelId && CATGIRL_AGENT_MODELS.includes(modelId as CatgirlAgentModelId)
        ? modelId
        : DEFAULT_MODEL
    ) as CatgirlAgentModelId;

    // Set userId for tool context
    setCurrentUserId(userId);

    // Create agent with specified model
    const agent = createCatgirlAgent(validModelId);

    const { thread } = await agent.continueThread(ctx, { threadId });
    const result = await thread.generateText({
      prompt: message,
    });

    // Clear userId after request
    setCurrentUserId(null);

    // Auto-title: if this is the first user message, update thread title
    try {
      const existingMessages = await ctx.runQuery(
        components.agent.messages.listMessagesByThreadId,
        {
          threadId,
          order: "asc",
          statuses: ["success"],
          paginationOpts: { numItems: 5, cursor: null },
        }
      );
      // If only 2 messages (the user msg + assistant response), it's the first exchange
      if (existingMessages.page.length <= 2) {
        const title = message.length > 60 ? message.slice(0, 57) + "..." : message;
        await ctx.runMutation(components.agent.threads.updateThread, {
          threadId,
          patch: { title },
        });
      }
    } catch {
      // Non-critical, don't fail the request
    }

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

    // Fetch usage from database (saved by usageHandler) for client display
    const usageData = await ctx.runQuery(
      internal.lifeos.catgirl_agent.getThreadUsage,
      { threadId }
    );

    return {
      text: finalText,
      toolCalls: extractedToolCalls,
      toolResults: extractedToolResults,
      usage: usageData.usage,
      modelUsed: validModelId,
    };
  },
});

// ==================== THREAD & MESSAGE QUERIES ====================

/**
 * List all CatGirl AI threads for the current user
 * Uses the SDK's built-in thread persistence
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
          numItems: args.limit ?? 30,
          cursor: null,
        },
        order: "desc",
      }
    );

    return result.page.filter((t) => t.status === "active");
  },
});

/**
 * Get messages for a specific CatGirl AI thread
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

    return result.page
      .map((msg) => {
        const message = msg.message;
        if (!message) return null;

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
      })
      .filter(Boolean);
  },
});

/**
 * Delete (archive) a CatGirl AI thread
 */
export const deleteThread = action({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const user = await ctx.runQuery(internal.common.users.getUserByTokenIdentifier, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) {
      throw new Error("User not found");
    }

    const userId = user._id as Id<"users">;

    // Validate ownership
    const isOwner = await ctx.runQuery(
      internal.lifeos.catgirl_agent.validateThreadOwnership,
      { threadId, userId }
    );
    if (!isOwner) {
      throw new Error("Thread not found or access denied");
    }

    // Archive the thread
    await ctx.runMutation(components.agent.threads.updateThread, {
      threadId,
      patch: { status: "archived" },
    });

    return { success: true };
  },
});
