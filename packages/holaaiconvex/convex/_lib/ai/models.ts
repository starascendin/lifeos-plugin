/**
 * Model Registry
 *
 * Central registry of all supported AI models with their configurations.
 * This provides a single source of truth for model selection and routing.
 */

import type { AIProvider } from "./types";
import type { MeteringFeature } from "../credits";

// ==================== MODEL CONFIG ====================

/**
 * Cost tier for models (affects credit pricing)
 */
export type CostTier = "low" | "medium" | "high";

/**
 * Features supported by a model
 */
export type ModelFeature = "text" | "json" | "chat" | "streaming" | "vision";

/**
 * Configuration for a single model
 */
export interface ModelConfig {
  /** Full model ID as used in API calls */
  id: string;
  /** Which provider handles this model */
  provider: AIProvider;
  /** Human-readable name */
  displayName: string;
  /** Maximum context window in tokens */
  contextWindow: number;
  /** Cost tier for billing */
  costTier: CostTier;
  /** Features this model supports */
  supportedFeatures: ModelFeature[];
}

// ==================== MODEL REGISTRY ====================

/**
 * Registry of all supported models
 *
 * Models accessed via Vercel AI Gateway use format: "provider/model-name"
 * Models accessed directly use their native ID format
 */
export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // ==================== VERCEL AI GATEWAY MODELS ====================

  // Google models via Gateway
  "google/gemini-2.5-flash-lite": {
    id: "google/gemini-2.5-flash-lite",
    provider: "gateway",
    displayName: "Gemini 2.5 Flash Lite",
    contextWindow: 1000000,
    costTier: "low",
    supportedFeatures: ["text", "json", "chat", "streaming"],
  },
  "google/gemini-2.5-flash": {
    id: "google/gemini-2.5-flash",
    provider: "gateway",
    displayName: "Gemini 2.5 Flash",
    contextWindow: 1000000,
    costTier: "low",
    supportedFeatures: ["text", "json", "chat", "streaming", "vision"],
  },
  "google/gemini-2.5-pro-preview": {
    id: "google/gemini-2.5-pro-preview",
    provider: "gateway",
    displayName: "Gemini 2.5 Pro",
    contextWindow: 1000000,
    costTier: "high",
    supportedFeatures: ["text", "json", "chat", "streaming", "vision"],
  },

  // OpenAI models via Gateway
  "openai/gpt-4o-mini": {
    id: "openai/gpt-4o-mini",
    provider: "gateway",
    displayName: "GPT-4o Mini",
    contextWindow: 128000,
    costTier: "low",
    supportedFeatures: ["text", "json", "chat", "streaming", "vision"],
  },
  "openai/gpt-4o": {
    id: "openai/gpt-4o",
    provider: "gateway",
    displayName: "GPT-4o",
    contextWindow: 128000,
    costTier: "medium",
    supportedFeatures: ["text", "json", "chat", "streaming", "vision"],
  },
  "openai/gpt-5-nano": {
    id: "openai/gpt-5-nano",
    provider: "gateway",
    displayName: "GPT-5 Nano",
    contextWindow: 128000,
    costTier: "low",
    supportedFeatures: ["text", "json", "chat", "streaming"],
  },

  // Anthropic models via Gateway
  "anthropic/claude-sonnet-4": {
    id: "anthropic/claude-sonnet-4",
    provider: "gateway",
    displayName: "Claude Sonnet 4",
    contextWindow: 200000,
    costTier: "medium",
    supportedFeatures: ["text", "json", "chat", "streaming", "vision"],
  },

  // xAI models via Gateway
  "x-ai/grok-3": {
    id: "x-ai/grok-3",
    provider: "gateway",
    displayName: "Grok 3",
    contextWindow: 128000,
    costTier: "medium",
    supportedFeatures: ["text", "json", "chat", "streaming"],
  },
  "xai/grok-4.1-fast-reasoning": {
    id: "xai/grok-4.1-fast-reasoning",
    provider: "gateway",
    displayName: "Grok 4.1 Fast",
    contextWindow: 128000,
    costTier: "medium",
    supportedFeatures: ["text", "json", "chat", "streaming"],
  },

  // ==================== DIRECT GEMINI API MODELS ====================

  // These use the direct Gemini API (not Gateway)
  // Used when we need specific Gemini features or lower latency
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    provider: "gemini",
    displayName: "Gemini 2.5 Flash (Direct)",
    contextWindow: 1000000,
    costTier: "low",
    supportedFeatures: ["text", "json"],
  },
};

// ==================== DEFAULT MODELS PER FEATURE ====================

/**
 * Default model for each metering feature
 * Used when no specific model is requested
 */
export const DEFAULT_MODELS: Record<MeteringFeature, string> = {
  // LifeOS features
  agenda_daily_summary: "openai/gpt-4o-mini",
  agenda_weekly_summary: "openai/gpt-4o-mini",
  pm_agent: "google/gemini-2.5-flash-lite",
  demo_agent: "google/gemini-2.5-flash-lite",
  chatnexus: "openai/gpt-4o-mini",
  llm_council: "openai/gpt-4o",
  voice_memo_extraction: "google/gemini-2.5-flash", // Use Gateway

  // HolaAI features (use direct Gemini for lower latency)
  holaai_lesson: "gemini-2.5-flash",
  holaai_conversation: "gemini-2.5-flash",
  holaai_suggestions: "gemini-2.5-flash",
  holaai_voice: "gemini-2.5-flash",
  holaai_translate: "gemini-2.5-flash",
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Get model configuration by ID
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODEL_REGISTRY[modelId];
}

/**
 * Get provider for a model ID
 * Returns "gateway" for unknown models (safer default)
 */
export function getProviderForModel(modelId: string): AIProvider {
  const config = MODEL_REGISTRY[modelId];
  return config?.provider ?? "gateway";
}

/**
 * Get default model for a feature
 */
export function getDefaultModelForFeature(feature: MeteringFeature): string {
  return DEFAULT_MODELS[feature];
}

/**
 * Check if a model supports a specific feature
 */
export function modelSupportsFeature(
  modelId: string,
  feature: ModelFeature
): boolean {
  const config = MODEL_REGISTRY[modelId];
  return config?.supportedFeatures.includes(feature) ?? false;
}

/**
 * Get all models for a specific provider
 */
export function getModelsByProvider(provider: AIProvider): ModelConfig[] {
  return Object.values(MODEL_REGISTRY).filter((m) => m.provider === provider);
}

/**
 * Get all models by cost tier
 */
export function getModelsByCostTier(tier: CostTier): ModelConfig[] {
  return Object.values(MODEL_REGISTRY).filter((m) => m.costTier === tier);
}
