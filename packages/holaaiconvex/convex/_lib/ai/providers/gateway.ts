/**
 * Vercel AI Gateway Provider Adapter
 *
 * Handles communication with Vercel AI Gateway which provides
 * unified access to multiple AI providers (OpenAI, Google, Anthropic, etc.)
 */

import type { AIRequest, AIResponse, AIMessage } from "../types";
import { AIProviderError } from "../types";
import { extractGatewayUsage } from "../token_extractors";

// Gateway endpoint (Vercel AI Gateway)
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

/**
 * Convert our AIMessage format to OpenAI-compatible format
 */
function formatMessagesForGateway(
  messages: AIMessage[]
): Array<{ role: string; content: string }> {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Call Vercel AI Gateway with a text generation request
 */
export async function callGateway(
  request: AIRequest,
  apiKey: string
): Promise<AIResponse> {
  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      messages: formatMessagesForGateway(request.messages),
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream: false,
      // response_format is supported by OpenAI and Google models via the gateway
      ...(request.responseFormat === "json" &&
        (request.model.startsWith("openai/") ||
          request.model.startsWith("google/")) && {
          response_format: { type: "json_object" },
        }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AIProviderError("gateway", response.status, errorText);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: unknown;
  };

  // Extract content from response
  const content = data.choices?.[0]?.message?.content ?? "";

  // Extract usage
  const usage = extractGatewayUsage(data.usage);

  return {
    content,
    usage,
    model: request.model,
    provider: "gateway",
    rawResponse: data,
  };
}

/**
 * Call Vercel AI Gateway with streaming (returns ReadableStream)
 *
 * Note: For streaming, we don't get usage data until the stream completes.
 * The caller needs to estimate tokens or use deferred billing.
 */
export async function streamGateway(
  request: AIRequest,
  apiKey: string
): Promise<{
  stream: ReadableStream<Uint8Array>;
  response: Response;
}> {
  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      messages: formatMessagesForGateway(request.messages),
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream: true,
      // response_format is supported by OpenAI and Google models via the gateway
      ...(request.responseFormat === "json" &&
        (request.model.startsWith("openai/") ||
          request.model.startsWith("google/")) && {
          response_format: { type: "json_object" },
        }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AIProviderError("gateway", response.status, errorText);
  }

  if (!response.body) {
    throw new AIProviderError("gateway", 500, "No response body for streaming");
  }

  return {
    stream: response.body,
    response,
  };
}
