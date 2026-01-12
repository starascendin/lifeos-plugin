import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Yearly Initiatives Tables
 *
 * Top-level yearly goals that cascade down to projects, tasks, and habits.
 * All table names are prefixed with `lifeos_` to avoid conflicts.
 */

// ==================== SHARED VALIDATORS ====================

export const initiativeCategoryValidator = v.union(
  v.literal("career"),
  v.literal("health"),
  v.literal("learning"),
  v.literal("relationships"),
  v.literal("finance"),
  v.literal("personal"),
);

export const initiativeStatusValidator = v.union(
  v.literal("active"),
  v.literal("completed"),
  v.literal("paused"),
  v.literal("cancelled"),
);

// ==================== TABLE DEFINITIONS ====================

export const initiativesTables = {
  // ==================== YEARLY INITIATIVES ====================
  lifeos_yearlyInitiatives: defineTable({
    userId: v.id("users"),
    // Year this initiative belongs to (e.g., 2026)
    year: v.number(),
    // Initiative details
    title: v.string(),
    description: v.optional(v.string()),
    // Category for grouping and filtering
    category: initiativeCategoryValidator,
    // Status tracking
    status: initiativeStatusValidator,
    // Target metric description (e.g., "Complete 3 projects", "Run 500 miles")
    targetMetric: v.optional(v.string()),
    // Progress tracking (0-100)
    // manualProgress: User-set override, takes precedence when set
    // autoProgress: Calculated from linked projects/tasks completion
    manualProgress: v.optional(v.number()),
    autoProgress: v.optional(v.number()),
    // Visual customization
    color: v.optional(v.string()), // Hex color
    icon: v.optional(v.string()), // Emoji
    // Ordering within the year
    sortOrder: v.number(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_year", ["userId", "year"])
    .index("by_user_year_status", ["userId", "year", "status"])
    .index("by_user_category", ["userId", "category"])
    .index("by_user_order", ["userId", "sortOrder"]),
};

// ==================== CATEGORY METADATA ====================

export const INITIATIVE_CATEGORIES = {
  career: {
    label: "Career",
    icon: "Briefcase",
    color: "#6366f1", // Indigo
  },
  health: {
    label: "Health",
    icon: "Heart",
    color: "#ef4444", // Red
  },
  learning: {
    label: "Learning",
    icon: "BookOpen",
    color: "#f59e0b", // Amber
  },
  relationships: {
    label: "Relationships",
    icon: "Users",
    color: "#ec4899", // Pink
  },
  finance: {
    label: "Finance",
    icon: "DollarSign",
    color: "#22c55e", // Green
  },
  personal: {
    label: "Personal",
    icon: "Sparkles",
    color: "#8b5cf6", // Violet
  },
} as const;

export type InitiativeCategory = keyof typeof INITIATIVE_CATEGORIES;
