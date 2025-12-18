import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Habit Tracker Tables
 *
 * Habit tracking with categories, daily/weekly frequency, and streak tracking.
 * All table names are prefixed with `lifeos_habit` to avoid conflicts.
 */

// ==================== SHARED VALIDATORS ====================

export const habitFrequencyValidator = v.union(
  v.literal("daily"),
  v.literal("weekly")
);

export const dayOfWeekValidator = v.union(
  v.literal("sunday"),
  v.literal("monday"),
  v.literal("tuesday"),
  v.literal("wednesday"),
  v.literal("thursday"),
  v.literal("friday"),
  v.literal("saturday")
);

// ==================== TABLE DEFINITIONS ====================

export const habitsTables = {
  // ==================== HABIT CATEGORIES ====================
  lifeos_habitCategories: defineTable({
    userId: v.id("users"),
    name: v.string(), // e.g., "Morning Routines", "Daily Create"
    icon: v.optional(v.string()), // Emoji or icon name
    color: v.optional(v.string()), // Hex color for category
    sortOrder: v.number(), // For ordering categories
    isCollapsed: v.boolean(), // Whether section is collapsed in UI
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_order", ["userId", "sortOrder"]),

  // ==================== HABITS ====================
  lifeos_habits: defineTable({
    userId: v.id("users"),
    categoryId: v.optional(v.id("lifeos_habitCategories")), // null = uncategorized
    // Habit definition
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()), // Emoji for the habit
    color: v.optional(v.string()), // Hex color
    // Frequency configuration
    frequency: habitFrequencyValidator,
    // For weekly habits: which days to track (e.g., ["monday", "wednesday", "friday"])
    targetDays: v.optional(v.array(dayOfWeekValidator)),
    // Ordering within category
    sortOrder: v.number(),
    // Active status
    isActive: v.boolean(),
    // Computed stats (denormalized for performance)
    totalCompletions: v.number(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastCompletedDate: v.optional(v.string()), // YYYY-MM-DD
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_category", ["categoryId"])
    .index("by_user_active", ["userId", "isActive"])
    .index("by_user_order", ["userId", "sortOrder"]),

  // ==================== HABIT CHECK-INS ====================
  lifeos_habitCheckIns: defineTable({
    userId: v.id("users"),
    habitId: v.id("lifeos_habits"),
    // Date of the check-in (YYYY-MM-DD format for easy querying)
    date: v.string(),
    // Whether the habit was completed
    completed: v.boolean(),
    // Optional note
    note: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_habit", ["habitId"])
    .index("by_habit_date", ["habitId", "date"])
    .index("by_user_date", ["userId", "date"]),
};
