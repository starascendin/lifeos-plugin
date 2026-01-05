import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Voice Agent Tables
 *
 * Tables for the LifeOS Butler AI voice agent feature.
 * Stores voice agent sessions and message history for persistence.
 */
export const voiceAgentTables = {
  // ==================== VOICE AGENT SESSIONS ====================
  lifeos_voiceAgentSessions: defineTable({
    // User who owns this session
    userId: v.id("users"),
    // LiveKit room name for this session
    roomName: v.string(),
    // Model used for this session (gpt-4o-mini, gpt-4o, etc)
    modelId: v.string(),
    // Session status
    status: v.union(v.literal("active"), v.literal("ended")),
    // When the session started (Unix epoch ms)
    startedAt: v.number(),
    // When the session ended (Unix epoch ms, null if active)
    endedAt: v.optional(v.number()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_room", ["roomName"]),

  // ==================== VOICE AGENT MESSAGES ====================
  lifeos_voiceAgentMessages: defineTable({
    // User who owns this message
    userId: v.id("users"),
    // Reference to parent session
    sessionId: v.id("lifeos_voiceAgentSessions"),
    // Message sender
    sender: v.union(v.literal("user"), v.literal("agent")),
    // Transcription text
    text: v.string(),
    // Original LiveKit message/segment ID (for deduplication)
    livekitMessageId: v.optional(v.string()),
    // When this was spoken/transcribed (client timestamp)
    timestamp: v.number(),
    // Server timestamp
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_timestamp", ["sessionId", "timestamp"])
    .index("by_user_created", ["userId", "createdAt"]),
};
