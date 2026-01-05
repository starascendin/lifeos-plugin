import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";

// ==================== QUERIES ====================

/**
 * Get the user's currently active voice agent session
 */
export const getActiveSession = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("lifeos_voiceAgentSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .first();
  },
});

/**
 * Get recent voice agent sessions for history
 */
export const getRecentSessions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 20;

    return await ctx.db
      .query("lifeos_voiceAgentSessions")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get messages for a specific session
 */
export const getSessionMessages = query({
  args: {
    sessionId: v.id("lifeos_voiceAgentSessions"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify session belongs to user
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      return [];
    }

    return await ctx.db
      .query("lifeos_voiceAgentMessages")
      .withIndex("by_session_timestamp", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

/**
 * Get recent messages across all sessions (for loading history on connect)
 */
export const getRecentMessages = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 50;

    return await ctx.db
      .query("lifeos_voiceAgentMessages")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new voice agent session when connecting
 */
export const createSession = mutation({
  args: {
    roomName: v.string(),
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // End any existing active sessions
    const existingActive = await ctx.db
      .query("lifeos_voiceAgentSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .collect();

    for (const session of existingActive) {
      await ctx.db.patch(session._id, {
        status: "ended",
        endedAt: now,
        updatedAt: now,
      });
    }

    // Create new session
    const sessionId = await ctx.db.insert("lifeos_voiceAgentSessions", {
      userId: user._id,
      roomName: args.roomName,
      modelId: args.modelId,
      status: "active",
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return sessionId;
  },
});

/**
 * End a voice agent session when disconnecting
 */
export const endSession = mutation({
  args: {
    sessionId: v.id("lifeos_voiceAgentSessions"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found or access denied");
    }

    if (session.status === "ended") {
      return; // Already ended
    }

    await ctx.db.patch(args.sessionId, {
      status: "ended",
      endedAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Add a message (transcription) to the current session
 */
export const addMessage = mutation({
  args: {
    sessionId: v.id("lifeos_voiceAgentSessions"),
    sender: v.union(v.literal("user"), v.literal("agent")),
    text: v.string(),
    livekitMessageId: v.optional(v.string()),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Verify session belongs to user
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found or access denied");
    }

    // Check for duplicate by livekitMessageId
    if (args.livekitMessageId) {
      const existing = await ctx.db
        .query("lifeos_voiceAgentMessages")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .filter((q) =>
          q.eq(q.field("livekitMessageId"), args.livekitMessageId)
        )
        .first();

      if (existing) {
        return existing._id; // Return existing message ID
      }
    }

    const messageId = await ctx.db.insert("lifeos_voiceAgentMessages", {
      userId: user._id,
      sessionId: args.sessionId,
      sender: args.sender,
      text: args.text,
      livekitMessageId: args.livekitMessageId,
      timestamp: args.timestamp,
      createdAt: now,
    });

    return messageId;
  },
});

/**
 * End all active sessions for user (cleanup on app close)
 */
export const endAllActiveSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const activeSessions = await ctx.db
      .query("lifeos_voiceAgentSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .collect();

    for (const session of activeSessions) {
      await ctx.db.patch(session._id, {
        status: "ended",
        endedAt: now,
        updatedAt: now,
      });
    }

    return activeSessions.length;
  },
});
