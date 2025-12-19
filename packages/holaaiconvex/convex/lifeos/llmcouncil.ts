import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc, Id } from "../_generated/dataModel";

// ==================== VALIDATORS ====================

const modelConfigValidator = v.object({
  modelId: v.string(),
  modelName: v.string(),
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
  evaluation: v.string(),
  parsedRanking: v.optional(v.array(v.string())),
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

const providerTierConfigValidator = v.object({
  mini: v.union(v.string(), v.null()),
  normal: v.union(v.string(), v.null()),
  pro: v.union(v.string(), v.null()),
});

const tierConfigValidator = v.record(v.string(), providerTierConfigValidator);

// ==================== DEFAULT COUNCIL CONFIGURATION ====================

export const DEFAULT_COUNCIL_MODELS = [
  { modelId: "openai/gpt-4o", modelName: "GPT-4o" },
  { modelId: "anthropic/claude-sonnet-4", modelName: "Claude Sonnet 4" },
  { modelId: "google/gemini-2.5-pro-preview", modelName: "Gemini 2.5 Pro" },
  { modelId: "x-ai/grok-3", modelName: "Grok 3" },
];

export const DEFAULT_CHAIRMAN_MODEL = {
  modelId: "google/gemini-2.5-pro-preview",
  modelName: "Gemini 2.5 Pro",
};

// ==================== QUERIES ====================

/**
 * Get all conversations for the authenticated user
 * Returns conversations sorted by updatedAt (most recent first)
 */
export const getConversations = query({
  args: {
    includeArchived: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 50;

    let conversations;
    if (args.includeArchived) {
      conversations = await ctx.db
        .query("lifeos_llmcouncilConversations")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(limit);
    } else {
      conversations = await ctx.db
        .query("lifeos_llmcouncilConversations")
        .withIndex("by_user_archived", (q) =>
          q.eq("userId", user._id).eq("isArchived", false)
        )
        .order("desc")
        .take(limit);
    }

    return conversations;
  },
});

/**
 * Get a single conversation by ID
 */
export const getConversation = query({
  args: {
    conversationId: v.id("lifeos_llmcouncilConversations"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      return null;
    }

    return conversation;
  },
});

/**
 * Get messages for a conversation
 * Returns messages sorted by createdAt (oldest first for chat display)
 */
export const getMessages = query({
  args: {
    conversationId: v.id("lifeos_llmcouncilConversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 100;

    // Verify user owns the conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found or access denied");
    }

    const messages = await ctx.db
      .query("lifeos_llmcouncilMessages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .take(limit);

    return messages;
  },
});

/**
 * Get user's LLM Council settings
 */
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const settings = await ctx.db
      .query("lifeos_llmcouncilSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Return defaults if no settings exist
    if (!settings) {
      return {
        defaultCouncilModels: DEFAULT_COUNCIL_MODELS,
        defaultChairmanModel: DEFAULT_CHAIRMAN_MODEL,
        tierConfig: null,
        chairmanProvider: "google",
        chairmanModelId: null,
      };
    }

    return {
      ...settings,
      tierConfig: settings.tierConfig ?? null,
      chairmanProvider: settings.chairmanProvider ?? "google",
      chairmanModelId: settings.chairmanModelId ?? null,
    };
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new conversation
 */
export const createConversation = mutation({
  args: {
    title: v.optional(v.string()),
    councilModels: v.optional(v.array(modelConfigValidator)),
    chairmanModel: v.optional(modelConfigValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Get user settings for defaults
    const settings = await ctx.db
      .query("lifeos_llmcouncilSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const councilModels =
      args.councilModels ??
      settings?.defaultCouncilModels ??
      DEFAULT_COUNCIL_MODELS;
    const chairmanModel =
      args.chairmanModel ??
      settings?.defaultChairmanModel ??
      DEFAULT_CHAIRMAN_MODEL;

    const conversationId = await ctx.db.insert("lifeos_llmcouncilConversations", {
      userId: user._id,
      title: args.title ?? "New Council",
      councilModels,
      chairmanModel,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    return conversationId;
  },
});

/**
 * Update a conversation (title, council models, chairman)
 */
export const updateConversation = mutation({
  args: {
    conversationId: v.id("lifeos_llmcouncilConversations"),
    title: v.optional(v.string()),
    councilModels: v.optional(v.array(modelConfigValidator)),
    chairmanModel: v.optional(modelConfigValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found or access denied");
    }

    const updates: Partial<Doc<"lifeos_llmcouncilConversations">> = {
      updatedAt: now,
    };

    if (args.title !== undefined) updates.title = args.title;
    if (args.councilModels !== undefined) updates.councilModels = args.councilModels;
    if (args.chairmanModel !== undefined) updates.chairmanModel = args.chairmanModel;

    await ctx.db.patch(args.conversationId, updates);
    return args.conversationId;
  },
});

/**
 * Archive a conversation (soft delete)
 */
export const archiveConversation = mutation({
  args: {
    conversationId: v.id("lifeos_llmcouncilConversations"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found or access denied");
    }

    await ctx.db.patch(args.conversationId, {
      isArchived: true,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Permanently delete a conversation and all its messages
 */
export const deleteConversation = mutation({
  args: {
    conversationId: v.id("lifeos_llmcouncilConversations"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found or access denied");
    }

    // Delete all messages in the conversation
    const messages = await ctx.db
      .query("lifeos_llmcouncilMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the conversation
    await ctx.db.delete(args.conversationId);
  },
});

/**
 * Add a user query to a conversation
 * Returns the queryId for tracking the deliberation response
 */
export const addQuery = mutation({
  args: {
    conversationId: v.id("lifeos_llmcouncilConversations"),
    query: v.string(),
    queryId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Verify user owns the conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found or access denied");
    }

    // Create the user query message
    const messageId = await ctx.db.insert("lifeos_llmcouncilMessages", {
      userId: user._id,
      conversationId: args.conversationId,
      type: "query",
      queryId: args.queryId,
      userQuery: args.query,
      isComplete: true,
      createdAt: now,
    });

    // Update conversation's updatedAt
    await ctx.db.patch(args.conversationId, { updatedAt: now });

    // Auto-generate title from first query if title is "New Council"
    if (conversation.title === "New Council") {
      const title = args.query.slice(0, 50) + (args.query.length > 50 ? "..." : "");
      await ctx.db.patch(args.conversationId, { title });
    }

    return { messageId, queryId: args.queryId };
  },
});

/**
 * Update user settings
 */
export const updateSettings = mutation({
  args: {
    defaultCouncilModels: v.optional(v.array(modelConfigValidator)),
    defaultChairmanModel: v.optional(modelConfigValidator),
    tierConfig: v.optional(tierConfigValidator),
    chairmanProvider: v.optional(v.string()),
    chairmanModelId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("lifeos_llmcouncilSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      const updates: Partial<Doc<"lifeos_llmcouncilSettings">> = {
        updatedAt: now,
      };

      if (args.defaultCouncilModels !== undefined) {
        updates.defaultCouncilModels = args.defaultCouncilModels;
      }
      if (args.defaultChairmanModel !== undefined) {
        updates.defaultChairmanModel = args.defaultChairmanModel;
      }
      if (args.tierConfig !== undefined) {
        updates.tierConfig = args.tierConfig;
      }
      if (args.chairmanProvider !== undefined) {
        updates.chairmanProvider = args.chairmanProvider;
      }
      if (args.chairmanModelId !== undefined) {
        updates.chairmanModelId = args.chairmanModelId;
      }

      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    // Create new settings
    return await ctx.db.insert("lifeos_llmcouncilSettings", {
      userId: user._id,
      tierConfig: args.tierConfig,
      chairmanProvider: args.chairmanProvider ?? "google",
      chairmanModelId: args.chairmanModelId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ==================== INTERNAL FUNCTIONS ====================
// These are called by HTTP actions and are not exposed to clients

/**
 * Internal: Get conversation by ID
 */
export const getConversationInternal = internalQuery({
  args: {
    conversationId: v.id("lifeos_llmcouncilConversations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
  },
});

/**
 * Internal: Get messages for building conversation history
 */
export const getMessagesInternal = internalQuery({
  args: {
    conversationId: v.id("lifeos_llmcouncilConversations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lifeos_llmcouncilMessages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
  },
});

/**
 * Internal: Add user query (from HTTP action)
 */
export const addQueryInternal = internalMutation({
  args: {
    userId: v.id("users"),
    conversationId: v.id("lifeos_llmcouncilConversations"),
    query: v.string(),
    queryId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const messageId = await ctx.db.insert("lifeos_llmcouncilMessages", {
      userId: args.userId,
      conversationId: args.conversationId,
      type: "query",
      queryId: args.queryId,
      userQuery: args.query,
      isComplete: true,
      createdAt: now,
    });

    // Update conversation's updatedAt
    await ctx.db.patch(args.conversationId, { updatedAt: now });

    return messageId;
  },
});

/**
 * Internal: Create deliberation message placeholder
 */
export const createDeliberationInternal = internalMutation({
  args: {
    userId: v.id("users"),
    conversationId: v.id("lifeos_llmcouncilConversations"),
    queryId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("lifeos_llmcouncilMessages", {
      userId: args.userId,
      conversationId: args.conversationId,
      type: "deliberation",
      queryId: args.queryId,
      stage1Responses: [],
      stage1Complete: false,
      stage2Evaluations: [],
      stage2Complete: false,
      stage3Complete: false,
      isComplete: false,
      createdAt: now,
    });
  },
});

/**
 * Internal: Update stage 1 response for a model
 */
export const updateStage1Internal = internalMutation({
  args: {
    messageId: v.id("lifeos_llmcouncilMessages"),
    modelId: v.string(),
    modelName: v.string(),
    response: v.string(),
    isComplete: v.boolean(),
    error: v.optional(v.string()),
    stage1Complete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    const existingResponses = message.stage1Responses ?? [];
    const existingIndex = existingResponses.findIndex(
      (r) => r.modelId === args.modelId
    );

    const newResponse = {
      modelId: args.modelId,
      modelName: args.modelName,
      response: args.response,
      isComplete: args.isComplete,
      error: args.error,
    };

    let updatedResponses;
    if (existingIndex >= 0) {
      updatedResponses = [...existingResponses];
      updatedResponses[existingIndex] = newResponse;
    } else {
      updatedResponses = [...existingResponses, newResponse];
    }

    const updates: Partial<Doc<"lifeos_llmcouncilMessages">> = {
      stage1Responses: updatedResponses,
      updatedAt: now,
    };

    if (args.stage1Complete !== undefined) {
      updates.stage1Complete = args.stage1Complete;
    }

    await ctx.db.patch(args.messageId, updates);
  },
});

/**
 * Internal: Update stage 2 evaluation for a model
 */
export const updateStage2Internal = internalMutation({
  args: {
    messageId: v.id("lifeos_llmcouncilMessages"),
    evaluatorModelId: v.string(),
    evaluatorModelName: v.string(),
    evaluation: v.string(),
    parsedRanking: v.optional(v.array(v.string())),
    isComplete: v.boolean(),
    error: v.optional(v.string()),
    stage2Complete: v.optional(v.boolean()),
    labelToModel: v.optional(v.record(v.string(), v.string())),
    aggregateRankings: v.optional(v.array(aggregateRankingValidator)),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    const existingEvaluations = message.stage2Evaluations ?? [];
    const existingIndex = existingEvaluations.findIndex(
      (e) => e.evaluatorModelId === args.evaluatorModelId
    );

    const newEvaluation = {
      evaluatorModelId: args.evaluatorModelId,
      evaluatorModelName: args.evaluatorModelName,
      evaluation: args.evaluation,
      parsedRanking: args.parsedRanking,
      isComplete: args.isComplete,
      error: args.error,
    };

    let updatedEvaluations;
    if (existingIndex >= 0) {
      updatedEvaluations = [...existingEvaluations];
      updatedEvaluations[existingIndex] = newEvaluation;
    } else {
      updatedEvaluations = [...existingEvaluations, newEvaluation];
    }

    const updates: Partial<Doc<"lifeos_llmcouncilMessages">> = {
      stage2Evaluations: updatedEvaluations,
      updatedAt: now,
    };

    if (args.stage2Complete !== undefined) {
      updates.stage2Complete = args.stage2Complete;
    }
    if (args.labelToModel !== undefined) {
      updates.labelToModel = args.labelToModel;
    }
    if (args.aggregateRankings !== undefined) {
      updates.aggregateRankings = args.aggregateRankings;
    }

    await ctx.db.patch(args.messageId, updates);
  },
});

/**
 * Internal: Update stage 3 response
 */
export const updateStage3Internal = internalMutation({
  args: {
    messageId: v.id("lifeos_llmcouncilMessages"),
    modelId: v.string(),
    modelName: v.string(),
    response: v.string(),
    isComplete: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const updates: Partial<Doc<"lifeos_llmcouncilMessages">> = {
      stage3Response: {
        modelId: args.modelId,
        modelName: args.modelName,
        response: args.response,
        isComplete: args.isComplete,
        error: args.error,
      },
      stage3Complete: args.isComplete,
      updatedAt: now,
    };

    if (args.isComplete && !args.error) {
      updates.isComplete = true;
    }

    await ctx.db.patch(args.messageId, updates);
  },
});

/**
 * Internal: Mark deliberation as complete
 */
export const completeDeliberationInternal = internalMutation({
  args: {
    messageId: v.id("lifeos_llmcouncilMessages"),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.messageId, {
      isComplete: true,
      error: args.error,
      updatedAt: now,
    });
  },
});
