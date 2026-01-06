import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Daily Fields Tables
 *
 * Global field definitions that appear on every day + per-day values.
 * Used in the Agenda Tab for tracking custom daily metrics.
 */

// ==================== SHARED VALIDATORS ====================

export const dailyFieldTypeValidator = v.union(
  v.literal("text"),
  v.literal("number")
);

// ==================== TABLE DEFINITIONS ====================

export const dailyFieldsTables = {
  // ==================== FIELD DEFINITIONS ====================
  // Global field definitions - appear on every day
  lifeos_dailyFieldDefinitions: defineTable({
    userId: v.id("users"),
    // Field identification
    name: v.string(), // e.g., "End Day Score", "Journal", "Mood"
    // Field type
    fieldType: dailyFieldTypeValidator, // "text" | "number"
    // Optional configuration
    description: v.optional(v.string()), // Help text for the field
    // For number fields: optional min/max constraints
    minValue: v.optional(v.number()),
    maxValue: v.optional(v.number()),
    // For text fields: optional placeholder
    placeholder: v.optional(v.string()),
    // Ordering for display
    sortOrder: v.number(),
    // Active status (soft delete)
    isActive: v.boolean(),
    // Whether this is a system default field
    isDefault: v.optional(v.boolean()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"]),

  // ==================== DAILY FIELD VALUES ====================
  // Per-day values for each field
  lifeos_dailyFieldValues: defineTable({
    userId: v.id("users"),
    fieldDefinitionId: v.id("lifeos_dailyFieldDefinitions"),
    // Date in YYYY-MM-DD format
    date: v.string(),
    // Value storage (use based on fieldType)
    textValue: v.optional(v.string()),
    numberValue: v.optional(v.number()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_user_field_date", ["userId", "fieldDefinitionId", "date"]),
};
