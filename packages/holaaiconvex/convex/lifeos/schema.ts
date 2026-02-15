import { defineTable } from "convex/server";
import { v } from "convex/values";
import { coachingTables } from "./coaching_schema";
import { customAgentTables } from "./agents_schema";
import { avatarTables } from "./avatar_schema";
import { beeperTables } from "./beeper_schema";
import { calendarTables } from "./calendar_schema";
import { catgirlAgentTables } from "./catgirl_agent_schema";
import { chatnexusTables } from "./chatnexus_schema";
import { contactTables } from "./contact_schema";
import { financeTables } from "./finance_schema";
import { controlplaneTables } from "./controlplane_schema";
import { dailyFieldsTables } from "./daily_fields_schema";
import { demoAgentTables } from "./demo_agent_schema";
import { fathomTables } from "./fathom_schema";
import { frmTables } from "./frm_schema";
import { granolaTables } from "./granola_schema";
import { habitsTables } from "./habits_schema";
import { initiativesTables } from "./initiatives_schema";
import { llmcouncilTables } from "./llmcouncil_schema";
import { otaTables } from "./ota_schema";
import { ouraTables } from "./oura_schema";
import { pmTables } from "./pm_schema";
import { proxyCouncilTables } from "./proxy_council_schema";
import { voiceAgentTables } from "./voiceagent_schema";

/**
 * LifeOS Tables
 *
 * Tables for the LifeOS personal productivity app.
 * All table names are prefixed with `life_` or `lifeos_chatnexus` or `lifeos_pm` to avoid conflicts.
 */
