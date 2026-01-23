import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc } from "../_generated/dataModel";
import { beeperThreadTypeValidator } from "./beeper_schema";

// ==================== QUERIES ====================

/**
 * Get all business-marked threads for the authenticated user
 */
export const getBusinessThreads = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_business", (q) =>
        q.eq("userId", user._id).eq("isBusinessChat", true)
      )
      .order("desc")
      .collect();
  },
});

/**
 * Get all synced threads (both business and non-business)
 */
export const getAllThreads = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

/**
 * Get a single thread by ID
 */
export const getThread = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .unique();
  },
});

/**
 * Get all synced thread IDs (for deduplication check)
 */
export const getSyncedThreadIds = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const threads = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return threads.map((t) => t.threadId);
  },
});

/**
 * Get messages for a specific thread
 */
export const getThreadMessages = query({
  args: {
    threadId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 100;

    return await ctx.db
      .query("lifeos_beeperMessages")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .order("desc")
      .take(limit);
  },
});

/**
 * Get synced message IDs for a thread (for deduplication check)
 */
export const getSyncedMessageIds = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const messages = await ctx.db
      .query("lifeos_beeperMessages")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .collect();

    return messages.map((m) => m.messageId);
  },
});

/**
 * Search messages across all synced threads
 */
export const searchMessages = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 50;

    const results = await ctx.db
      .query("lifeos_beeperMessages")
      .withSearchIndex("search_text", (q) =>
        q.search("text", args.query).eq("userId", user._id)
      )
      .take(limit);

    return results;
  },
});

/**
 * Get threads linked to a specific person
 */
export const getThreadsForPerson = query({
  args: {
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const threads = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_linkedPerson", (q) => q.eq("linkedPersonId", args.personId))
      .collect();

    // Filter by user (since linkedPerson index doesn't include userId)
    return threads.filter((t) => t.userId === user._id);
  },
});

// ==================== MUTATIONS ====================

/**
 * Mark a thread as business (or unmark)
 */
export const markThreadAsBusiness = mutation({
  args: {
    threadId: v.string(),
    isBusinessChat: v.boolean(),
    businessNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Find existing thread
    const existing = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .unique();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        isBusinessChat: args.isBusinessChat,
        businessNote: args.businessNote,
        updatedAt: now,
      });
      return existing._id;
    }

    // Thread doesn't exist in Convex yet - return null
    // (caller should upsert the thread first)
    return null;
  },
});

/**
 * Link a thread to a person (for DM business chats)
 */
