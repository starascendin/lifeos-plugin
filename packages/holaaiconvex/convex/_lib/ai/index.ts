/**
 * AI Gateway Module
 *
 * Centralized AI infrastructure for all LLM operations.
 * This module provides:
 * - Unified types for AI requests/responses
 * - Token extraction utilities
 * - Model registry and configuration
 * - Provider adapters (Gateway, Gemini)
 *
 * Usage:
 * ```typescript
 * import { callProvider, getProviderForModel, TokenUsage } from "../_lib/ai";
 * ```
 */

// ==================== TYPES ====================
export type {
  AIProvider,
  AIMessage,
  AIRequest,
  AIResponse,
  TokenUsage,
  AIOperationContext,
} from "./types";

export {
  AIProviderError,
  ModelNotFoundError,
  MissingAPIKeyError,
} from "./types";

// ==================== TOKEN EXTRACTORS ====================
export {
  extractGatewayUsage,
  extractGeminiUsage,
  extractAISDKUsage,
  createFlatRateUsage,
  estimateTokensFromText,
  mergeTokenUsages,
} from "./token_extractors";

// ==================== MODEL REGISTRY ====================
export type { CostTier, ModelFeature, ModelConfig } from "./models";

export {
  MODEL_REGISTRY,
  DEFAULT_MODELS,
  getModelConfig,
  getProviderForModel,
  getDefaultModelForFeature,
  modelSupportsFeature,
  getModelsByProvider,
  getModelsByCostTier,
} from "./models";

// ==================== PROVIDERS ====================
export {
  callProvider,
  callGateway,
  streamGateway,
  callGemini,
  callGeminiJSON,
  getAPIKeyEnvVar,
  getAPIKeyForModel,
  validateModel,
  getValidatedProvider,
} from "./providers";