export const lifeosTables = {
  // AI Coaching tables
  ...coachingTables,
  // Custom AI Agent tables
  ...customAgentTables,
  // Avatar Stats tables
  ...avatarTables,
  // Beeper (WhatsApp via Beeper Desktop) tables
  ...beeperTables,
  // Calendar tables
  ...calendarTables,
  // CatGirl Agent tables
  ...catgirlAgentTables,
  // Chat Nexus tables
  ...chatnexusTables,
  // Unified Contact System tables (email lookup + meeting-person links)
  ...contactTables,
  // Controlplane (Claude Agent Farm) tables
  ...controlplaneTables,
  // Daily Fields tables
  ...dailyFieldsTables,
  // Demo Agent tables
  ...demoAgentTables,
  // Fathom AI (Meeting Notes via API) tables
  ...fathomTables,
  // Personal Finance tables (Empower Retirement scraper)
  ...financeTables,
  // FRM (Friend Relationship Management) tables
  ...frmTables,
  // Granola (Meeting Notes) tables
  ...granolaTables,
  // Habit Tracker tables
  ...habitsTables,
  // Yearly Initiatives tables
  ...initiativesTables,
  // LLM Council tables
  ...llmcouncilTables,
  // OTA Update tables
  ...otaTables,
  // Oura Ring health data tables
  ...ouraTables,
  // Project Management tables (Linear-like personal PM, includes Clients, Phases, Notes)
  ...pmTables,
  // Proxy Council tables
  ...proxyCouncilTables,
  // Voice Agent tables
  ...voiceAgentTables,
  // ==================== YOUTUBE PLAYLISTS ====================
  life_youtubePlaylists: defineTable({
    // User who owns this playlist sync
    userId: v.id("users"),
    // YouTube playlist ID (e.g., "PLxxx...")
    youtubePlaylistId: v.string(),
    // Playlist title
    title: v.string(),
    // Playlist description
    description: v.optional(v.string()),
    // Channel that owns the playlist
    channelTitle: v.optional(v.string()),
    // Number of videos in playlist
    videoCount: v.optional(v.number()),
    // Playlist thumbnail URL
    thumbnailUrl: v.optional(v.string()),
    // Last time this playlist was synced
    lastSyncedAt: v.number(),
    // Timestamps
    createdAt: v.number(),
    // When playlist metadata was last updated (title, videoCount, etc.)
    updatedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_youtube_id", ["youtubePlaylistId"])
    .index("by_user_youtube_id", ["userId", "youtubePlaylistId"]),

  // ==================== YOUTUBE VIDEOS ====================
  life_youtubeVideos: defineTable({
    // User who owns this video sync
    userId: v.id("users"),
    // Reference to playlist (optional - video might be standalone)
    playlistId: v.optional(v.id("life_youtubePlaylists")),
    // YouTube video ID (e.g., "dQw4w9WgXcQ")
    youtubeVideoId: v.string(),
    // Video title
    title: v.string(),
    // Video description
    description: v.optional(v.string()),
    // Channel name
    channelTitle: v.optional(v.string()),
    // Duration in seconds
    duration: v.optional(v.number()),
    // Thumbnail URL
    thumbnailUrl: v.optional(v.string()),
    // When the video was published on YouTube
    publishedAt: v.optional(v.string()),
    // Whether we have a transcript for this video
    hasTranscript: v.boolean(),
    // Timestamps
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_youtube_id", ["youtubeVideoId"])
    .index("by_user_youtube_id", ["userId", "youtubeVideoId"])
    .index("by_playlist", ["playlistId"]),

  // ==================== YOUTUBE TRANSCRIPTS ====================
  life_youtubeTranscripts: defineTable({
    // User who owns this transcript
    userId: v.id("users"),
    // Reference to the video
    videoId: v.id("life_youtubeVideos"),
    // YouTube video ID (denormalized for easier queries)
    youtubeVideoId: v.string(),
    // Language code (e.g., "en", "es", "zh")
    language: v.string(),
    // Whether this is auto-generated captions
    isAutoGenerated: v.boolean(),
    // Full transcript text (concatenated)
    transcript: v.string(),
    // Timed segments for precise lookups
    segments: v.optional(
      v.array(
        v.object({
          start: v.number(), // Start time in seconds
          duration: v.number(), // Duration in seconds
          text: v.string(), // Segment text
        }),
      ),
    ),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_video", ["videoId"])
    .index("by_youtube_id", ["youtubeVideoId"])
    .index("by_user_youtube_id", ["userId", "youtubeVideoId"]),

  // ==================== SCREEN TIME SESSIONS ====================
  life_screentimeSessions: defineTable({
    // User who owns this session
    userId: v.id("users"),
    // Unique identifier for this session (bundleId_startTime for deduplication)
    sessionKey: v.string(),
    // App bundle identifier (e.g., "com.apple.Safari")
    bundleId: v.string(),
    // Human-readable app name
    appName: v.optional(v.string()),
    // App category (productivity, social, entertainment, etc.)
    category: v.optional(v.string()),
    // Session timestamps (Unix epoch milliseconds)
    startTime: v.number(),
    endTime: v.number(),
    // Duration in seconds
    durationSeconds: v.number(),
    // Timezone offset in seconds from UTC
    timezoneOffset: v.optional(v.number()),
    // Device identifier
    deviceId: v.optional(v.string()),
    // Whether this is web usage (Safari/Chrome)
    isWebUsage: v.boolean(),
    // Domain for web usage sessions
    domain: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "startTime"])
    .index("by_session_key", ["userId", "sessionKey"])
    .index("by_user_bundle", ["userId", "bundleId"]),

  // ==================== SCREEN TIME DAILY SUMMARIES ====================
  life_screentimeDailySummaries: defineTable({
    // User who owns this summary
    userId: v.id("users"),
    // Date string in YYYY-MM-DD format (in user's local timezone)
    date: v.string(),
    // Total screen time for the day in seconds
    totalSeconds: v.number(),
    // Per-app breakdown
    appUsage: v.array(
      v.object({
        bundleId: v.string(),
        appName: v.optional(v.string()),
        category: v.optional(v.string()),
        seconds: v.number(),
        sessionCount: v.number(),
      }),
    ),
    // Per-category breakdown
    categoryUsage: v.array(
      v.object({
        category: v.string(),
        seconds: v.number(),
      }),
    ),
    // Device identifier
    deviceId: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  // ==================== SCREEN TIME SYNC STATUS ====================
  life_screentimeSyncStatus: defineTable({
    // User who owns this sync status
    userId: v.id("users"),
    // Last successful sync timestamp (Unix epoch ms)
    lastSyncAt: v.optional(v.number()),
    // Last session timestamp synced (to enable incremental sync)
    lastSessionTime: v.optional(v.number()),
    // Device identifier
    deviceId: v.optional(v.string()),
    // Whether auto-sync is enabled
    autoSyncEnabled: v.boolean(),
    // Auto-sync interval in minutes
    autoSyncIntervalMinutes: v.optional(v.number()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ==================== VOICE MEMOS ====================
  life_voiceMemos: defineTable({
    // User who owns this memo
    userId: v.id("users"),
    // Client-generated UUID (for linking local to cloud)
    localId: v.string(),
    // User-editable name
    name: v.string(),
    // Convex file storage ID for the audio file (optional for transcript-only syncs)
    storageId: v.optional(v.id("_storage")),
    // Duration in milliseconds
    duration: v.number(),
    // Transcription status
    transcriptionStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    // Error message if transcription failed
    transcriptionError: v.optional(v.string()),
    // Full transcription text
    transcript: v.optional(v.string()),
    // Timed segments (matching YouTube transcript pattern)
    segments: v.optional(
      v.array(
        v.object({
          start: v.number(), // Start time in seconds
          duration: v.number(), // Duration in seconds
          text: v.string(), // Segment text
        }),
      ),
    ),
    // Language detected/specified
    language: v.optional(v.string()),
    // Tags for categorization (voice agent journaling)
    tags: v.optional(v.array(v.string())),
    // Original client timestamps
    clientCreatedAt: v.number(),
    clientUpdatedAt: v.number(),
    // Server timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_localId", ["userId", "localId"])
    .index("by_user_created", ["userId", "clientCreatedAt"])
    .searchIndex("search_transcript", {
      searchField: "transcript",
      filterFields: ["userId"],
    }),

  // ==================== VOICE MEMO AI EXTRACTIONS ====================
  life_voiceMemoExtractions: defineTable({
    // User who owns this extraction
    userId: v.id("users"),
    // Reference to the source voice memo
    voiceMemoId: v.id("life_voiceMemos"),
    // Version number for this extraction (1, 2, 3, etc. for history)
    version: v.number(),
    // Custom prompt used for this extraction (user-editable)
    customPrompt: v.optional(v.string()),
    // AI model used for extraction
    model: v.string(),

    // === AI Extraction Output (fixed schema) ===
    summary: v.string(),
    labels: v.array(v.string()),
    actionItems: v.array(v.string()),
    keyPoints: v.array(v.string()),
    sentiment: v.union(
      v.literal("positive"),
      v.literal("neutral"),
      v.literal("negative"),
    ),

    // Processing status
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_voiceMemo", ["voiceMemoId"])
    .index("by_user_voiceMemo", ["userId", "voiceMemoId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_status", ["userId", "status"]),

  // ==================== VOICE MEMO USER SETTINGS ====================
  life_voiceMemoSettings: defineTable({
    // User who owns these settings
    userId: v.id("users"),
    // Custom system prompt for voice memo extraction
    // If not set, the default system prompt will be used
    extractionSystemPrompt: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ==================== AI CONVERSATION SUMMARIES ====================
  // Stores crystallized summaries from AI conversations about voice notes
  life_voiceNotesAiConvoSummary: defineTable({
    // User who owns this summary
    userId: v.id("users"),
    // Title for this conversation summary
    title: v.string(),
    // The crystallized summary/insights from the AI conversation
    summary: v.string(),
    // Key insights extracted from the conversation
    keyInsights: v.optional(v.array(v.string())),
    // Action items that emerged from the conversation
    actionItems: v.optional(v.array(v.string())),
    // New ideas or plans formulated
    ideas: v.optional(v.array(v.string())),
    // Tags for categorization
    tags: v.optional(v.array(v.string())),
    // References to voice memos discussed in this conversation
    relatedMemoIds: v.optional(v.array(v.id("life_voiceMemos"))),
    // The date range of memos discussed (for context)
    memoDateRange: v.optional(
      v.object({
        start: v.number(),
        end: v.number(),
      }),
    ),
    // Type of summary: reflection, planning, brainstorm, journal_review, etc.
    summaryType: v.optional(v.string()),
    // Optional: the conversation context/topic that led to this summary
    conversationContext: v.optional(v.string()),
    // Raw conversation transcript (JSON string of role+text pairs)
    rawConversation: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_type", ["userId", "summaryType"])
    .searchIndex("search_summary", {
      searchField: "summary",
      filterFields: ["userId"],
    }),
};
