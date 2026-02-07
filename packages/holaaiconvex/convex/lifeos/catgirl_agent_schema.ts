import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * CatGirl Agent Tables
 *
 * Tables for tracking AI agent usage and sessions.
 * All table names are prefixed with `lifeos_catgirlAgent` to avoid conflicts.
 */

/**
 * Token usage validator matching AI SDK usage structure
 */
export const vCatgirlTokenUsage = v.object({
  promptTokens: v.number(),
  completionTokens: v.number(),
  totalTokens: v.number(),
});

export const catgirlAgentTables = {
  // ==================== CATGIRL AGENT USAGE ====================
  /**
   * Tracks token usage for each AI agent call.
   * Used for billing, analytics, and monitoring.
   */
  lifeos_catgirlAgentUsage: defineTable({
    // Thread ID from the agent
    threadId: v.string(),
    // User ID (Convex user ID)
    userId: v.id("users"),
    // Agent name
    agentName: v.string(),
    // Model used (e.g., "google/gemini-3-flash")
    model: v.string(),
    // Provider name (e.g., "openai", "google")
    provider: v.string(),
    // Token usage
    usage: vCatgirlTokenUsage,
    // Optional provider-specific metadata
    providerMetadata: v.optional(v.any()),
    // Timestamp
    createdAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_thread_created", ["threadId", "createdAt"])
    .index("by_model", ["model"])
    .index("by_created", ["createdAt"]),

  // ==================== CATGIRL AGENT THREADS ====================
  /**
   * Maps threads to users for ownership validation.
   */
  lifeos_catgirlAgentThreads: defineTable({
    // Thread ID from the agent
    threadId: v.string(),
    // User ID who owns this thread
    userId: v.id("users"),
    // Timestamp
    createdAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_user", ["userId"]),
};
