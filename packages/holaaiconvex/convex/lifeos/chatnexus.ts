import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc, Id } from "../_generated/dataModel";

// ==================== VALIDATORS ====================

const panelConfigValidator = v.object({
  panelId: v.string(),
  modelId: v.string(),
  modelProvider: v.string(),
  modelDisplayName: v.string(),
  position: v.number(),
  isActive: v.boolean(),
});

const layoutTypeValidator = v.union(
  v.literal("single"),
  v.literal("two-column"),
  v.literal("three-column"),
  v.literal("grid-2x2")
);

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
        .query("lifeos_chatnexusConversations")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(limit);
    } else {
      conversations = await ctx.db
        .query("lifeos_chatnexusConversations")
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
    conversationId: v.id("lifeos_chatnexusConversations"),
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
    conversationId: v.id("lifeos_chatnexusConversations"),
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
      .query("lifeos_chatnexusMessages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .take(limit);

    return messages;
  },
});

/**
 * Get messages by broadcast ID (for grouping user message with responses)
 */
export const getMessagesByBroadcast = query({
  args: {
    broadcastId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const messages = await ctx.db
      .query("lifeos_chatnexusMessages")
      .withIndex("by_broadcast", (q) => q.eq("broadcastId", args.broadcastId))
      .collect();

    // Filter to only user's messages
    return messages.filter((m) => m.userId === user._id);
  },
});

/**
 * Get user's model presets
 */
export const getModelPresets = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("lifeos_chatnexusModelPresets")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

/**
 * Get the default preset for the user
 */
export const getDefaultPreset = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("lifeos_chatnexusModelPresets")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", user._id).eq("isDefault", true)
      )
      .first();
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new conversation
 */
