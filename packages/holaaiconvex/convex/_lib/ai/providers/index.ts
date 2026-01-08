/**
 * Provider Factory
 *
 * Central routing for AI provider calls.
 * Routes requests to the appropriate provider based on model configuration.
 */

import type { AIProvider, AIRequest, AIResponse } from "../types";
import { MissingAPIKeyError, ModelNotFoundError } from "../types";
import { getProviderForModel, getModelConfig } from "../models";
import { callGateway, streamGateway } from "./gateway";
import { callGemini } from "./gemini";

// Re-export providers for direct access if needed
export { callGateway, streamGateway } from "./gateway";
export { callGemini, callGeminiJSON } from "./gemini";
export { getProviderForModel } from "../models";

/**
 * Call the appropriate provider based on the model
 *
 * This is the main entry point for making AI calls.
 * It automatically routes to the correct provider.
 */
export async function callProvider(
  request: AIRequest,
  apiKey: string
): Promise<AIResponse> {
  const provider = getProviderForModel(request.model);

  if (!apiKey) {
    throw new MissingAPIKeyError(provider);
  }

  switch (provider) {
    case "gateway":
      return callGateway(request, apiKey);
    case "gemini":
      return callGemini(request, apiKey);
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
  }
}

/**
 * Get the required API key for a model
 *
 * Returns the environment variable name for the API key
 */
export function getAPIKeyEnvVar(modelId: string): string {
  const provider = getProviderForModel(modelId);

  switch (provider) {
    case "gateway":
      return "AI_GATEWAY_API_KEY";
    case "gemini":
      return "GEMINI_API_KEY";
    default:
      return "AI_GATEWAY_API_KEY";
  }
}

/**
 * Get the API key from environment for a model
 */
export function getAPIKeyForModel(modelId: string): string | undefined {
  const envVar = getAPIKeyEnvVar(modelId);
  return process.env[envVar];
}

/**
 * Validate that a model is supported
 */
export function validateModel(modelId: string): void {
  const config = getModelConfig(modelId);
  if (!config) {
    throw new ModelNotFoundError(modelId);
  }
}

/**
 * Get provider for a model (with validation)
 */
export function getValidatedProvider(modelId: string): AIProvider {
  validateModel(modelId);
  return getProviderForModel(modelId);
}
