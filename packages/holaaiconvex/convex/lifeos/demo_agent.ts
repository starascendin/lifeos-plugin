/**
 * Demo AI Agent
 * AI assistant for demonstrating Convex AI agent capabilities with tool use
 * Using @convex-dev/agent for built-in thread persistence and tool execution
 */
import { Agent } from "@convex-dev/agent";
import { gateway } from "@ai-sdk/gateway";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { components } from "../_generated/api";
import { demoTools } from "./lib/demo_tools";

// ==================== AGENT DEFINITION ====================

export const demoAgent = new Agent(components.agent, {
  name: "Demo Assistant",
  languageModel: gateway("openai/gpt-4o-mini"),
  instructions: `You are a helpful demo assistant showcasing AI agent capabilities with tool use.

Available tools:
- get_weather: Get current weather for any city (returns temperature, condition, humidity)
- get_time: Get current time in any timezone (use IANA timezone names like America/New_York)
- calculate: Perform mathematical calculations (supports +, -, *, /, parentheses)

Guidelines:
- When users ask about weather, time, or math, use the appropriate tool
- Be helpful, concise, and friendly
- IMPORTANT: After using any tool, you MUST ALWAYS provide a natural language response explaining the result to the user. Never end your response with just a tool call.
- If a tool returns an error, explain what went wrong and how to fix it
- You can use multiple tools in a single response if needed`,
  tools: demoTools,
});

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
 */
export const sendMessage = action({
  args: {
    threadId: v.string(),
    message: v.string(),
  },
  handler: async (
    ctx,
    { threadId, message }
  ): Promise<{
    text: string;
    toolCalls?: Array<{ name: string; args: unknown }>;
    toolResults?: Array<{ name: string; result: unknown }>;
  }> => {
    const { thread } = await demoAgent.continueThread(ctx, { threadId });
    const result = await thread.generateText({
      prompt: message,
    });

    // Debug: Log the entire result structure to find where text lives
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyResult = result as any;
    console.log("=== generateText result ===");
    console.log("result.text:", result.text);
    console.log("result keys:", Object.keys(result));
    if (anyResult.steps) {
      console.log("steps count:", anyResult.steps.length);
      anyResult.steps.forEach((step: any, i: number) => {
        console.log(`step[${i}] keys:`, Object.keys(step));
        console.log(`step[${i}].text:`, step.text);
        console.log(`step[${i}].finishReason:`, step.finishReason);
        if (step.content) {
          console.log(`step[${i}].content:`, JSON.stringify(step.content, null, 2));
        }
      });
    }
    if (anyResult.response) {
      console.log("response keys:", Object.keys(anyResult.response));
    }
    console.log("=== end result ===");

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
    console.log("finalText:", finalText);
    console.log("textParts:", textParts);

    return {
      text: finalText,
      toolCalls: extractedToolCalls,
      toolResults: extractedToolResults,
    };
  },
});

// Note: Message listing will be handled via the agent's built-in thread context
// Each sendMessage call includes the full conversation history automatically
