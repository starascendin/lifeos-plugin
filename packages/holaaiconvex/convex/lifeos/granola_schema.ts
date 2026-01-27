import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Granola Meeting Notes Tables
 *
 * Tables for syncing meeting notes from Granola app.
 * All table names are prefixed with `life_granola_` to avoid conflicts.
 */
export const granolaTables = {
  // ==================== GRANOLA MEETINGS ====================
  life_granolaMeetings: defineTable({
    // User who owns this meeting
    userId: v.id("users"),
    // Granola document ID (unique identifier from Granola)
    granolaDocId: v.string(),
    // Meeting title
    title: v.string(),
    // Workspace ID from Granola
    workspaceId: v.optional(v.string()),
    // Workspace name
    workspaceName: v.optional(v.string()),
    // AI-generated meeting notes/resume in markdown
    resumeMarkdown: v.optional(v.string()),
    // Whether this meeting has a transcript
    hasTranscript: v.boolean(),
    // Folder/list associations from Granola
    folders: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
        })
      )
    ),
    // Original timestamps from Granola (ISO strings)
    granolaCreatedAt: v.string(),
    granolaUpdatedAt: v.optional(v.string()),
    // Server timestamps (Unix epoch ms)
    createdAt: v.number(),
    updatedAt: v.number(),
    // Last synced timestamp
    lastSyncedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_granola_doc_id", ["granolaDocId"])
    .index("by_user_granola_doc_id", ["userId", "granolaDocId"])
    .index("by_user_created", ["userId", "granolaCreatedAt"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["userId"],
    })
    .searchIndex("search_resume", {
      searchField: "resumeMarkdown",
      filterFields: ["userId"],
    }),

  // ==================== GRANOLA TRANSCRIPTS ====================
  life_granolaTranscripts: defineTable({
    // User who owns this transcript
    userId: v.id("users"),
    // Reference to the meeting
    meetingId: v.id("life_granolaMeetings"),
    // Granola document ID (denormalized for easier queries)
    granolaDocId: v.string(),
    // Full transcript in markdown format
    transcriptMarkdown: v.string(),
    // Utterances/segments
    utterances: v.array(
      v.object({
        // Speaker source: "microphone" or "system"
        source: v.string(),
        // Transcript text
        text: v.string(),
        // ISO timestamp strings
        startTimestamp: v.optional(v.string()),
        endTimestamp: v.optional(v.string()),
        // Confidence score (0-1)
        confidence: v.optional(v.number()),
      })
    ),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_meeting", ["meetingId"])
    .index("by_granola_doc_id", ["granolaDocId"])
    .searchIndex("search_transcript", {
      searchField: "transcriptMarkdown",
      filterFields: ["userId"],
    }),

  // ==================== GRANOLA MEETING LINKS ====================
  // Links between Granola meetings and Beeper contacts
  life_granolaMeetingLinks: defineTable({
    // User who owns this link
    userId: v.id("users"),
    // Meeting ID
    meetingId: v.id("life_granolaMeetings"),
    // Beeper thread ID (the contact/chat)
    beeperThreadId: v.id("lifeos_beeperThreads"),
    // How this link was created
    linkSource: v.union(
      v.literal("ai_suggestion"), // AI suggested and user confirmed
      v.literal("manual") // User manually linked
    ),
    // AI confidence score (0-1) if AI suggested
    aiConfidence: v.optional(v.number()),
    // AI reasoning for the suggestion
    aiReason: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_meeting", ["meetingId"])
    .index("by_beeperThread", ["beeperThreadId"])
    .index("by_user_meeting", ["userId", "meetingId"]),

  // ==================== GRANOLA MEETING PERSON LINKS ====================
  // Links between Granola meetings and FRM People (contacts)
  life_granolaMeetingPersonLinks: defineTable({
    // User who owns this link
    userId: v.id("users"),
    // Meeting ID
    meetingId: v.id("life_granolaMeetings"),
    // Person ID (from FRM)
    personId: v.id("lifeos_frmPeople"),
    // How this link was created
    linkSource: v.union(
      v.literal("ai_suggestion"), // AI suggested and user confirmed
      v.literal("manual") // User manually linked
    ),
    // AI confidence score (0-1) if AI suggested
    aiConfidence: v.optional(v.number()),
    // AI reasoning for the suggestion
    aiReason: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
  })
    .index("by_meeting", ["meetingId"])
    .index("by_person", ["personId"])
    .index("by_user_meeting", ["userId", "meetingId"]),

  // ==================== GRANOLA SYNC STATUS ====================
  life_granolaSyncStatus: defineTable({
    // User who owns this sync status
    userId: v.id("users"),
    // Last successful sync timestamp (Unix epoch ms)
    lastSyncAt: v.optional(v.number()),
    // Number of meetings synced in last sync
    lastSyncMeetingCount: v.optional(v.number()),
    // Last sync error message (if any)
    lastSyncError: v.optional(v.string()),
    // Whether sync is currently in progress
    isSyncing: v.boolean(),
    // Auto-sync enabled
    autoSyncEnabled: v.boolean(),
    // Auto-sync interval in minutes (default 10)
    autoSyncIntervalMinutes: v.number(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
};
