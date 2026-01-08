import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Inspiration Chrome Extension Tables
 *
 * Tables for the inspiration_ext Chrome extension that allows users
 * to save webpages as inspiration links with notes and tags.
 */
export const inspirationTables = {
  // ==================== INSPIRATION ITEMS ====================
  ext_insp_items: defineTable({
    // Reference to the user who saved this
    userId: v.id("users"),
    // The saved URL
    url: v.string(),
    // Page title
    title: v.string(),
    // User's notes about this inspiration
    notes: v.optional(v.string()),
    // Favicon URL for display
    favicon: v.optional(v.string()),
    // Open Graph image for preview
    ogImage: v.optional(v.string()),
    // Extracted domain for filtering (e.g., "youtube.com")
    domain: v.string(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_domain", ["userId", "domain"]),

  // ==================== TAGS ====================
  ext_insp_tags: defineTable({
    // Reference to the user who created this tag
    userId: v.id("users"),
    // Tag name
    name: v.string(),
    // Optional hex color for display (e.g., "#FF5733")
    color: v.optional(v.string()),
    // Timestamp
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_name", ["userId", "name"]),

  // ==================== ITEM-TAG JUNCTION ====================
  ext_insp_item_tags: defineTable({
    // Reference to the inspiration item
    itemId: v.id("ext_insp_items"),
    // Reference to the tag
    tagId: v.id("ext_insp_tags"),
  })
    .index("by_item", ["itemId"])
    .index("by_tag", ["tagId"]),
};
