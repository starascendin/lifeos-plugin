import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Chat Nexus Tables
 *
 * Multi-panel LLM chat feature for LifeOS.
 * Allows users to query multiple LLMs simultaneously and compare responses.
 * All table names are prefixed with `lifeos_chatnexus` to follow domain conventions.
 */

// Shared validators for reuse
const panelConfigValidator = v.object({
  panelId: v.string(), // UUID for panel
  modelId: v.string(), //  model ID (e.g., "openai/gpt-4o")
  modelProvider: v.string(), // Provider name (e.g., "openai", "anthropic")
  modelDisplayName: v.string(), // Display name (e.g., "GPT-4o")
  position: v.number(), // Panel position (0-3)
  isActive: v.boolean(), // Whether panel is active
});

const layoutTypeValidator = v.union(
  v.literal("single"),
  v.literal("two-column"),
  v.literal("three-column"),
  v.literal("grid-2x2")
);

export const chatnexusTables = {
  // ==================== CONVERSATIONS ====================
  lifeos_chatnexusConversations: defineTable({
    // User who owns this conversation
    userId: v.id("users"),
    // Conversation title (auto-generated or user-edited)
    title: v.string(),
    // Layout type determining panel arrangement
    layoutType: layoutTypeValidator,
    // Configuration for each panel
    panelConfigs: v.array(panelConfigValidator),
    // Soft delete flag
    isArchived: v.boolean(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"])
    .index("by_user_archived", ["userId", "isArchived"]),

  // ==================== MESSAGES ====================
  lifeos_chatnexusMessages: defineTable({
    // User who owns this message
    userId: v.id("users"),
    // Parent conversation
    conversationId: v.id("lifeos_chatnexusConversations"),
    // Message role
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    // Message content
    content: v.string(),
    // For assistant messages: which panel generated this response
    panelId: v.optional(v.string()),
    // Model used for this response
    modelId: v.optional(v.string()),
    modelProvider: v.optional(v.string()),
    // Broadcast ID groups user messages with their panel responses
    // When user sends a message, all panels respond with the same broadcastId
    broadcastId: v.optional(v.string()),
    // Whether the response is complete (for streaming)
    isComplete: v.boolean(),
    // Token usage (if provided by model)
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    // Error message if generation failed
    error: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user_conversation", ["userId", "conversationId"])
    .index("by_broadcast", ["broadcastId"])
    .index("by_conversation_created", ["conversationId", "createdAt"]),

  // ==================== MODEL PRESETS ====================
  lifeos_chatnexusModelPresets: defineTable({
    // User who owns this preset
    userId: v.id("users"),
    // Preset name (e.g., "Compare All", "Claude vs GPT")
    name: v.string(),
    // Layout configuration
    layoutType: layoutTypeValidator,
    // Panel configurations for this preset
    panelConfigs: v.array(
      v.object({
        modelId: v.string(),
        modelProvider: v.string(),
        modelDisplayName: v.string(),
        position: v.number(),
      })
    ),
    // Whether this is the user's default preset
    isDefault: v.boolean(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_default", ["userId", "isDefault"]),
};
