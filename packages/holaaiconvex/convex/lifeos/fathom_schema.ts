import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Fathom AI Meeting Notes Tables
 *
 * Tables for syncing meeting notes from the Fathom REST API.
 * Unlike Granola (which requires Tauri/desktop), Fathom sync runs as a Convex action.
 * All table names are prefixed with `life_fathom` to avoid conflicts.
 */
export const fathomTables = {
  // ==================== FATHOM MEETINGS ====================
  life_fathomMeetings: defineTable({
    // User who owns this meeting
    userId: v.id("users"),
    // Fathom recording ID (unique from Fathom API)
    fathomRecordingId: v.string(),
    // Meeting title
    title: v.string(),
    // Fathom URL for the recording
    fathomUrl: v.optional(v.string()),
    // Share URL for the recording
    shareUrl: v.optional(v.string()),
    // Email of the person who recorded
    recordedByEmail: v.optional(v.string()),
    // Transcript language code
    transcriptLanguage: v.optional(v.string()),
    // Calendar invitees
    calendarInvitees: v.optional(
      v.array(
        v.object({
          email: v.string(),
          name: v.optional(v.string()),
        })
      )
    ),
    // AI summary markdown
    summaryMarkdown: v.optional(v.string()),
    // Summary template name from Fathom
    summaryTemplateName: v.optional(v.string()),
    // Action items extracted from the meeting
    actionItems: v.optional(v.array(v.string())),
    // Whether this meeting has a transcript
    hasTranscript: v.boolean(),
    // Scheduled times (ISO strings from Fathom)
    scheduledStartTime: v.optional(v.string()),
    scheduledEndTime: v.optional(v.string()),
    // Recording times (ISO strings from Fathom)
    recordingStartTime: v.optional(v.string()),
    recordingEndTime: v.optional(v.string()),
    // Original creation time from Fathom (ISO string, primary sort field)
    fathomCreatedAt: v.string(),
    // Server timestamps (Unix epoch ms)
    createdAt: v.number(),
    updatedAt: v.number(),
    // Last synced timestamp
    lastSyncedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_fathom_recording_id", ["fathomRecordingId"])
    .index("by_user_fathom_recording_id", ["userId", "fathomRecordingId"])
    .index("by_user_created", ["userId", "fathomCreatedAt"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["userId"],
    })
    .searchIndex("search_summary", {
      searchField: "summaryMarkdown",
      filterFields: ["userId"],
    }),

  // ==================== FATHOM TRANSCRIPTS ====================
  life_fathomTranscripts: defineTable({
    // User who owns this transcript
    userId: v.id("users"),
    // Reference to the meeting
    meetingId: v.id("life_fathomMeetings"),
    // Fathom recording ID (denormalized for easier queries)
    fathomRecordingId: v.string(),
    // Full transcript text (concatenated for search)
    transcriptText: v.string(),
    // Individual utterances
    utterances: v.array(
      v.object({
        // Speaker display name
        speakerName: v.string(),
        // Speaker email (from matched calendar invitee)
        speakerEmail: v.optional(v.string()),
        // Transcript text
        text: v.string(),
        // Timestamp (HH:MM:SS format from Fathom)
        timestamp: v.string(),
      })
    ),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_meeting", ["meetingId"])
    .index("by_fathom_recording_id", ["fathomRecordingId"])
    .searchIndex("search_transcript", {
      searchField: "transcriptText",
      filterFields: ["userId"],
    }),

  // ==================== FATHOM SYNC STATUS ====================
  life_fathomSyncStatus: defineTable({
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
    // Cursor for incremental sync (ISO timestamp of last synced meeting)
    lastSyncCursor: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
};
