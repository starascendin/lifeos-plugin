import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Avatar Stats Tables
 *
 * RPG-style life category stats for the avatar feature.
 * All table names are prefixed with `lifeos_avatar` to avoid conflicts.
 */

// ==================== SHARED VALIDATORS ====================

export const lifeCategoryValidator = v.union(
  v.literal("health"),
  v.literal("work"),
  v.literal("social"),
  v.literal("learning"),
  v.literal("finance")
);

export const statChangeSourceValidator = v.union(
  v.literal("manual"),
  v.literal("habit_completion"),
  v.literal("project_completion"),
  v.literal("daily_summary"),
  v.literal("system")
);

// ==================== TABLE DEFINITIONS ====================

export const avatarTables = {
  // ==================== AVATAR STATS ====================
  lifeos_avatarStats: defineTable({
    userId: v.id("users"),
    // RPG-style life categories (0-100 scale)
    health: v.number(), // Physical wellbeing, exercise, sleep
    work: v.number(), // Career, productivity, projects
    social: v.number(), // Relationships, community
    learning: v.number(), // Skills, education, growth
    finance: v.number(), // Money, investments, stability
    // Gamification
    overallLevel: v.number(), // Computed from all stats
    totalXP: v.number(), // Experience points
    // Timestamps
    lastUpdatedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ==================== AVATAR STATS HISTORY ====================
  lifeos_avatarStatsHistory: defineTable({
    userId: v.id("users"),
    // Snapshot of all stats at this point
    health: v.number(),
    work: v.number(),
    social: v.number(),
    learning: v.number(),
    finance: v.number(),
    // What triggered this change
    source: statChangeSourceValidator,
    // Which stat changed (for single-stat updates)
    changedStat: v.optional(lifeCategoryValidator),
    // Delta for the changed stat
    delta: v.optional(v.number()),
    // Optional note
    note: v.optional(v.string()),
    // Timestamps
    recordedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "recordedAt"]),
};
