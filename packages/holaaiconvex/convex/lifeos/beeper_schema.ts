import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Beeper (WhatsApp via Beeper Desktop) Tables
 *
 * Tables for syncing business-marked Beeper chats to Convex for AI/MCP access.
 * All table names are prefixed with `lifeos_beeper` to follow convention.
 */

// ==================== VALIDATORS ====================

export const beeperThreadTypeValidator = v.union(
  v.literal("dm"),
  v.literal("group")
);

// ==================== TABLE DEFINITIONS ====================

export const beeperTables = {
  // ==================== BEEPER THREADS ====================
  // Threads marked as "business" by the user, synced from local Beeper data
  lifeos_beeperThreads: defineTable({
    // User who owns this thread
    userId: v.id("users"),
    // Thread ID from Beeper (dedup key)
    threadId: v.string(),
    // Thread name (contact name or group name)
    threadName: v.string(),
    // Thread type: "dm" or "group"
    threadType: beeperThreadTypeValidator,
    // Number of participants (1 for DM, more for groups)
    participantCount: v.number(),

    // Business marking
    isBusinessChat: v.boolean(),
    // User note about why this is a business chat
    businessNote: v.optional(v.string()),

    // For DMs: optional link to frm_people contact
    linkedPersonId: v.optional(v.id("lifeos_frmPeople")),

    // For business chats: optional link to a client
    linkedClientId: v.optional(v.id("lifeos_pmClients")),

    // Sync tracking (from local Beeper data)
    messageCount: v.number(),
    lastMessageAt: v.number(), // Unix timestamp
    lastSyncedAt: v.number(), // When we last synced to Convex

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_threadId", ["userId", "threadId"])
    .index("by_user_business", ["userId", "isBusinessChat"])
    .index("by_linkedPerson", ["linkedPersonId"])
    .index("by_linkedClient", ["linkedClientId"]),

  // ==================== BEEPER MESSAGES ====================
  // Messages from business-marked threads, synced for AI/MCP access
  lifeos_beeperMessages: defineTable({
    // User who owns this message
    userId: v.id("users"),
    // Thread ID (references beeperThreads.threadId)
    threadId: v.string(),
    // Unique message ID from Beeper (eventID - dedup key)
    messageId: v.string(),

    // Message content
    sender: v.string(),
    text: v.string(),
    timestamp: v.number(), // Unix timestamp

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_threadId", ["userId", "threadId"])
    .index("by_user_messageId", ["userId", "messageId"])
    .index("by_thread_timestamp", ["threadId", "timestamp"])
    .searchIndex("search_text", {
      searchField: "text",
      filterFields: ["userId", "threadId"],
    }),
};
