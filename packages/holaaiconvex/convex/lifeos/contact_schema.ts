import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Unified Contact System Tables
 *
 * Enables email-based identity matching across data sources
 * (Fathom, Granola, Calendar, Beeper) and unified meeting-person linking.
 *
 * Key design:
 * - lifeos_contactEmails: O(1) email→person lookup (Convex can't index arrays)
 * - lifeos_meetingPersonLinks: Unified meeting links for ALL meeting apps (Granola, Fathom, etc.)
 */

// ==================== VALIDATORS ====================

export const emailSourceValidator = v.union(
  v.literal("manual"),
  v.literal("fathom"),
  v.literal("granola"),
  v.literal("calendar"),
  v.literal("beeper")
);

export const meetingSourceValidator = v.union(
  v.literal("granola"),
  v.literal("fathom")
);

export const meetingLinkSourceValidator = v.union(
  v.literal("auto_email"),
  v.literal("auto_name"),
  v.literal("ai_suggestion"),
  v.literal("manual")
);

// ==================== TABLE DEFINITIONS ====================

export const contactTables = {
  // ==================== CONTACT EMAILS ====================
  // Separate table for O(1) email→person lookup
  // (Convex can't index into arrays, so we use a separate table)
  lifeos_contactEmails: defineTable({
    userId: v.id("users"),
    personId: v.id("lifeos_frmPeople"),
    email: v.string(), // normalized lowercase
    source: emailSourceValidator,
    isPrimary: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_person", ["personId"])
    .index("by_user_email", ["userId", "email"]),

  // ==================== UNIFIED MEETING-PERSON LINKS ====================
  // Unified table for linking persons to meetings from ANY source (Granola, Fathom, etc.)
  lifeos_meetingPersonLinks: defineTable({
    userId: v.id("users"),
    personId: v.id("lifeos_frmPeople"),
    meetingSource: meetingSourceValidator,
    // Store as string since we can't union v.id() types for different tables
    meetingId: v.string(),
    linkSource: meetingLinkSourceValidator,
    confidence: v.optional(v.number()), // 0-1
    reason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_person", ["personId"])
    .index("by_person_source", ["personId", "meetingSource"])
    .index("by_meeting", ["meetingSource", "meetingId"])
    .index("by_user", ["userId"]),
};