export const createConversation = mutation({
  args: {
    title: v.optional(v.string()),
    layoutType: layoutTypeValidator,
    panelConfigs: v.array(panelConfigValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const conversationId = await ctx.db.insert("lifeos_chatnexusConversations", {
      userId: user._id,
      title: args.title ?? "New Chat",
      layoutType: args.layoutType,
      panelConfigs: args.panelConfigs,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    return conversationId;
  },
});

/**
 * Update a conversation (title, layout, panel configs)
 */
export const updateConversation = mutation({
  args: {
    conversationId: v.id("lifeos_chatnexusConversations"),
    title: v.optional(v.string()),
    layoutType: v.optional(layoutTypeValidator),
    panelConfigs: v.optional(v.array(panelConfigValidator)),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found or access denied");
    }

    const updates: Partial<Doc<"lifeos_chatnexusConversations">> = {
      updatedAt: now,
    };

    if (args.title !== undefined) updates.title = args.title;
    if (args.layoutType !== undefined) updates.layoutType = args.layoutType;
    if (args.panelConfigs !== undefined) updates.panelConfigs = args.panelConfigs;

    await ctx.db.patch(args.conversationId, updates);
    return args.conversationId;
  },
});

/**
 * Archive a conversation (soft delete)
 */
export const archiveConversation = mutation({
  args: {
    conversationId: v.id("lifeos_chatnexusConversations"),
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
    conversationId: v.id("lifeos_chatnexusConversations"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found or access denied");
    }

    // Delete all messages in the conversation
    const messages = await ctx.db
      .query("lifeos_chatnexusMessages")
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
 * Add a user message to a conversation
 * Returns the broadcastId for tracking responses
 */
export const addUserMessage = mutation({
  args: {
    conversationId: v.id("lifeos_chatnexusConversations"),
    content: v.string(),
    broadcastId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Verify user owns the conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found or access denied");
    }

    // Create the user message
    const messageId = await ctx.db.insert("lifeos_chatnexusMessages", {
      userId: user._id,
      conversationId: args.conversationId,
      role: "user",
      content: args.content,
      broadcastId: args.broadcastId,
      isComplete: true,
      createdAt: now,
    });

    // Update conversation's updatedAt
    await ctx.db.patch(args.conversationId, { updatedAt: now });

    // Auto-generate title from first message if title is "New Chat"
    if (conversation.title === "New Chat") {
      const title = args.content.slice(0, 50) + (args.content.length > 50 ? "..." : "");
      await ctx.db.patch(args.conversationId, { title });
    }

    return { messageId, broadcastId: args.broadcastId };
  },
});

/**
 * Add or update an assistant message (used during streaming)
 */
export const upsertAssistantMessage = mutation({
  args: {
    conversationId: v.id("lifeos_chatnexusConversations"),
    panelId: v.string(),
    modelId: v.string(),
    modelProvider: v.string(),
    broadcastId: v.string(),
    content: v.string(),
    isComplete: v.boolean(),
    error: v.optional(v.string()),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Verify user owns the conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found or access denied");
    }

    // Check if message already exists for this panel+broadcast
    const existing = await ctx.db
      .query("lifeos_chatnexusMessages")
      .withIndex("by_broadcast", (q) => q.eq("broadcastId", args.broadcastId))
      .filter((q) => q.eq(q.field("panelId"), args.panelId))
      .first();

    if (existing) {
      // Update existing message
      await ctx.db.patch(existing._id, {
        content: args.content,
        isComplete: args.isComplete,
        error: args.error,
        promptTokens: args.promptTokens,
        completionTokens: args.completionTokens,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new assistant message
    return await ctx.db.insert("lifeos_chatnexusMessages", {
      userId: user._id,
      conversationId: args.conversationId,
      role: "assistant",
      content: args.content,
      panelId: args.panelId,
      modelId: args.modelId,
      modelProvider: args.modelProvider,
      broadcastId: args.broadcastId,
      isComplete: args.isComplete,
      error: args.error,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      createdAt: now,
    });
  },
});

/**
 * Save a model preset
 */
export const saveModelPreset = mutation({
  args: {
    name: v.string(),
    layoutType: layoutTypeValidator,
    panelConfigs: v.array(
      v.object({
        modelId: v.string(),
        modelProvider: v.string(),
        modelDisplayName: v.string(),
        position: v.number(),
      })
    ),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // If setting as default, unset any existing default
    if (args.isDefault) {
      const existingDefault = await ctx.db
        .query("lifeos_chatnexusModelPresets")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", user._id).eq("isDefault", true)
        )
        .first();

      if (existingDefault) {
        await ctx.db.patch(existingDefault._id, { isDefault: false });
      }
    }

    return await ctx.db.insert("lifeos_chatnexusModelPresets", {
      userId: user._id,
      name: args.name,
      layoutType: args.layoutType,
      panelConfigs: args.panelConfigs,
      isDefault: args.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update a model preset
 */
export const updateModelPreset = mutation({
  args: {
    presetId: v.id("lifeos_chatnexusModelPresets"),
    name: v.optional(v.string()),
    layoutType: v.optional(layoutTypeValidator),
    panelConfigs: v.optional(
      v.array(
        v.object({
          modelId: v.string(),
          modelProvider: v.string(),
          modelDisplayName: v.string(),
          position: v.number(),
        })
      )
    ),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const preset = await ctx.db.get(args.presetId);
    if (!preset || preset.userId !== user._id) {
      throw new Error("Preset not found or access denied");
    }

    // If setting as default, unset any existing default
    if (args.isDefault) {
      const existingDefault = await ctx.db
        .query("lifeos_chatnexusModelPresets")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", user._id).eq("isDefault", true)
        )
        .first();

      if (existingDefault && existingDefault._id !== args.presetId) {
        await ctx.db.patch(existingDefault._id, { isDefault: false });
      }
    }

    const updates: Partial<Doc<"lifeos_chatnexusModelPresets">> = {
      updatedAt: now,
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.layoutType !== undefined) updates.layoutType = args.layoutType;
    if (args.panelConfigs !== undefined) updates.panelConfigs = args.panelConfigs;
    if (args.isDefault !== undefined) updates.isDefault = args.isDefault;

    await ctx.db.patch(args.presetId, updates);
    return args.presetId;
  },
});

/**
 * Delete a model preset
 */
export const deleteModelPreset = mutation({
  args: {
    presetId: v.id("lifeos_chatnexusModelPresets"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const preset = await ctx.db.get(args.presetId);
    if (!preset || preset.userId !== user._id) {
      throw new Error("Preset not found or access denied");
    }

    await ctx.db.delete(args.presetId);
  },
});

// ==================== INTERNAL FUNCTIONS ====================
// These are called by HTTP actions and are not exposed to clients

/**
 * Internal: Get messages for building conversation history
 */
export const getMessagesInternal = internalQuery({
  args: {
    conversationId: v.id("lifeos_chatnexusConversations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lifeos_chatnexusMessages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
  },
});

/**
 * Internal: Get conversation by ID
 */
export const getConversationInternal = internalQuery({
  args: {
    conversationId: v.id("lifeos_chatnexusConversations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
  },
});

/**
 * Internal: Add user message (from HTTP action)
 */
export const addUserMessageInternal = internalMutation({
  args: {
    userId: v.id("users"),
    conversationId: v.id("lifeos_chatnexusConversations"),
    content: v.string(),
    broadcastId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const messageId = await ctx.db.insert("lifeos_chatnexusMessages", {
      userId: args.userId,
      conversationId: args.conversationId,
      role: "user",
      content: args.content,
      broadcastId: args.broadcastId,
      isComplete: true,
      createdAt: now,
    });

    // Update conversation's updatedAt
    await ctx.db.patch(args.conversationId, { updatedAt: now });

    return messageId;
  },
});

/**
 * Internal: Upsert assistant message (from HTTP action during streaming)
 */
export const upsertAssistantMessageInternal = internalMutation({
  args: {
    userId: v.id("users"),
    conversationId: v.id("lifeos_chatnexusConversations"),
    panelId: v.string(),
    modelId: v.string(),
    modelProvider: v.string(),
    broadcastId: v.string(),
    content: v.string(),
    isComplete: v.boolean(),
    error: v.optional(v.string()),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if message already exists for this panel+broadcast
    const existing = await ctx.db
      .query("lifeos_chatnexusMessages")
      .withIndex("by_broadcast", (q) => q.eq("broadcastId", args.broadcastId))
      .filter((q) => q.eq(q.field("panelId"), args.panelId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        isComplete: args.isComplete,
        error: args.error,
        promptTokens: args.promptTokens,
        completionTokens: args.completionTokens,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("lifeos_chatnexusMessages", {
      userId: args.userId,
      conversationId: args.conversationId,
      role: "assistant",
      content: args.content,
      panelId: args.panelId,
      modelId: args.modelId,
      modelProvider: args.modelProvider,
      broadcastId: args.broadcastId,
      isComplete: args.isComplete,
      error: args.error,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      createdAt: now,
    });
  },
});
