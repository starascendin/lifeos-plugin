/**
 * AI Domain Types
 *
 * Unified type definitions for all AI operations across providers.
 * This is the domain layer of the AI Gateway architecture.
 */

import type { MeteringFeature } from "../credits";

// ==================== PROVIDERS ====================

/**
 * Supported AI providers
 * - gateway: Vercel AI Gateway (supports multiple models via unified API)
 * - gemini: Direct Google Gemini API (for specific use cases)
 */
export type AIProvider = "gateway" | "gemini";

// ==================== REQUEST/RESPONSE ====================

/**
 * Message in an AI conversation
 */
export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Unified AI request interface
 * Works with both Vercel AI Gateway and direct Gemini API
 */
export interface AIRequest {
  /** Model ID (e.g., "openai/gpt-4o-mini", "gemini-2.5-flash") */
  model: string;
  /** Conversation messages */
  messages: AIMessage[];
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for response randomness (0-1) */
  temperature?: number;
  /** Response format type */
  responseFormat?: "text" | "json";
}

/**
 * Token usage information (unified across providers)
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Unified AI response interface
 */
export interface AIResponse {
  /** Generated content */
  content: string;
  /** Token usage for billing */
  usage: TokenUsage;
  /** Model that was used */
  model: string;
  /** Provider that handled the request */
  provider: AIProvider;
  /** Raw response from provider (for debugging) */
  rawResponse?: unknown;
}

// ==================== CONTEXT ====================

/**
 * Context for AI operations (used for credit metering)
 */
export interface AIOperationContext {
  /** Feature being used (for credit tracking) */
  feature: MeteringFeature;
  /** Human-readable description of the operation */
  description?: string;
}

// ==================== ERRORS ====================

/**
 * Error thrown when an AI provider fails
 */
export class AIProviderError extends Error {
  constructor(
    public provider: AIProvider,
    public statusCode: number,
    public details: string
  ) {
    super(`AI Provider Error (${provider}): ${statusCode} - ${details}`);
    this.name = "AIProviderError";
  }
}

/**
 * Error thrown when model is not found in registry
 */
export class ModelNotFoundError extends Error {
  constructor(public modelId: string) {
    super(`Model not found in registry: ${modelId}`);
    this.name = "ModelNotFoundError";
  }
}

/**
 * Error thrown when API key is missing
 */
export class MissingAPIKeyError extends Error {
  constructor(public provider: AIProvider) {
    super(`API key not configured for provider: ${provider}`);
    this.name = "MissingAPIKeyError";
  }
}
