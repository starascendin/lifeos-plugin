import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";

// ==================== QUERIES ====================

/**
 * Get all meetings for the authenticated user
 */
export const getMeetings = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 50;

    return await ctx.db
      .query("life_granolaMeetings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get a single meeting by Granola document ID
 */
export const getMeetingByGranolaId = query({
  args: {
    granolaDocId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("life_granolaMeetings")
      .withIndex("by_user_granola_doc_id", (q) =>
        q.eq("userId", user._id).eq("granolaDocId", args.granolaDocId)
      )
      .unique();
  },
});

/**
 * Get transcript for a meeting
 */
export const getTranscript = query({
  args: {
    meetingId: v.id("life_granolaMeetings"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting || meeting.userId !== user._id) {
      throw new Error("Meeting not found or access denied");
    }

    return await ctx.db
      .query("life_granolaTranscripts")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .unique();
  },
});

/**
 * Get all synced Granola document IDs (for deduplication check)
 */
export const getSyncedDocIds = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const meetings = await ctx.db
      .query("life_granolaMeetings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return meetings.map((m) => m.granolaDocId);
  },
});

/**
 * Get sync status for the authenticated user
 */
export const getSyncStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("life_granolaSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
  },
});

/**
 * Search meetings by title or resume content
 */
export const searchMeetings = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 20;

    // Search by title
    const titleResults = await ctx.db
      .query("life_granolaMeetings")
      .withSearchIndex("search_title", (q) =>
        q.search("title", args.query).eq("userId", user._id)
      )
      .take(limit);

    // Search by resume content
    const resumeResults = await ctx.db
      .query("life_granolaMeetings")
      .withSearchIndex("search_resume", (q) =>
        q.search("resumeMarkdown", args.query).eq("userId", user._id)
      )
      .take(limit);

    // Deduplicate results
    const seen = new Set<string>();
    const combined = [];

    for (const meeting of [...titleResults, ...resumeResults]) {
      if (!seen.has(meeting._id)) {
        seen.add(meeting._id);
        combined.push(meeting);
      }
    }

    return combined.slice(0, limit);
  },
});

// ==================== MUTATIONS ====================

/**
 * Upsert a meeting (create or update based on granolaDocId)
 */
export const upsertMeeting = mutation({
  args: {
    granolaDocId: v.string(),
    title: v.string(),
    workspaceId: v.optional(v.string()),
    workspaceName: v.optional(v.string()),
    resumeMarkdown: v.optional(v.string()),
    hasTranscript: v.boolean(),
    // Accept null for folders since client may send null instead of undefined
    folders: v.optional(
      v.union(
        v.null(),
        v.array(
          v.object({
            id: v.string(),
            name: v.string(),
          })
        )
      )
    ),
    granolaCreatedAt: v.string(),
    granolaUpdatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Normalize null to undefined for storage
    const foldersNormalized = args.folders ?? undefined;

    // Check if meeting already exists
    const existing = await ctx.db
      .query("life_granolaMeetings")
      .withIndex("by_user_granola_doc_id", (q) =>
        q.eq("userId", user._id).eq("granolaDocId", args.granolaDocId)
      )
      .unique();

    if (existing) {
      // Update existing meeting
      await ctx.db.patch(existing._id, {
        title: args.title,
        workspaceId: args.workspaceId,
        workspaceName: args.workspaceName,
        resumeMarkdown: args.resumeMarkdown,
        hasTranscript: args.hasTranscript,
        folders: foldersNormalized,
        granolaUpdatedAt: args.granolaUpdatedAt,
        updatedAt: now,
        lastSyncedAt: now,
      });
      return { id: existing._id, isNew: false };
    }

    // Insert new meeting
    const id = await ctx.db.insert("life_granolaMeetings", {
      userId: user._id,
      granolaDocId: args.granolaDocId,
      title: args.title,
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName,
      resumeMarkdown: args.resumeMarkdown,
      hasTranscript: args.hasTranscript,
      folders: foldersNormalized,
      granolaCreatedAt: args.granolaCreatedAt,
      granolaUpdatedAt: args.granolaUpdatedAt,
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
    });

    return { id, isNew: true };
  },
});