export const linkThreadToPerson = mutation({
  args: {
    threadId: v.string(),
    personId: v.optional(v.id("lifeos_frmPeople")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Find existing thread
    const existing = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .unique();

    if (!existing) {
      throw new Error("Thread not found. Sync the thread first.");
    }

    // If personId provided, verify it belongs to user
    if (args.personId) {
      const person = await ctx.db.get(args.personId);
      if (!person || person.userId !== user._id) {
        throw new Error("Person not found or access denied");
      }
    }

    await ctx.db.patch(existing._id, {
      linkedPersonId: args.personId,
      updatedAt: now,
    });

    return existing._id;
  },
});

/**
 * Upsert a single thread (create or update based on threadId)
 */
export const upsertThread = mutation({
  args: {
    threadId: v.string(),
    threadName: v.string(),
    threadType: beeperThreadTypeValidator,
    participantCount: v.number(),
    messageCount: v.number(),
    lastMessageAt: v.number(),
    isBusinessChat: v.boolean(),
    businessNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Check if thread already exists
    const existing = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .unique();

    if (existing) {
      // Update existing thread
      await ctx.db.patch(existing._id, {
        threadName: args.threadName,
        threadType: args.threadType,
        participantCount: args.participantCount,
        messageCount: args.messageCount,
        lastMessageAt: args.lastMessageAt,
        isBusinessChat: args.isBusinessChat,
        businessNote: args.businessNote,
        lastSyncedAt: now,
        updatedAt: now,
      });
      return { id: existing._id, isNew: false };
    }

    // Insert new thread
    const id = await ctx.db.insert("lifeos_beeperThreads", {
      userId: user._id,
      threadId: args.threadId,
      threadName: args.threadName,
      threadType: args.threadType,
      participantCount: args.participantCount,
      messageCount: args.messageCount,
      lastMessageAt: args.lastMessageAt,
      isBusinessChat: args.isBusinessChat,
      businessNote: args.businessNote,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { id, isNew: true };
  },
});

/**
 * Batch upsert threads (create or update based on threadId)
 */
export const upsertThreadBatch = mutation({
  args: {
    threads: v.array(
      v.object({
        threadId: v.string(),
        threadName: v.string(),
        threadType: beeperThreadTypeValidator,
        participantCount: v.number(),
        messageCount: v.number(),
        lastMessageAt: v.number(),
        isBusinessChat: v.boolean(),
        businessNote: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    let insertedCount = 0;
    let updatedCount = 0;

    for (const thread of args.threads) {
      // Check if thread already exists
      const existing = await ctx.db
        .query("lifeos_beeperThreads")
        .withIndex("by_user_threadId", (q) =>
          q.eq("userId", user._id).eq("threadId", thread.threadId)
        )
        .unique();

      if (existing) {
        // Update existing thread
        await ctx.db.patch(existing._id, {
          threadName: thread.threadName,
          threadType: thread.threadType,
          participantCount: thread.participantCount,
          messageCount: thread.messageCount,
          lastMessageAt: thread.lastMessageAt,
          isBusinessChat: thread.isBusinessChat,
          businessNote: thread.businessNote,
          lastSyncedAt: now,
          updatedAt: now,
        });
        updatedCount++;
      } else {
        // Insert new thread
        await ctx.db.insert("lifeos_beeperThreads", {
          userId: user._id,
          threadId: thread.threadId,
          threadName: thread.threadName,
          threadType: thread.threadType,
          participantCount: thread.participantCount,
          messageCount: thread.messageCount,
          lastMessageAt: thread.lastMessageAt,
          isBusinessChat: thread.isBusinessChat,
          businessNote: thread.businessNote,
          lastSyncedAt: now,
          createdAt: now,
          updatedAt: now,
        });
        insertedCount++;
      }
    }

    return { insertedCount, updatedCount };
  },
});

/**
 * Batch upsert messages (create or update based on messageId)
 */
export const upsertMessagesBatch = mutation({
  args: {
    messages: v.array(
      v.object({
        threadId: v.string(),
        messageId: v.string(),
        sender: v.string(),
        text: v.string(),
        timestamp: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    let insertedCount = 0;
    let updatedCount = 0;

    for (const message of args.messages) {
      // Check if message already exists
      const existing = await ctx.db
        .query("lifeos_beeperMessages")
        .withIndex("by_user_messageId", (q) =>
          q.eq("userId", user._id).eq("messageId", message.messageId)
        )
        .unique();

      if (existing) {
        // Update if content changed
        if (existing.text !== message.text) {
          await ctx.db.patch(existing._id, {
            text: message.text,
            updatedAt: now,
          });
          updatedCount++;
        }
      } else {
        // Insert new message
        await ctx.db.insert("lifeos_beeperMessages", {
          userId: user._id,
          threadId: message.threadId,
          messageId: message.messageId,
          sender: message.sender,
          text: message.text,
          timestamp: message.timestamp,
          createdAt: now,
          updatedAt: now,
        });
        insertedCount++;
      }
    }

    return { insertedCount, updatedCount };
  },
});

/**
 * Delete all messages for a thread (used when unmarking as business)
 */
export const deleteThreadMessages = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const messages = await ctx.db
      .query("lifeos_beeperMessages")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .collect();

    let deletedCount = 0;
    for (const message of messages) {
      await ctx.db.delete(message._id);
      deletedCount++;
    }

    return { deletedCount };
  },
});

/**
 * Delete a thread (and optionally its messages)
 */
export const deleteThread = mutation({
  args: {
    threadId: v.string(),
    deleteMessages: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const thread = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .unique();

    if (!thread) {
      throw new Error("Thread not found");
    }

    // Delete messages if requested
    if (args.deleteMessages) {
      const messages = await ctx.db
        .query("lifeos_beeperMessages")
        .withIndex("by_user_threadId", (q) =>
          q.eq("userId", user._id).eq("threadId", args.threadId)
        )
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }
    }

    // Delete thread
    await ctx.db.delete(thread._id);

    return { success: true };
  },
});
