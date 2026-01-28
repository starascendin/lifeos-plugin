import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Calendar Tables
 *
 * Tables for Google Calendar integration.
 * Stores synced calendar events from user's primary Google Calendar.
 */
export const calendarTables = {
  // ==================== CALENDAR EVENTS ====================
  lifeos_calendarEvents: defineTable({
    // User who owns this event
    userId: v.id("users"),
    // Google Calendar event ID (for deduplication)
    googleEventId: v.string(),
    // Calendar ID (usually "primary")
    calendarId: v.string(),
    // Event content
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    // Timing (Unix timestamps in milliseconds)
    startTime: v.number(),
    endTime: v.number(),
    isAllDay: v.boolean(),
    // Original date strings from Google (for timezone handling)
    startDateStr: v.optional(v.string()),
    endDateStr: v.optional(v.string()),
    // Recurrence
    recurringEventId: v.optional(v.string()),
    // Status
    status: v.union(
      v.literal("confirmed"),
      v.literal("tentative"),
      v.literal("cancelled")
    ),
    // Visual
    colorId: v.optional(v.string()),
    // Attendees
    attendeesCount: v.optional(v.number()),
    attendees: v.optional(
      v.array(
        v.object({
          email: v.string(),
          displayName: v.optional(v.string()),
          responseStatus: v.optional(v.string()), // "accepted", "declined", "tentative", "needsAction"
          self: v.optional(v.boolean()), // true if this is the calendar owner
        })
      )
    ),
    isSelfOrganizer: v.optional(v.boolean()),
    // Google's updated timestamp (for sync comparison)
    googleUpdatedAt: v.string(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_google_id", ["userId", "googleEventId"])
    .index("by_user_start_time", ["userId", "startTime"])
    .index("by_user_calendar", ["userId", "calendarId"]),

  // ==================== CALENDAR SYNC STATUS ====================
  lifeos_calendarSyncStatus: defineTable({
    // User who owns this sync status
    userId: v.id("users"),
    // Last sync timestamp
    lastSyncAt: v.optional(v.number()),
    // Sync token for incremental sync (from Google API)
    syncToken: v.optional(v.string()),
    // Sync range
    minDate: v.optional(v.string()),
    maxDate: v.optional(v.string()),
    // Status
    lastSyncError: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
};