/**
 * Batch upsert meetings
 */
export const upsertMeetingsBatch = mutation({
  args: {
    meetings: v.array(
      v.object({
        granolaDocId: v.string(),
        title: v.string(),
        workspaceId: v.optional(v.string()),
        workspaceName: v.optional(v.string()),
        resumeMarkdown: v.optional(v.string()),
        hasTranscript: v.boolean(),
        // Accept null for folders since client may send null instead of undefined
        folders: v.optional(
          v.union(
            v.null(),
            v.array(
              v.object({
                id: v.string(),
                name: v.string(),
              })
            )
          )
        ),
        granolaCreatedAt: v.string(),
        granolaUpdatedAt: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    let insertedCount = 0;
    let updatedCount = 0;

    for (const meeting of args.meetings) {
      const existing = await ctx.db
        .query("life_granolaMeetings")
        .withIndex("by_user_granola_doc_id", (q) =>
          q.eq("userId", user._id).eq("granolaDocId", meeting.granolaDocId)
        )
        .unique();

      // Normalize null to undefined for storage
      const foldersNormalized = meeting.folders ?? undefined;

      if (existing) {
        await ctx.db.patch(existing._id, {
          title: meeting.title,
          workspaceId: meeting.workspaceId,
          workspaceName: meeting.workspaceName,
          resumeMarkdown: meeting.resumeMarkdown,
          hasTranscript: meeting.hasTranscript,
          folders: foldersNormalized,
          granolaUpdatedAt: meeting.granolaUpdatedAt,
          updatedAt: now,
          lastSyncedAt: now,
        });
        updatedCount++;
      } else {
        await ctx.db.insert("life_granolaMeetings", {
          userId: user._id,
          granolaDocId: meeting.granolaDocId,
          title: meeting.title,
          workspaceId: meeting.workspaceId,
          workspaceName: meeting.workspaceName,
          resumeMarkdown: meeting.resumeMarkdown,
          hasTranscript: meeting.hasTranscript,
          folders: foldersNormalized,
          granolaCreatedAt: meeting.granolaCreatedAt,
          granolaUpdatedAt: meeting.granolaUpdatedAt,
          createdAt: now,
          updatedAt: now,
          lastSyncedAt: now,
        });
        insertedCount++;
      }
    }

    return { insertedCount, updatedCount };
  },
});

/**
 * Upsert a transcript for a meeting
 */
export const upsertTranscript = mutation({
  args: {
    meetingId: v.id("life_granolaMeetings"),
    granolaDocId: v.string(),
    transcriptMarkdown: v.string(),
    utterances: v.array(
      v.object({
        source: v.string(),
        text: v.string(),
        startTimestamp: v.optional(v.string()),
        endTimestamp: v.optional(v.string()),
        confidence: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Verify meeting exists and belongs to user
    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting || meeting.userId !== user._id) {
      throw new Error("Meeting not found or access denied");
    }

    // Check if transcript already exists
    const existing = await ctx.db
      .query("life_granolaTranscripts")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        transcriptMarkdown: args.transcriptMarkdown,
        utterances: args.utterances,
        updatedAt: now,
      });
      return { id: existing._id, isNew: false };
    }

    const id = await ctx.db.insert("life_granolaTranscripts", {
      userId: user._id,
      meetingId: args.meetingId,
      granolaDocId: args.granolaDocId,
      transcriptMarkdown: args.transcriptMarkdown,
      utterances: args.utterances,
      createdAt: now,
      updatedAt: now,
    });

    return { id, isNew: true };
  },
});

/**
 * Update sync status
 */
export const updateSyncStatus = mutation({
  args: {
    lastSyncAt: v.optional(v.number()),
    lastSyncMeetingCount: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
    isSyncing: v.optional(v.boolean()),
    autoSyncEnabled: v.optional(v.boolean()),
    autoSyncIntervalMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("life_granolaSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new sync status record
    const id = await ctx.db.insert("life_granolaSyncStatus", {
      userId: user._id,
      lastSyncAt: args.lastSyncAt,
      lastSyncMeetingCount: args.lastSyncMeetingCount,
      lastSyncError: args.lastSyncError,
      isSyncing: args.isSyncing ?? false,
      autoSyncEnabled: args.autoSyncEnabled ?? true,
      autoSyncIntervalMinutes: args.autoSyncIntervalMinutes ?? 10,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * Delete a meeting and its transcript
 */
export const deleteMeeting = mutation({
  args: {
    meetingId: v.id("life_granolaMeetings"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting || meeting.userId !== user._id) {
      throw new Error("Meeting not found or access denied");
    }

    // Delete associated transcript if exists
    const transcript = await ctx.db
      .query("life_granolaTranscripts")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .unique();

    if (transcript) {
      await ctx.db.delete(transcript._id);
    }

    // Delete associated meeting links (thread links)
    const links = await ctx.db
      .query("life_granolaMeetingLinks")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .collect();

    for (const link of links) {
      await ctx.db.delete(link._id);
    }

    // Delete associated person links
    const personLinks = await ctx.db
      .query("life_granolaMeetingPersonLinks")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .collect();

    for (const link of personLinks) {
      await ctx.db.delete(link._id);
    }

    // Delete associated calendar links
    const calendarLinks = await ctx.db
      .query("life_granolaCalendarLinks")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .collect();

    for (const link of calendarLinks) {
      await ctx.db.delete(link._id);
    }

    await ctx.db.delete(args.meetingId);

    return { success: true };
  },
});

// ==================== MEETING LINKS ====================

/**
 * Get all links for a meeting
 */
export const getMeetingLinks = query({
  args: {
    meetingId: v.id("life_granolaMeetings"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting || meeting.userId !== user._id) {
      throw new Error("Meeting not found or access denied");
    }

    const links = await ctx.db
      .query("life_granolaMeetingLinks")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .collect();

    // Enrich with thread info
    const enrichedLinks = await Promise.all(
      links.map(async (link) => {
        const thread = await ctx.db.get(link.beeperThreadId);
        return {
          ...link,
          threadName: thread?.threadName,
          threadType: thread?.threadType,
        };
      })
    );

    return enrichedLinks;
  },
});

/**
 * Get all meetings linked to a Beeper thread
 */
export const getMeetingsForThread = query({
  args: {
    beeperThreadId: v.id("lifeos_beeperThreads"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify thread belongs to user - return empty array if not found or no access
    const thread = await ctx.db.get(args.beeperThreadId);
    if (!thread || thread.userId !== user._id) {
      return []; // Gracefully return empty instead of throwing
    }

    const links = await ctx.db
      .query("life_granolaMeetingLinks")
      .withIndex("by_beeperThread", (q) => q.eq("beeperThreadId", args.beeperThreadId))
      .collect();

    // Enrich with meeting info
    const enrichedLinks = await Promise.all(
      links.map(async (link) => {
        const meeting = await ctx.db.get(link.meetingId);
        return {
          ...link,
          meetingTitle: meeting?.title,
          meetingDate: meeting?.granolaCreatedAt,
          hasTranscript: meeting?.hasTranscript,
        };
      })
    );

    return enrichedLinks.filter((l) => l.meetingTitle); // Filter out deleted meetings
  },
});

/**
 * Link a meeting to a Beeper thread
 */
export const linkMeetingToThread = mutation({
  args: {
    meetingId: v.id("life_granolaMeetings"),
    beeperThreadId: v.id("lifeos_beeperThreads"),
    linkSource: v.union(v.literal("ai_suggestion"), v.literal("manual")),
    aiConfidence: v.optional(v.number()),
    aiReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Verify meeting belongs to user
    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting || meeting.userId !== user._id) {
      throw new Error("Meeting not found or access denied");
    }

    // Verify thread belongs to user
    const thread = await ctx.db.get(args.beeperThreadId);
    if (!thread || thread.userId !== user._id) {
      throw new Error("Thread not found or access denied");
    }

    // Check if link already exists
    const existing = await ctx.db
      .query("life_granolaMeetingLinks")
      .withIndex("by_user_meeting", (q) =>
        q.eq("userId", user._id).eq("meetingId", args.meetingId)
      )
      .filter((q) => q.eq(q.field("beeperThreadId"), args.beeperThreadId))
      .first();

    if (existing) {
      return { id: existing._id, isNew: false };
    }

    // Create the link
    const id = await ctx.db.insert("life_granolaMeetingLinks", {
      userId: user._id,
      meetingId: args.meetingId,
      beeperThreadId: args.beeperThreadId,
      linkSource: args.linkSource,
      aiConfidence: args.aiConfidence,
      aiReason: args.aiReason,
      createdAt: now,
    });

    return { id, isNew: true };
  },
});

/**
 * Unlink a meeting from a Beeper thread
 */
export const unlinkMeetingFromThread = mutation({
  args: {
    meetingId: v.id("life_granolaMeetings"),
    beeperThreadId: v.id("lifeos_beeperThreads"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const link = await ctx.db
      .query("life_granolaMeetingLinks")
      .withIndex("by_user_meeting", (q) =>
        q.eq("userId", user._id).eq("meetingId", args.meetingId)
      )
      .filter((q) => q.eq(q.field("beeperThreadId"), args.beeperThreadId))
      .first();

    if (!link) {
      throw new Error("Link not found");
    }

    await ctx.db.delete(link._id);

    return { success: true };
  },
});

/**
 * Delete a specific link by ID
 */
export const deleteMeetingLink = mutation({
  args: {
    linkId: v.id("life_granolaMeetingLinks"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const link = await ctx.db.get(args.linkId);
    if (!link || link.userId !== user._id) {
      throw new Error("Link not found or access denied");
    }

    await ctx.db.delete(args.linkId);

    return { success: true };
  },
});

// ==================== MEETING PERSON LINKS ====================

/**
 * Get all person links for a meeting
 */
export const getMeetingPersonLinks = query({
  args: {
    meetingId: v.id("life_granolaMeetings"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting || meeting.userId !== user._id) {
      throw new Error("Meeting not found or access denied");
    }

    const links = await ctx.db
      .query("life_granolaMeetingPersonLinks")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .collect();

    // Enrich with person info
    const enrichedLinks = await Promise.all(
      links.map(async (link) => {
        const person = await ctx.db.get(link.personId);
        return {
          ...link,
          personName: person?.name,
          personNickname: person?.nickname,
          relationshipType: person?.relationshipType,
          avatarEmoji: person?.avatarEmoji,
        };
      })
    );

    return enrichedLinks;
  },
});

/**
 * Get all meetings linked to a Person
 */
export const getMeetingsForPerson = query({
  args: {
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify person belongs to user - return empty array if not found or no access
    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      return [];
    }

    const links = await ctx.db
      .query("life_granolaMeetingPersonLinks")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .collect();

    // Enrich with meeting info
    const enrichedLinks = await Promise.all(
      links.map(async (link) => {
        const meeting = await ctx.db.get(link.meetingId);
        return {
          ...link,
          meetingTitle: meeting?.title,
          meetingDate: meeting?.granolaCreatedAt,
          hasTranscript: meeting?.hasTranscript,
        };
      })
    );

    return enrichedLinks.filter((l) => l.meetingTitle); // Filter out deleted meetings
  },
});

/**
 * Link a meeting to a Person (manual link)
 */
export const linkMeetingToPerson = mutation({
  args: {
    meetingId: v.id("life_granolaMeetings"),
    personId: v.id("lifeos_frmPeople"),
    linkSource: v.union(v.literal("ai_suggestion"), v.literal("manual")),
    aiConfidence: v.optional(v.number()),
    aiReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Verify meeting belongs to user
    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting || meeting.userId !== user._id) {
      throw new Error("Meeting not found or access denied");
    }

    // Verify person belongs to user
    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      throw new Error("Person not found or access denied");
    }

    // Check if link already exists
    const existing = await ctx.db
      .query("life_granolaMeetingPersonLinks")
      .withIndex("by_user_meeting", (q) =>
        q.eq("userId", user._id).eq("meetingId", args.meetingId)
      )
      .filter((q) => q.eq(q.field("personId"), args.personId))
      .first();

    if (existing) {
      return { id: existing._id, isNew: false };
    }

    // Create the link
    const id = await ctx.db.insert("life_granolaMeetingPersonLinks", {
      userId: user._id,
      meetingId: args.meetingId,
      personId: args.personId,
      linkSource: args.linkSource,
      aiConfidence: args.aiConfidence,
      aiReason: args.aiReason,
      createdAt: now,
    });

    return { id, isNew: true };
  },
});

/**
 * Unlink a meeting from a Person
 */
export const unlinkMeetingFromPerson = mutation({
  args: {
    meetingId: v.id("life_granolaMeetings"),
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const link = await ctx.db
      .query("life_granolaMeetingPersonLinks")
      .withIndex("by_user_meeting", (q) =>
        q.eq("userId", user._id).eq("meetingId", args.meetingId)
      )
      .filter((q) => q.eq(q.field("personId"), args.personId))
      .first();

    if (!link) {
      throw new Error("Link not found");
    }

    await ctx.db.delete(link._id);

    return { success: true };
  },
});

/**
 * Delete a specific person link by ID
 */
export const deleteMeetingPersonLink = mutation({
  args: {
    linkId: v.id("life_granolaMeetingPersonLinks"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const link = await ctx.db.get(args.linkId);
    if (!link || link.userId !== user._id) {
      throw new Error("Link not found or access denied");
    }

    await ctx.db.delete(args.linkId);

    return { success: true };
  },
});

// ==================== MEETING CALENDAR LINKS ====================

/**
 * Get all calendar links for a meeting
 */
export const getMeetingCalendarLinks = query({
  args: {
    meetingId: v.id("life_granolaMeetings"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting || meeting.userId !== user._id) {
      throw new Error("Meeting not found or access denied");
    }

    const links = await ctx.db
      .query("life_granolaCalendarLinks")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .collect();

    // Enrich with calendar event info
    const enrichedLinks = await Promise.all(
      links.map(async (link) => {
        const event = await ctx.db.get(link.calendarEventId);
        return {
          ...link,
          eventTitle: event?.title,
          eventStartTime: event?.startTime,
          eventEndTime: event?.endTime,
          eventLocation: event?.location,
          eventAttendees: event?.attendees,
          eventAttendeesCount: event?.attendeesCount,
        };
      })
    );

    return enrichedLinks;
  },
});

/**
 * Find calendar events that overlap with a meeting's timestamp
 * Uses the meeting's granolaCreatedAt to find events that were happening around that time
 */
export const findCalendarEventsForMeeting = query({
  args: {
    meetingId: v.id("life_granolaMeetings"),
    bufferMinutes: v.optional(v.number()), // Buffer time in minutes (default: 30)
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting || meeting.userId !== user._id) {
      throw new Error("Meeting not found or access denied");
    }

    // Parse the meeting's created timestamp
    const meetingTimestamp = new Date(meeting.granolaCreatedAt).getTime();
    const bufferMs = (args.bufferMinutes ?? 30) * 60 * 1000;

    // Find events that overlap with the meeting time
    // Event overlaps if: event.startTime <= meetingTime + buffer AND event.endTime >= meetingTime - buffer
    const searchStart = meetingTimestamp - bufferMs;
    const searchEnd = meetingTimestamp + bufferMs;

    // Get calendar events around this time
    const events = await ctx.db
      .query("lifeos_calendarEvents")
      .withIndex("by_user_start_time", (q) =>
        q.eq("userId", user._id).gte("startTime", searchStart - 86400000) // Look back 24 hours for long events
      )
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "cancelled"),
          // Event overlaps with search window
          q.lte(q.field("startTime"), searchEnd),
          q.gte(q.field("endTime"), searchStart)
        )
      )
      .collect();

    // Check which events are already linked
    const existingLinks = await ctx.db
      .query("life_granolaCalendarLinks")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .collect();

    const linkedEventIds = new Set(existingLinks.map((l) => l.calendarEventId));

    // Calculate match confidence based on time overlap
    const suggestions = events
      .filter((event) => !linkedEventIds.has(event._id))
      .map((event) => {
        // Calculate how well the meeting time fits within the event
        const isWithinEvent =
          meetingTimestamp >= event.startTime && meetingTimestamp <= event.endTime;
        const timeDiff = Math.abs(
          meetingTimestamp - (event.startTime + event.endTime) / 2
        );
        const eventDuration = event.endTime - event.startTime;

        // Higher confidence if meeting timestamp is within the event
        let confidence = isWithinEvent ? 0.9 : 0.5;
        // Adjust based on how close to the event center
        if (eventDuration > 0) {
          confidence -= (timeDiff / eventDuration) * 0.3;
        }
        confidence = Math.max(0.3, Math.min(1, confidence));

        return {
          event,
          confidence,
          reason: isWithinEvent
            ? "Meeting recorded during this calendar event"
            : "Meeting recorded near this calendar event time",
        };
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Return top 5 suggestions

    return {
      meetingTimestamp,
      meetingTitle: meeting.title,
      suggestions,
    };
  },
});

/**
 * Link a meeting to a calendar event
 */
export const linkMeetingToCalendarEvent = mutation({
  args: {
    meetingId: v.id("life_granolaMeetings"),
    calendarEventId: v.id("lifeos_calendarEvents"),
    linkSource: v.union(
      v.literal("auto_time_match"),
      v.literal("ai_suggestion"),
      v.literal("manual")
    ),
    matchConfidence: v.optional(v.number()),
    matchReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Verify meeting belongs to user
    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting || meeting.userId !== user._id) {
      throw new Error("Meeting not found or access denied");
    }

    // Verify calendar event belongs to user
    const event = await ctx.db.get(args.calendarEventId);
    if (!event || event.userId !== user._id) {
      throw new Error("Calendar event not found or access denied");
    }

    // Check if link already exists
    const existing = await ctx.db
      .query("life_granolaCalendarLinks")
      .withIndex("by_user_meeting", (q) =>
        q.eq("userId", user._id).eq("meetingId", args.meetingId)
      )
      .filter((q) => q.eq(q.field("calendarEventId"), args.calendarEventId))
      .first();

    if (existing) {
      return { id: existing._id, isNew: false };
    }

    // Create the link
    const id = await ctx.db.insert("life_granolaCalendarLinks", {
      userId: user._id,
      meetingId: args.meetingId,
      calendarEventId: args.calendarEventId,
      linkSource: args.linkSource,
      matchConfidence: args.matchConfidence,
      matchReason: args.matchReason,
      createdAt: now,
    });

    return { id, isNew: true };
  },
});

/**
 * Delete a specific calendar link by ID
 */
export const deleteMeetingCalendarLink = mutation({
  args: {
    linkId: v.id("life_granolaCalendarLinks"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const link = await ctx.db.get(args.linkId);
    if (!link || link.userId !== user._id) {
      throw new Error("Link not found or access denied");
    }

    await ctx.db.delete(args.linkId);

    return { success: true };
  },
});

/**
 * Suggest Beeper contacts based on calendar event attendees
 * Matches attendee emails/names against Beeper thread names
 */
export const suggestBeeperContactsFromCalendarEvent = query({
  args: {
    calendarEventId: v.id("lifeos_calendarEvents"),
    meetingId: v.optional(v.id("life_granolaMeetings")), // Optional: to filter out already linked
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Get the calendar event
    const event = await ctx.db.get(args.calendarEventId);
    if (!event || event.userId !== user._id) {
      throw new Error("Calendar event not found or access denied");
    }

    // Get event details
    const attendees = event.attendees || [];
    const attendeesCount = event.attendeesCount || attendees.length;
    const isOneOnOne = attendeesCount <= 2; // Including self
    const isGroupMeeting = attendeesCount > 2;

    // Get external attendees (not self)
    const externalAttendees = attendees.filter((a) => !a.self);

    if (externalAttendees.length === 0) {
      return {
        event: {
          title: event.title,
          startTime: event.startTime,
          endTime: event.endTime,
          attendeesCount,
          isOneOnOne,
          isGroupMeeting,
        },
        suggestions: [],
      };
    }

    // Get all business Beeper threads for the user
    const beeperThreads = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_business", (q) =>
        q.eq("userId", user._id).eq("isBusinessChat", true)
      )
      .collect();

    // Get existing meeting links if meetingId provided
    let linkedThreadIds = new Set<string>();
    const meetingId = args.meetingId;
    if (meetingId) {
      const existingLinks = await ctx.db
        .query("life_granolaMeetingLinks")
        .withIndex("by_user_meeting", (q) =>
          q.eq("userId", user._id).eq("meetingId", meetingId)
        )
        .collect();
      linkedThreadIds = new Set(existingLinks.map((l) => l.beeperThreadId.toString()));
    }

    // Match attendees to Beeper threads
    const suggestions: Array<{
      threadId: string;
      threadName: string;
      threadType: "dm" | "group";
      matchedAttendee: {
        email: string;
        displayName?: string;
      };
      confidence: number;
      reason: string;
    }> = [];

    for (const attendee of externalAttendees) {
      const attendeeEmail = attendee.email.toLowerCase();
      const attendeeName = attendee.displayName?.toLowerCase() || "";
      // Extract username from email (part before @)
      const emailUsername = attendeeEmail.split("@")[0];

      for (const thread of beeperThreads) {
        // Skip already linked threads
        if (linkedThreadIds.has(thread._id.toString())) continue;

        const threadNameLower = thread.threadName.toLowerCase();

        let confidence = 0;
        let reason = "";

        // Exact name match
        if (attendeeName && threadNameLower === attendeeName) {
          confidence = 0.95;
          reason = `Exact name match: "${attendee.displayName}"`;
        }
        // Name contains match
        else if (attendeeName && threadNameLower.includes(attendeeName)) {
          confidence = 0.8;
          reason = `Thread name contains "${attendee.displayName}"`;
        }
        // Thread name contains attendee name
        else if (attendeeName && attendeeName.includes(threadNameLower)) {
          confidence = 0.75;
          reason = `"${attendee.displayName}" contains thread name`;
        }
        // Email username matches thread name
        else if (threadNameLower.includes(emailUsername) && emailUsername.length > 3) {
          confidence = 0.6;
          reason = `Thread matches email username: ${emailUsername}`;
        }
        // First name match (if display name has multiple words)
        else if (attendeeName) {
          const firstName = attendeeName.split(" ")[0];
          if (firstName.length > 2 && threadNameLower.includes(firstName)) {
            confidence = 0.5;
            reason = `First name match: "${firstName}"`;
          }
        }

        if (confidence > 0) {
          // Check if we already have this thread in suggestions
          const existingIdx = suggestions.findIndex((s) => s.threadId === thread._id.toString());
          if (existingIdx === -1 || suggestions[existingIdx].confidence < confidence) {
            if (existingIdx !== -1) {
              suggestions.splice(existingIdx, 1);
            }
            suggestions.push({
              threadId: thread._id.toString(),
              threadName: thread.threadName,
              threadType: thread.threadType as "dm" | "group",
              matchedAttendee: {
                email: attendee.email,
                displayName: attendee.displayName,
              },
              confidence,
              reason,
            });
          }
        }
      }
    }

    // Sort by confidence and return top results
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return {
      event: {
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        attendeesCount,
        isOneOnOne,
        isGroupMeeting,
      },
      suggestions: suggestions.slice(0, 10),
    };
  },
});
