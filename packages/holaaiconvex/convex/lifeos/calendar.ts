import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireUser } from "../_lib/auth";
import { createClerkClient } from "@clerk/backend";
import { Doc, Id } from "../_generated/dataModel";

// ==================== TYPES ====================

interface GoogleCalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string; // "accepted", "declined", "tentative", "needsAction"
  self?: boolean;
}

interface GoogleCalendarEvent {
  id: string;
  status: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  recurringEventId?: string;
  colorId?: string;
  attendees?: GoogleCalendarAttendee[];
  organizer?: { self?: boolean };
  updated: string;
}

// Transformed attendee for storage
interface StoredAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
  self?: boolean;
}

interface GoogleCalendarEventsResponse {
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

// ==================== HELPER FUNCTIONS ====================

function parseGoogleEventTime(
  timeObj: { dateTime?: string; date?: string }
): { timestamp: number; isAllDay: boolean; dateStr: string } {
  if (timeObj.dateTime) {
    return {
      timestamp: new Date(timeObj.dateTime).getTime(),
      isAllDay: false,
      dateStr: timeObj.dateTime,
    };
  }
  if (timeObj.date) {
    // All-day event: date is in YYYY-MM-DD format
    return {
      timestamp: new Date(timeObj.date + "T00:00:00").getTime(),
      isAllDay: true,
      dateStr: timeObj.date,
    };
  }
  throw new Error("Event has no start time");
}

function transformGoogleEvent(
  event: GoogleCalendarEvent,
  calendarId: string
): {
  googleEventId: string;
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  startTime: number;
  endTime: number;
  isAllDay: boolean;
  startDateStr?: string;
  endDateStr?: string;
  recurringEventId?: string;
  status: "confirmed" | "tentative" | "cancelled";
  colorId?: string;
  attendeesCount?: number;
  attendees?: StoredAttendee[];
  isSelfOrganizer?: boolean;
  googleUpdatedAt: string;
} {
  const start = parseGoogleEventTime(event.start);
  const end = parseGoogleEventTime(event.end);

  // Transform attendees - store full details
  const attendees: StoredAttendee[] | undefined = event.attendees?.map((a) => ({
    email: a.email,
    displayName: a.displayName,
    responseStatus: a.responseStatus,
    self: a.self,
  }));

  return {
    googleEventId: event.id,
    calendarId,
    title: event.summary || "(No title)",
    description: event.description,
    location: event.location,
    startTime: start.timestamp,
    endTime: end.timestamp,
    isAllDay: start.isAllDay,
    startDateStr: start.dateStr,
    endDateStr: end.dateStr,
    recurringEventId: event.recurringEventId,
    status: event.status,
    colorId: event.colorId,
    attendeesCount: event.attendees?.length,
    attendees,
    isSelfOrganizer: event.organizer?.self,
    googleUpdatedAt: event.updated,
  };
}

// ==================== MUTATIONS ====================

/**
 * Upsert a single calendar event
 */
export const upsertEvent = mutation({
  args: {
    googleEventId: v.string(),
    calendarId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    isAllDay: v.boolean(),
    startDateStr: v.optional(v.string()),
    endDateStr: v.optional(v.string()),
    recurringEventId: v.optional(v.string()),
    status: v.union(
      v.literal("confirmed"),
      v.literal("tentative"),
      v.literal("cancelled")
    ),
    colorId: v.optional(v.string()),
    attendeesCount: v.optional(v.number()),
    attendees: v.optional(
      v.array(
        v.object({
          email: v.string(),
          displayName: v.optional(v.string()),
          responseStatus: v.optional(v.string()),
          self: v.optional(v.boolean()),
        })
      )
    ),
    isSelfOrganizer: v.optional(v.boolean()),
    googleUpdatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Check if event already exists
    const existing = await ctx.db
      .query("lifeos_calendarEvents")
      .withIndex("by_user_google_id", (q) =>
        q.eq("userId", user._id).eq("googleEventId", args.googleEventId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("lifeos_calendarEvents", {
      userId: user._id,
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Internal mutation for batch upserting events (called from action)
 */
export const upsertEventBatch = internalMutation({
  args: {
    userId: v.id("users"),
    events: v.array(
      v.object({
        googleEventId: v.string(),
        calendarId: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        location: v.optional(v.string()),
        startTime: v.number(),
        endTime: v.number(),
        isAllDay: v.boolean(),
        startDateStr: v.optional(v.string()),
        endDateStr: v.optional(v.string()),
        recurringEventId: v.optional(v.string()),
        status: v.union(
          v.literal("confirmed"),
          v.literal("tentative"),
          v.literal("cancelled")
        ),
        colorId: v.optional(v.string()),
        attendeesCount: v.optional(v.number()),
        attendees: v.optional(
          v.array(
            v.object({
              email: v.string(),
              displayName: v.optional(v.string()),
              responseStatus: v.optional(v.string()),
              self: v.optional(v.boolean()),
            })
          )
        ),
        isSelfOrganizer: v.optional(v.boolean()),
        googleUpdatedAt: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const event of args.events) {
      const existing = await ctx.db
        .query("lifeos_calendarEvents")
        .withIndex("by_user_google_id", (q) =>
          q.eq("userId", args.userId).eq("googleEventId", event.googleEventId)
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...event,
          userId: args.userId,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("lifeos_calendarEvents", {
          userId: args.userId,
          ...event,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  },
});

/**
 * Delete a calendar event by Google ID
 */
export const deleteEvent = mutation({
  args: {
    googleEventId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db
      .query("lifeos_calendarEvents")
      .withIndex("by_user_google_id", (q) =>
        q.eq("userId", user._id).eq("googleEventId", args.googleEventId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Internal mutation for deleting cancelled events
 */
export const deleteEventInternal = internalMutation({
  args: {
    userId: v.id("users"),
    googleEventId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("lifeos_calendarEvents")
      .withIndex("by_user_google_id", (q) =>
        q.eq("userId", args.userId).eq("googleEventId", args.googleEventId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Update calendar sync status
 */
export const updateSyncStatus = internalMutation({
  args: {
    userId: v.id("users"),
    lastSyncAt: v.optional(v.number()),
    syncToken: v.optional(v.string()),
    minDate: v.optional(v.string()),
    maxDate: v.optional(v.string()),
    lastSyncError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("lifeos_calendarSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    const updateData = {
      lastSyncAt: args.lastSyncAt,
      syncToken: args.syncToken,
      minDate: args.minDate,
      maxDate: args.maxDate,
      lastSyncError: args.lastSyncError,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, updateData);
    } else {
      await ctx.db.insert("lifeos_calendarSyncStatus", {
        userId: args.userId,
        ...updateData,
        createdAt: now,
      });
    }
  },
});

// ==================== QUERIES ====================

/**
 * Get calendar events for a specific date
 * @param date - The date in YYYY-MM-DD format (in user's local timezone)
 * @param timezoneOffset - Minutes offset from UTC (from Date.getTimezoneOffset(), e.g., 420 for MST/UTC-7)
 */
export const getEventsForDate = query({
  args: {
    date: v.string(), // YYYY-MM-DD
    timezoneOffset: v.optional(v.number()), // Minutes offset from UTC (positive = west of UTC)
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Calculate day boundaries in user's local timezone
    // If no offset provided, assume UTC (offset = 0)
    const offsetMs = (args.timezoneOffset ?? 0) * 60 * 1000;

    // Create UTC timestamps for the start and end of the day in user's local timezone
    // e.g., for MST (offset=420), "2026-01-19" local = "2026-01-19T07:00:00Z" to "2026-01-20T06:59:59.999Z"
    const dayStartUTC = new Date(args.date + "T00:00:00Z").getTime() + offsetMs;
    const dayEndUTC = new Date(args.date + "T23:59:59.999Z").getTime() + offsetMs;

    // Get all events for this user that overlap with the day
    const events = await ctx.db
      .query("lifeos_calendarEvents")
      .withIndex("by_user_start_time", (q) =>
        q.eq("userId", user._id).gte("startTime", dayStartUTC - 86400000) // Include events that might span into this day
      )
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "cancelled"),
          // Event overlaps with the day: starts before day end AND ends after day start
          q.lt(q.field("startTime"), dayEndUTC),
          q.gt(q.field("endTime"), dayStartUTC)
        )
      )
      .collect();

    // Sort by start time
    return events.sort((a, b) => a.startTime - b.startTime);
  },
});

/**
 * Get calendar events for a date range (for weekly view)
 * @param startDate - Start date in YYYY-MM-DD format (in user's local timezone)
 * @param endDate - End date in YYYY-MM-DD format (in user's local timezone)
 * @param timezoneOffset - Minutes offset from UTC (from Date.getTimezoneOffset(), e.g., 420 for MST/UTC-7)
 */
export const getEventsForDateRange = query({
  args: {
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD
    timezoneOffset: v.optional(v.number()), // Minutes offset from UTC (positive = west of UTC)
  },
  handler: async (ctx, args): Promise<Record<string, Doc<"lifeos_calendarEvents">[]>> => {
    const user = await requireUser(ctx);

    // Calculate range boundaries in user's local timezone
    const offsetMs = (args.timezoneOffset ?? 0) * 60 * 1000;
    const rangeStartUTC = new Date(args.startDate + "T00:00:00Z").getTime() + offsetMs;
    const rangeEndUTC = new Date(args.endDate + "T23:59:59.999Z").getTime() + offsetMs;

    const events = await ctx.db
      .query("lifeos_calendarEvents")
      .withIndex("by_user_start_time", (q) =>
        q.eq("userId", user._id).gte("startTime", rangeStartUTC - 86400000)
      )
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "cancelled"),
          q.lt(q.field("startTime"), rangeEndUTC),
          q.gt(q.field("endTime"), rangeStartUTC)
        )
      )
      .collect();

    // Group events by date in user's local timezone
    const eventsByDate: Record<string, Doc<"lifeos_calendarEvents">[]> = {};

    for (const event of events) {
      // Convert event start time to user's local date
      // Subtract offset to convert from UTC to local time for date calculation
      const localTimestamp = event.startTime - offsetMs;
      const localDate = new Date(localTimestamp);
      const dateKey = localDate.toISOString().split("T")[0];

      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }
      eventsByDate[dateKey].push(event);
    }

    // Sort events within each day
    for (const dateKey of Object.keys(eventsByDate)) {
      eventsByDate[dateKey].sort((a, b) => a.startTime - b.startTime);
    }

    return eventsByDate;
  },
});

/**
 * Get calendar sync status
 */
export const getSyncStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("lifeos_calendarSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
  },
});

// ==================== ACTIONS ====================

/**
 * Sync calendar events from Google Calendar API
 */
export const syncCalendarEvents = action({
  args: {
    startDate: v.optional(v.string()), // YYYY-MM-DD, default: today - 7 days
    endDate: v.optional(v.string()), // YYYY-MM-DD, default: today + 30 days
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    eventsCount: number;
    startDate: string;
    endDate: string;
  }> => {
    console.log("[calendar:syncCalendarEvents] Starting sync...");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.error("[calendar:syncCalendarEvents] Not authenticated");
      throw new Error("Not authenticated");
    }
    console.log("[calendar:syncCalendarEvents] User identity subject:", identity.subject);

    // Get user from database
    const user = (await ctx.runQuery(internal.common.users.getUserByTokenIdentifier, {
      tokenIdentifier: identity.tokenIdentifier,
    })) as { _id: Id<"users"> } | null;
    if (!user) {
      console.error("[calendar:syncCalendarEvents] User not found for tokenIdentifier:", identity.tokenIdentifier);
      throw new Error("User not found");
    }
    console.log("[calendar:syncCalendarEvents] Found user:", user._id);

    // Calculate date range
    const now = new Date();
    const defaultStartDate = new Date(now);
    defaultStartDate.setDate(defaultStartDate.getDate() - 7);
    const defaultEndDate = new Date(now);
    defaultEndDate.setDate(defaultEndDate.getDate() + 30);

    const startDate = args.startDate || defaultStartDate.toISOString().split("T")[0];
    const endDate = args.endDate || defaultEndDate.toISOString().split("T")[0];

    // Get Google OAuth token
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      console.error("[calendar:syncCalendarEvents] CLERK_SECRET_KEY not configured");
      throw new Error("CLERK_SECRET_KEY not configured");
    }
    console.log("[calendar:syncCalendarEvents] CLERK_SECRET_KEY is configured");

    const clerk = createClerkClient({ secretKey });
    console.log("[calendar:syncCalendarEvents] Fetching OAuth token for user:", identity.subject);

    let tokens;
    try {
      tokens = await clerk.users.getUserOauthAccessToken(
        identity.subject,
        "oauth_google"
      );
      console.log("[calendar:syncCalendarEvents] OAuth tokens response:", JSON.stringify({
        hasData: !!tokens.data,
        tokenCount: tokens.data?.length || 0,
        scopes: tokens.data?.[0]?.scopes || []
      }));
    } catch (oauthError) {
      console.error("[calendar:syncCalendarEvents] OAuth error:", oauthError);
      throw new Error(`Failed to get OAuth token: ${oauthError instanceof Error ? oauthError.message : String(oauthError)}`);
    }

    if (!tokens.data || tokens.data.length === 0) {
      console.error("[calendar:syncCalendarEvents] No OAuth token found for user");
      await ctx.runMutation(internal.lifeos.calendar.updateSyncStatus, {
        userId: user._id,
        lastSyncError: "No Google OAuth token found. Please sign out and sign in again with Google.",
      });
      throw new Error("No Google OAuth token found. Please sign out and sign in again with Google.");
    }

    const accessToken = tokens.data[0].token;
    console.log("[calendar:syncCalendarEvents] Got access token, length:", accessToken?.length || 0);

    try {
      // Fetch events from Google Calendar
      const timeMin = `${startDate}T00:00:00Z`;
      const timeMax = `${endDate}T23:59:59Z`;

      const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", "250");

      console.log("[calendar:syncCalendarEvents] Fetching from Google Calendar API:", url.toString());

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log("[calendar:syncCalendarEvents] Google API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[calendar:syncCalendarEvents] Google Calendar API error:", response.status, errorText);
        await ctx.runMutation(internal.lifeos.calendar.updateSyncStatus, {
          userId: user._id,
          lastSyncError: `Google Calendar API error: ${response.status} ${errorText}`,
        });
        throw new Error(`Google Calendar API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as GoogleCalendarEventsResponse;

      // Transform and upsert events
      type TransformedEvent = ReturnType<typeof transformGoogleEvent>;
      const events: TransformedEvent[] = data.items
        .filter((event) => event.status !== "cancelled")
        .map((event) => transformGoogleEvent(event, "primary"));

      // Delete cancelled events
      const cancelledEvents = data.items.filter((event) => event.status === "cancelled");
      for (const event of cancelledEvents) {
        await ctx.runMutation(internal.lifeos.calendar.deleteEventInternal, {
          userId: user._id,
          googleEventId: event.id,
        });
      }

      // Batch upsert events
      if (events.length > 0) {
        await ctx.runMutation(internal.lifeos.calendar.upsertEventBatch, {
          userId: user._id,
          events,
        });
      }

      // Update sync status
      await ctx.runMutation(internal.lifeos.calendar.updateSyncStatus, {
        userId: user._id,
        lastSyncAt: Date.now(),
        minDate: startDate,
        maxDate: endDate,
        lastSyncError: undefined,
        syncToken: data.nextSyncToken,
      });

      return {
        success: true,
        eventsCount: events.length,
        startDate,
        endDate,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error("[calendar:syncCalendarEvents] Catch block error:", errorMessage);
      console.error("[calendar:syncCalendarEvents] Error stack:", errorStack);
      await ctx.runMutation(internal.lifeos.calendar.updateSyncStatus, {
        userId: user._id,
        lastSyncError: errorMessage,
      });
      throw error;
    }
  },
});
