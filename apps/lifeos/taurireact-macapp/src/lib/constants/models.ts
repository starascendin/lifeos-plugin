/**
 * Available LLM models via Vercel AI Gateway
 * https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway
 *
 * Model ID format: provider/model-name (e.g., "openai/gpt-5", "anthropic/claude-sonnet-4")
 *
 * To update available models, edit the WHITELISTED_MODELS array below.
 */

export interface ModelOption {
  id: string; // AI Gateway model ID (format: provider/model-name)
  provider: string; // Provider name for grouping
  name: string; // Display name
  description?: string; // Optional description
  contextWindow?: number; // Context window size
}

/**
 * ===========================================
 * WHITELISTED MODELS - Edit this list to update available models
 * ===========================================
 *
 * Available models from Vercel AI Gateway (as of Dec 2025)
 */
export const WHITELISTED_MODELS: ModelOption[] = [
  // ==================== Anthropic ====================
  {
    id: "anthropic/claude-opus-4.5",
    provider: "anthropic",
    name: "Claude Opus 4.5",
    description: "Most capable Claude model",
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    provider: "anthropic",
    name: "Claude Sonnet 4.5",
    description: "Best balance of speed and capability",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    provider: "anthropic",
    name: "Claude Haiku 4.5",
    description: "Fast and affordable",
  },

  // ==================== OpenAI ====================
  {
    id: "openai/gpt-5.2-pro",
    provider: "openai",
    name: "GPT-5.2 Pro",
    description: "Most capable GPT model",
  },
  {
    id: "openai/gpt-5.2",
    provider: "openai",
    name: "GPT-5.2",
    description: "Latest GPT-5 series",
  },
  {
    id: "openai/gpt-5.2-chat",
    provider: "openai",
    name: "GPT-5.2 Chat",
    description: "Optimized for chat",
  },
  {
    id: "openai/gpt-5.1-thinking",
    provider: "openai",
    name: "GPT-5.1 Thinking",
    description: "Advanced reasoning",
  },
  {
    id: "openai/gpt-5.1-instant",
    provider: "openai",
    name: "GPT-5.1 Instant",
    description: "Fast responses",
  },
  {
    id: "openai/gpt-5",
    provider: "openai",
    name: "GPT-5",
    description: "GPT-5 base model",
  },
  {
    id: "openai/gpt-5-chat",
    provider: "openai",
    name: "GPT-5 Chat",
    description: "GPT-5 chat optimized",
  },
  {
    id: "openai/gpt-5-mini",
    provider: "openai",
    name: "GPT-5 Mini",
    description: "Fast and affordable GPT-5",
  },
  {
    id: "openai/gpt-5-nano",
    provider: "openai",
    name: "GPT-5 Nano",
    description: "Ultra-fast GPT-5",
  },
  {
    id: "openai/gpt-4.1",
    provider: "openai",
    name: "GPT-4.1",
    description: "GPT-4.1 base model",
  },
  {
    id: "openai/gpt-4.1-mini",
    provider: "openai",
    name: "GPT-4.1 Mini",
    description: "Fast GPT-4.1",
  },
  {
    id: "openai/gpt-4.1-nano",
    provider: "openai",
    name: "GPT-4.1 Nano",
    description: "Ultra-fast GPT-4.1",
  },
  {
    id: "openai/gpt-4o",
    provider: "openai",
    name: "GPT-4o",
    description: "GPT-4 Omni multimodal",
  },
  {
    id: "openai/gpt-4o-mini",
    provider: "openai",
    name: "GPT-4o Mini",
    description: "Fast and very affordable",
  },
  // ==================== Google ====================
  {
    id: "google/gemini-3-pro-preview",
    provider: "google",
    name: "Gemini 3 Pro Preview",
    description: "Latest Gemini flagship",
  },
  {
    id: "google/gemini-3-pro-image",
    provider: "google",
    name: "Gemini 3 Pro Image",
    description: "Image generation",
  },
  {
    id: "google/gemini-2.5-pro",
    provider: "google",
    name: "Gemini 2.5 Pro",
    description: "Best for complex tasks",
  },
  {
    id: "google/gemini-2.5-flash",
    provider: "google",
    name: "Gemini 2.5 Flash",
    description: "Fast multimodal model",
  },
  {
    id: "google/gemini-2.5-flash-preview-09-2025",
    provider: "google",
    name: "Gemini 2.5 Flash Preview",
    description: "Latest Flash preview",
  },
  {
    id: "google/gemini-2.5-flash-lite",
    provider: "google",
    name: "Gemini 2.5 Flash Lite",
    description: "Ultra-fast and cheap",
  },
  {
    id: "google/gemini-2.5-flash-lite-preview-09-2025",
    provider: "google",
    name: "Gemini 2.5 Flash Lite Preview",
    description: "Latest Lite preview",
  },
  {
    id: "google/gemini-2.5-flash-image",
    provider: "google",
    name: "Gemini 2.5 Flash Image",
    description: "Image generation",
  },
  {
    id: "google/gemini-2.5-flash-image-preview",
    provider: "google",
    name: "Gemini 2.5 Flash Image Preview",
    description: "Image preview",
  },
  // ==================== xAI ====================
  {
    id: "xai/grok-4",
    provider: "xai",
    name: "Grok 4",
    description: "xAI flagship model",
  },
  {
    id: "xai/grok-4.1-fast-reasoning",
    provider: "xai",
    name: "Grok 4.1 Fast Reasoning",
    description: "Fast with reasoning",
  },
  {
    id: "xai/grok-4.1-fast-non-reasoning",
    provider: "xai",
    name: "Grok 4.1 Fast",
    description: "Ultra-fast Grok",
  },
  {
    id: "xai/grok-4-fast-reasoning",
    provider: "xai",
    name: "Grok 4 Fast Reasoning",
    description: "Fast reasoning mode",
  },
  {
    id: "xai/grok-4-fast-non-reasoning",
    provider: "xai",
    name: "Grok 4 Fast",
    description: "Fast non-reasoning",
  },
  {
    id: "xai/grok-code-fast-1",
    provider: "xai",
    name: "Grok Code Fast 1",
    description: "Optimized for coding",
  },
];

// Use whitelisted models as the available models
export const AVAILABLE_MODELS = WHITELISTED_MODELS;

// Group models by provider for dropdown display
export const MODELS_BY_PROVIDER = AVAILABLE_MODELS.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ModelOption[]>
);

// Provider display names
export const PROVIDER_NAMES: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  xai: "xAI",
};

// Default models for each panel position (one per provider)
export const DEFAULT_PANEL_MODELS: ModelOption[] = [
  AVAILABLE_MODELS.find((m) => m.id === "anthropic/claude-sonnet-4.5")!,
  AVAILABLE_MODELS.find((m) => m.id === "openai/gpt-5")!,
  AVAILABLE_MODELS.find((m) => m.id === "google/gemini-2.5-pro")!,
  AVAILABLE_MODELS.find((m) => m.id === "xai/grok-4")!,
];

// Layout configurations
export type LayoutType = "single" | "two-column" | "three-column" | "grid-2x2";

export const LAYOUT_CONFIGS: Record<LayoutType, { panels: number; gridCols: string }> = {
  single: { panels: 1, gridCols: "grid-cols-1" },
  "two-column": { panels: 2, gridCols: "grid-cols-2" },
  "three-column": { panels: 3, gridCols: "grid-cols-3" },
  "grid-2x2": { panels: 4, gridCols: "grid-cols-2" },
};
