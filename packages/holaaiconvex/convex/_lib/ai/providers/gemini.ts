/**
 * Direct Gemini API Provider Adapter
 *
 * Handles communication directly with Google's Gemini API.
 * Used for specific use cases where we need:
 * - Lower latency (direct connection)
 * - Specific Gemini features not available via Gateway
 */

import type { AIRequest, AIResponse, AIMessage } from "../types";
import { AIProviderError } from "../types";
import { extractGeminiUsage } from "../token_extractors";

// Gemini API base URL
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Convert our AIMessage format to Gemini's format
 *
 * Gemini uses a different message format:
 * - "contents" array with "parts" containing "text"
 * - System messages are handled differently (systemInstruction)
 */
function formatMessagesForGemini(messages: AIMessage[]): {
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  systemInstruction?: { parts: Array<{ text: string }> };
} {
  // Extract system message if present
  const systemMessage = messages.find((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  // Convert messages to Gemini format
  const contents = nonSystemMessages.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const result: {
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    systemInstruction?: { parts: Array<{ text: string }> };
  } = { contents };

  // Add system instruction if present
  if (systemMessage) {
    result.systemInstruction = {
      parts: [{ text: systemMessage.content }],
    };
  }

  return result;
}

/**
 * Call Google Gemini API directly
 */
export async function callGemini(
  request: AIRequest,
  apiKey: string
): Promise<AIResponse> {
  const modelId = request.model;
  const url = `${GEMINI_API_BASE}/${modelId}:generateContent?key=${apiKey}`;

  const { contents, systemInstruction } = formatMessagesForGemini(
    request.messages
  );

  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
      ...(request.responseFormat === "json" && {
        responseMimeType: "application/json",
      }),
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage =
      (errorData as { error?: { message?: string } })?.error?.message ||
      response.statusText;
    throw new AIProviderError("gemini", response.status, errorMessage);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    usageMetadata?: unknown;
  };

  // Extract content from Gemini response format
  const content =
    data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Extract usage from usageMetadata
  const usage = extractGeminiUsage(data.usageMetadata);

  return {
    content,
    usage,
    model: request.model,
    provider: "gemini",
    rawResponse: data,
  };
}

/**
 * Call Gemini with JSON response format
 *
 * Convenience wrapper for structured output
 */
export async function callGeminiJSON<T>(
  request: Omit<AIRequest, "responseFormat">,
  apiKey: string
): Promise<{ content: T; usage: AIResponse["usage"] }> {
  const response = await callGemini(
    { ...request, responseFormat: "json" },
    apiKey
  );

  try {
    const parsed = JSON.parse(response.content) as T;
    return {
      content: parsed,
      usage: response.usage,
    };
  } catch {
    throw new AIProviderError(
      "gemini",
      500,
      `Failed to parse JSON response: ${response.content.substring(0, 100)}`
    );
  }
}
