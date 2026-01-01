/**
 * Demo AI Agent
 * AI assistant for demonstrating Convex AI agent capabilities with tool use
 * Using @convex-dev/agent for built-in thread persistence and tool execution
 */
import { Agent } from "@convex-dev/agent";
import { gateway } from "@ai-sdk/gateway";
import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "../_generated/server";
import { components, internal } from "../_generated/api";
import { demoTools } from "./lib/demo_tools";
import { vTokenUsage } from "./demo_agent_schema";

// ==================== AVAILABLE MODELS ====================

/**
 * Whitelisted models for the demo agent
 * Format: provider/model-name (Vercel AI Gateway format)
 */
export const DEMO_AGENT_MODELS = [
  "openai/gpt-5-nano",
  "google/gemini-2.5-flash-lite",
  "xai/grok-4.1-fast-reasoning",
  "openai/gpt-5-mini",
  "openai/gpt-5.1-codex-mini",
  "google/gemini-3-flash",
  "anthropic/claude-haiku-4.5",
] as const;

export type DemoAgentModelId = (typeof DEMO_AGENT_MODELS)[number];

// Default model if none specified
const DEFAULT_MODEL: DemoAgentModelId = "openai/gpt-5-nano";

// ==================== INTERNAL MUTATIONS FOR USAGE TRACKING ====================

/**
 * Save token usage to the database
 * Called by the usageHandler in the Agent
 */
export const saveUsage = internalMutation({
  args: {
    threadId: v.string(),
    agentName: v.string(),
    model: v.string(),
    provider: v.string(),
    usage: vTokenUsage,
    providerMetadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("lifeos_demoAgentUsage", {
      threadId: args.threadId,
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
      .query("lifeos_demoAgentUsage")
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

// ==================== AGENT INSTRUCTIONS ====================

const AGENT_INSTRUCTIONS = `You are a helpful demo assistant showcasing AI agent capabilities with tool use.

Available tools:
- get_weather: Get current weather for any city (returns temperature, condition, humidity)
- get_time: Get current time in any timezone (use IANA timezone names like America/New_York)
- calculate: Perform mathematical calculations (supports +, -, *, /, parentheses)

Guidelines:
- When users ask about weather, time, or math, use the appropriate tool
- Be helpful, concise, and friendly
- IMPORTANT: After using any tool, you MUST ALWAYS provide a natural language response explaining the result to the user. Never end your response with just a tool call.
- If a tool returns an error, explain what went wrong and how to fix it
- You can use multiple tools in a single response if needed`;

// ==================== AGENT FACTORY ====================

/**
 * Create a demo agent with a specific model
 * Uses the gateway provider to connect to Vercel AI Gateway
 */
function createDemoAgent(modelId: DemoAgentModelId = DEFAULT_MODEL) {
  return new Agent(components.agent, {
    name: "Demo Assistant",
    languageModel: gateway(modelId),
    instructions: AGENT_INSTRUCTIONS,
    tools: demoTools,
    // Allow multiple steps so the model can:
    // 1. Make tool call(s)
    // 2. Receive tool result(s)
    // 3. Generate final text response
    maxSteps: 5,
    // Track token usage - saves to database for each LLM call
    usageHandler: async (ctx, args) => {
      const { usage, model, provider, agentName, threadId } = args;

      // Usage object may have different property names depending on AI SDK version
      // Cast to any to safely access properties
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const usageAny = usage as any;
      const promptTokens = usageAny.promptTokens ?? usageAny.inputTokens ?? 0;
      const completionTokens = usageAny.completionTokens ?? usageAny.outputTokens ?? 0;

      // Save usage to database
      await ctx.runMutation(internal.lifeos.demo_agent.saveUsage, {
        threadId: threadId ?? "unknown",
        agentName: agentName ?? "Demo Assistant",
        model: model ?? modelId,
        provider: provider ?? modelId.split("/")[0],
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        providerMetadata: args.providerMetadata,
      });
    },
  });
}

// Default agent instance for backward compatibility
export const demoAgent = createDemoAgent(DEFAULT_MODEL);

// ==================== EXPOSED ACTIONS ====================

/**
 * Create a new thread for Demo AI chat
 */
export const createThread = action({
  args: {},
  handler: async (ctx): Promise<{ threadId: string }> => {
    const { threadId } = await demoAgent.createThread(ctx, {});
    return { threadId };
  },
});

/**
 * Send a message to the Demo AI and get a response
 * Supports dynamic model selection and returns token usage
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
    // Validate and use the specified model, or fall back to default
    const validModelId = (
      modelId && DEMO_AGENT_MODELS.includes(modelId as DemoAgentModelId)
        ? modelId
        : DEFAULT_MODEL
    ) as DemoAgentModelId;

    // Create agent with specified model
    const agent = createDemoAgent(validModelId);

    const { thread } = await agent.continueThread(ctx, { threadId });
    const result = await thread.generateText({
      prompt: message,
    });

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

    // Fetch usage from database (saved by usageHandler)
    const usageData = await ctx.runQuery(
      internal.lifeos.demo_agent.getThreadUsage,
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

// Note: Message listing will be handled via the agent's built-in thread context
// Each sendMessage call includes the full conversation history automatically
