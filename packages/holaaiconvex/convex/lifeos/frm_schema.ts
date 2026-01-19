import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * FRM (Friend Relationship Management) Tables
 *
 * Tables for tracking people and relationship insights.
 * All table names are prefixed with `lifeos_frm` to follow convention.
 */

// ==================== VALIDATORS ====================

export const relationshipTypeValidator = v.union(
  v.literal("family"),
  v.literal("friend"),
  v.literal("colleague"),
  v.literal("acquaintance"),
  v.literal("mentor"),
  v.literal("other")
);

export const profileConfidenceValidator = v.union(
  v.literal("low"), // 1-2 memos
  v.literal("medium"), // 3-5 memos
  v.literal("high") // 6+ memos
);

export const timelineEntryTypeValidator = v.union(
  v.literal("voice_memo"),
  v.literal("note"),
  v.literal("profile_update")
);

export const profileStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed")
);

// ==================== TABLE DEFINITIONS ====================

export const frmTables = {
  // ==================== PEOPLE ====================
  lifeos_frmPeople: defineTable({
    // User who owns this person entry
    userId: v.id("users"),
    // Basic info (minimal required data - AI builds the rest)
    name: v.string(),
    nickname: v.optional(v.string()),
    // Optional categorization
    relationshipType: v.optional(relationshipTypeValidator),
    // Optional contact info
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    // Visual customization
    avatarEmoji: v.optional(v.string()),
    color: v.optional(v.string()),
    // User-written notes (not AI-generated)
    notes: v.optional(v.string()),
    // Denormalized stats for display
    memoCount: v.number(),
    lastInteractionAt: v.optional(v.number()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_archived", ["userId", "archivedAt"])
    .index("by_user_last_interaction", ["userId", "lastInteractionAt"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["userId"],
    }),

  // ==================== PERSON-MEMO LINKS ====================
  // Links voice memos to people (many-to-many)
  lifeos_frmPersonMemos: defineTable({
    userId: v.id("users"),
    personId: v.id("lifeos_frmPeople"),
    voiceMemoId: v.id("life_voiceMemos"),
    // Context for this memo about this person
    context: v.optional(v.string()), // "Phone call", "Coffee meetup", etc.
    // Timestamps
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_person", ["personId"])
    .index("by_memo", ["voiceMemoId"])
    .index("by_person_created", ["personId", "createdAt"]),

  // ==================== MEMO EXTRACTION HISTORY ====================
  // Stores AI extraction history for voice memos (versioned)
  lifeos_frmMemoExtractions: defineTable({
    userId: v.id("users"),
    voiceMemoId: v.id("life_voiceMemos"),
    // Version tracking
    version: v.number(),
    isLatest: v.boolean(),
    // AI-generated labels/tags
    labels: v.array(v.string()),
    // AI-generated summary
    summary: v.optional(v.string()),
    // Extracted people (snapshot at extraction time)
    extractedPeople: v.array(
      v.object({
        name: v.string(),
        context: v.optional(v.string()),
        confidence: v.string(),
        matched: v.boolean(), // Was matched to existing person
        personId: v.optional(v.id("lifeos_frmPeople")), // If matched/created
      })
    ),
    // Extraction metadata
    extractedAt: v.number(),
    model: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_memo", ["voiceMemoId"])
    .index("by_memo_version", ["voiceMemoId", "version"])
    .index("by_memo_latest", ["voiceMemoId", "isLatest"]),

  // ==================== MEMO EXTRACTION METADATA (DEPRECATED) ====================
  // Keeping for backward compatibility - will be migrated
  lifeos_frmMemoMetadata: defineTable({
    userId: v.id("users"),
    voiceMemoId: v.id("life_voiceMemos"),
    // AI-generated labels/tags
    labels: v.array(v.string()),
    // AI-generated summary
    summary: v.optional(v.string()),
    // Extraction metadata
    extractedAt: v.number(),
    model: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_memo", ["voiceMemoId"]),

  // ==================== AI RELATIONSHIP PROFILES ====================
  // Stores evolving AI-generated insights about a person
  lifeos_frmProfiles: defineTable({
    userId: v.id("users"),
    personId: v.id("lifeos_frmPeople"),
    // Version for history tracking
    version: v.number(),
    // Confidence based on data quantity
    confidence: profileConfidenceValidator,
    // Number of memos analyzed for this profile
    memosAnalyzed: v.number(),
    // Track which specific memos were analyzed for this version
    memoIdsAnalyzed: v.optional(v.array(v.id("life_voiceMemos"))),
    // AI model used
    model: v.string(),

    // === Communication Patterns ===
    communicationStyle: v.optional(
      v.object({
        preferredChannels: v.optional(v.array(v.string())), // "text", "call", "in-person"
        responsePatterns: v.optional(v.string()), // "Quick responder", "Takes time"
        conflictApproach: v.optional(v.string()), // "Direct", "Avoidant", "Collaborative"
        expressionStyle: v.optional(v.string()), // "Verbose", "Concise", "Emoji-heavy"
      })
    ),

    // === Personality Insights ===
    personality: v.optional(
      v.object({
        coreValues: v.optional(v.array(v.string())), // "Family", "Achievement", "Adventure"
        motivations: v.optional(v.array(v.string())), // What drives them
        strengths: v.optional(v.array(v.string())), // Their positive traits
        frictionPoints: v.optional(v.array(v.string())), // Topics/behaviors that cause tension
        interests: v.optional(v.array(v.string())), // Hobbies, topics they enjoy
      })
    ),

    // === Relationship Tips ===
    tips: v.optional(
      v.object({
        doList: v.optional(v.array(v.string())), // Things that work well
        avoidList: v.optional(v.array(v.string())), // Things to avoid
        conversationStarters: v.optional(v.array(v.string())), // Topics they enjoy
        giftIdeas: v.optional(v.array(v.string())), // Based on interests
      })
    ),

    // === Summary ===
    summary: v.optional(v.string()),

    // === Citations ===
    // Track which sources support each insight
    citations: v.optional(
      v.object({
        // Each category maps insight text to source references
        communicationStyle: v.optional(
          v.array(
            v.object({
              insight: v.string(), // The specific insight text
              sources: v.array(
                v.object({
                  type: v.union(v.literal("memo"), v.literal("file")),
                  id: v.string(), // memo ID or file ID
                  name: v.string(), // memo name or file name for display
                  excerpt: v.optional(v.string()), // relevant text excerpt
                })
              ),
            })
          )
        ),
        personality: v.optional(
          v.array(
            v.object({
              insight: v.string(),
              sources: v.array(
                v.object({
                  type: v.union(v.literal("memo"), v.literal("file")),
                  id: v.string(),
                  name: v.string(),
                  excerpt: v.optional(v.string()),
                })
              ),
            })
          )
        ),
        tips: v.optional(
          v.array(
            v.object({
              insight: v.string(),
              sources: v.array(
                v.object({
                  type: v.union(v.literal("memo"), v.literal("file")),
                  id: v.string(),
                  name: v.string(),
                  excerpt: v.optional(v.string()),
                })
              ),
            })
          )
        ),
        summary: v.optional(
          v.array(
            v.object({
              type: v.union(v.literal("memo"), v.literal("file")),
              id: v.string(),
              name: v.string(),
              excerpt: v.optional(v.string()),
            })
          )
        ),
      })
    ),
    // Track which files were analyzed for this version
    fileIdsAnalyzed: v.optional(v.array(v.id("lifeos_frmFiles"))),

    // Processing status
    status: profileStatusValidator,
    error: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_person", ["personId"])
    .index("by_person_version", ["personId", "version"])
    .index("by_user_status", ["userId", "status"]),

  // ==================== PERSON FILES ====================
  // Files uploaded as intel for a person
  lifeos_frmFiles: defineTable({
    userId: v.id("users"),
    personId: v.id("lifeos_frmPeople"),
    // File info
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    // Convex storage reference
    storageId: v.id("_storage"),
    // Timestamps
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_person", ["personId"])
    .index("by_person_created", ["personId", "createdAt"]),

  // ==================== TIMELINE ENTRIES ====================
  // Denormalized view for the Timeline tab (faster queries)
  lifeos_frmTimeline: defineTable({
    userId: v.id("users"),
    personId: v.id("lifeos_frmPeople"),
    // Entry type
    entryType: timelineEntryTypeValidator,
    // Reference to source
    voiceMemoId: v.optional(v.id("life_voiceMemos")),
    // Denormalized data for display
    personName: v.string(),
    title: v.string(),
    preview: v.optional(v.string()), // First ~200 chars of transcript/note
    // Timestamp of the interaction (memo createdAt, not link createdAt)
    interactionAt: v.number(),
    // Timestamps
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_person", ["personId"])
    .index("by_user_interaction", ["userId", "interactionAt"])
    .index("by_person_interaction", ["personId", "interactionAt"]),
};
