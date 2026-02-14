import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * AI Coaching Tables
 *
 * Tables for AI coach profiles, coaching sessions (interactive chat),
 * session summaries, and action items that persist across sessions.
 * All table names are prefixed with `lifeos_coaching` to avoid conflicts.
 */
export const coachingTables = {
  // ==================== COACH PROFILES ====================
  // User-configurable coach personas with system prompts, focus areas, and tool access
  lifeos_coachingProfiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    slug: v.string(),
    // The coaching methodology/persona system prompt
    instructions: v.string(),
    // Which life/business areas this coach focuses on
    focusAreas: v.array(v.string()),
    // Which LifeOS tools this coach can use
    enabledTools: v.array(v.string()),
    // LLM model to use (Vercel AI Gateway format)
    model: v.string(),
    // Opening greeting when starting a new session
    greeting: v.optional(v.string()),
    // Suggested session cadence
    sessionCadence: v.optional(
      v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("biweekly"),
        v.literal("monthly"),
        v.literal("ad_hoc"),
      ),
    ),
    // Color/icon for UI
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    // Whether this is the default coach
    isDefault: v.optional(v.boolean()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_slug", ["userId", "slug"])
    .index("by_user_default", ["userId", "isDefault"]),

  // ==================== COACHING SESSIONS ====================
  // Each coaching conversation is a session tied to a coach profile
  // Uses @convex-dev/agent for thread/message persistence
  lifeos_coachingSessions: defineTable({
    userId: v.id("users"),
    coachProfileId: v.id("lifeos_coachingProfiles"),
    // Thread ID from @convex-dev/agent component
    threadId: v.optional(v.string()),
    // Session status
    status: v.union(
      v.literal("active"),
      v.literal("summarizing"),
      v.literal("completed"),
    ),
    // Optional user-set title (auto-generated if not provided)
    title: v.optional(v.string()),
    // Session summary (generated on close)
    summary: v.optional(v.string()),
    keyInsights: v.optional(v.array(v.string())),
    // Mood/energy at start (optional self-check-in)
    moodAtStart: v.optional(v.string()),
    // Session timing
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_status", ["userId", "status"])
    .index("by_coach", ["coachProfileId"])
    .index("by_coach_created", ["coachProfileId", "createdAt"])
    .index("by_thread", ["threadId"]),

  // ==================== COACHING ACTION ITEMS ====================
  // Persistent action items that emerge from coaching sessions
  // These survive across sessions so the coach can follow up
  lifeos_coachingActionItems: defineTable({
    userId: v.id("users"),
    // Which session created this action item
    sessionId: v.id("lifeos_coachingSessions"),
    // Which coach profile this belongs to
    coachProfileId: v.id("lifeos_coachingProfiles"),
    // The action item text
    text: v.string(),
    // Status tracking
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    // Optional due date
    dueDate: v.optional(v.number()),
    // Optional link to a PM issue (if the action item becomes a task)
    linkedIssueId: v.optional(v.id("lifeos_pmIssues")),
    // Priority
    priority: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    ),
    // Notes/context about this action item
    notes: v.optional(v.string()),
    // When it was completed
    completedAt: v.optional(v.number()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_session", ["sessionId"])
    .index("by_coach", ["coachProfileId"])
    .index("by_coach_status", ["coachProfileId", "status"]),
};
