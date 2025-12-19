import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * LLM Council Tables
 *
 * Multi-model deliberation feature for LifeOS.
 * Implements a 3-stage process: individual responses, peer ranking, chairman synthesis.
 * All table names are prefixed with `lifeos_llmcouncil` to follow domain conventions.
 */

// Shared validators for reuse
const modelConfigValidator = v.object({
  modelId: v.string(), //  model ID (e.g., "openai/gpt-4o")
  modelName: v.string(), // Display name (e.g., "GPT-4o")
});

const stage1ResponseValidator = v.object({
  modelId: v.string(),
  modelName: v.string(),
  response: v.string(),
  isComplete: v.boolean(),
  error: v.optional(v.string()),
});

const stage2EvaluationValidator = v.object({
  evaluatorModelId: v.string(),
  evaluatorModelName: v.string(),
  evaluation: v.string(), // Full evaluation text
  parsedRanking: v.optional(v.array(v.string())), // Parsed ranking order (model IDs)
  isComplete: v.boolean(),
  error: v.optional(v.string()),
});

const stage3ResponseValidator = v.object({
  modelId: v.string(),
  modelName: v.string(),
  response: v.string(),
  isComplete: v.boolean(),
  error: v.optional(v.string()),
});

const aggregateRankingValidator = v.object({
  modelId: v.string(),
  modelName: v.string(),
  averageRank: v.number(),
  rankingsCount: v.number(),
});

export const llmcouncilTables = {
  // ==================== CONVERSATIONS ====================
  lifeos_llmcouncilConversations: defineTable({
    // User who owns this conversation
    userId: v.id("users"),
    // Conversation title (auto-generated or user-edited)
    title: v.string(),
    // Council member models for this conversation
    councilModels: v.array(modelConfigValidator),
    // Chairman model for synthesis
    chairmanModel: modelConfigValidator,
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
  lifeos_llmcouncilMessages: defineTable({
    // User who owns this message
    userId: v.id("users"),
    // Parent conversation
    conversationId: v.id("lifeos_llmcouncilConversations"),
    // Message type: user query or council response
    type: v.union(v.literal("query"), v.literal("deliberation")),
    // Unique ID to group query with its deliberation response
    queryId: v.string(),

    // For query type: user's question
    userQuery: v.optional(v.string()),

    // For deliberation type: all stage results
    // Stage 1: Individual responses from each council member
    stage1Responses: v.optional(v.array(stage1ResponseValidator)),
    stage1Complete: v.optional(v.boolean()),

    // Stage 2: Peer evaluations and rankings
    stage2Evaluations: v.optional(v.array(stage2EvaluationValidator)),
    stage2Complete: v.optional(v.boolean()),
    // Mapping of anonymous labels to model IDs (e.g., {"Response A": "openai/gpt-4o"})
    labelToModel: v.optional(v.record(v.string(), v.string())),
    // Aggregate rankings computed from all evaluations
    aggregateRankings: v.optional(v.array(aggregateRankingValidator)),

    // Stage 3: Chairman's synthesized final answer
    stage3Response: v.optional(stage3ResponseValidator),
    stage3Complete: v.optional(v.boolean()),

    // Overall completion status
    isComplete: v.boolean(),
    // Error at the conversation level (e.g., all models failed)
    error: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user_conversation", ["userId", "conversationId"])
    .index("by_query_id", ["queryId"])
    .index("by_conversation_created", ["conversationId", "createdAt"]),

  // ==================== USER SETTINGS ====================
  lifeos_llmcouncilSettings: defineTable({
    // User who owns these settings
    userId: v.id("users"),
    // Default council members (legacy, kept for backwards compatibility)
    defaultCouncilModels: v.optional(v.array(modelConfigValidator)),
    // Default chairman model (legacy, kept for backwards compatibility)
    defaultChairmanModel: v.optional(modelConfigValidator),
    // Custom tier configuration: provider -> { mini, normal, pro } -> modelId
    // e.g., { "anthropic": { "mini": "anthropic/claude-haiku-4.5", ... }, ... }
    tierConfig: v.optional(
      v.record(
        v.string(), // provider
        v.object({
          mini: v.union(v.string(), v.null()),
          normal: v.union(v.string(), v.null()),
          pro: v.union(v.string(), v.null()),
        })
      )
    ),
    // Default chairman provider (which provider's model to use as chairman) - legacy
    chairmanProvider: v.optional(v.string()),
    // Specific chairman model ID (overrides chairmanProvider if set)
    chairmanModelId: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
};
