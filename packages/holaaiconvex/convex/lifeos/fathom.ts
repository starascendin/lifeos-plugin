import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { requireUser } from "../_lib/auth";
import { Id } from "../_generated/dataModel";

// ==================== QUERIES ====================

/**
 * Get all Fathom meetings for the authenticated user
 */
export const getMeetings = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 50;

    return await ctx.db
      .query("life_fathomMeetings")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get transcript for a Fathom meeting
 */
export const getTranscript = query({
  args: {
    meetingId: v.id("life_fathomMeetings"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting || meeting.userId !== user._id) {
      throw new Error("Meeting not found or access denied");
    }

    return await ctx.db
      .query("life_fathomTranscripts")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .unique();
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
      .query("life_fathomSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
  },
});

/**
 * Search Fathom meetings by title or summary content
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
      .query("life_fathomMeetings")
      .withSearchIndex("search_title", (q) =>
        q.search("title", args.query).eq("userId", user._id)
      )
      .take(limit);

    // Search by summary content
    const summaryResults = await ctx.db
      .query("life_fathomMeetings")
      .withSearchIndex("search_summary", (q) =>
        q.search("summaryMarkdown", args.query).eq("userId", user._id)
      )
      .take(limit);

    // Deduplicate results
    const seen = new Set<string>();
    const combined = [];

    for (const meeting of [...titleResults, ...summaryResults]) {
      if (!seen.has(meeting._id)) {
        seen.add(meeting._id);
        combined.push(meeting);
      }
    }

    return combined.slice(0, limit);
  },
});

// ==================== INTERNAL QUERIES (for action use) ====================

export const getSyncStatusInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("life_fathomSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const getMeetingByRecordingIdInternal = internalQuery({
  args: {
    userId: v.id("users"),
    fathomRecordingId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("life_fathomMeetings")
      .withIndex("by_user_fathom_recording_id", (q) =>
        q
          .eq("userId", args.userId)
          .eq("fathomRecordingId", args.fathomRecordingId)
      )
      .unique();
  },
});

// ==================== INTERNAL MUTATIONS (for action use) ====================

export const upsertMeetingsBatchInternal = internalMutation({
  args: {
    userId: v.id("users"),
    meetings: v.array(
      v.object({
        fathomRecordingId: v.string(),
        title: v.string(),
        fathomUrl: v.optional(v.string()),
        shareUrl: v.optional(v.string()),
        recordedByEmail: v.optional(v.string()),
        transcriptLanguage: v.optional(v.string()),
        calendarInvitees: v.optional(
          v.array(
            v.object({
              email: v.string(),
              name: v.optional(v.string()),
            })
          )
        ),
        summaryMarkdown: v.optional(v.string()),
        summaryTemplateName: v.optional(v.string()),
        actionItems: v.optional(v.array(v.string())),
        hasTranscript: v.boolean(),
        scheduledStartTime: v.optional(v.string()),
        scheduledEndTime: v.optional(v.string()),
        recordingStartTime: v.optional(v.string()),
        recordingEndTime: v.optional(v.string()),
        fathomCreatedAt: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let insertedCount = 0;
    let updatedCount = 0;

    for (const meeting of args.meetings) {
      const existing = await ctx.db
        .query("life_fathomMeetings")
        .withIndex("by_user_fathom_recording_id", (q) =>
          q
            .eq("userId", args.userId)
            .eq("fathomRecordingId", meeting.fathomRecordingId)
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          title: meeting.title,
          fathomUrl: meeting.fathomUrl,
          shareUrl: meeting.shareUrl,
          recordedByEmail: meeting.recordedByEmail,
          transcriptLanguage: meeting.transcriptLanguage,
          calendarInvitees: meeting.calendarInvitees,
          summaryMarkdown: meeting.summaryMarkdown,
          summaryTemplateName: meeting.summaryTemplateName,
          actionItems: meeting.actionItems,
          hasTranscript: meeting.hasTranscript,
          scheduledStartTime: meeting.scheduledStartTime,
          scheduledEndTime: meeting.scheduledEndTime,
          recordingStartTime: meeting.recordingStartTime,
          recordingEndTime: meeting.recordingEndTime,
          updatedAt: now,
          lastSyncedAt: now,
        });
        updatedCount++;
      } else {
        await ctx.db.insert("life_fathomMeetings", {
          userId: args.userId,
          fathomRecordingId: meeting.fathomRecordingId,
          title: meeting.title,
          fathomUrl: meeting.fathomUrl,
          shareUrl: meeting.shareUrl,
          recordedByEmail: meeting.recordedByEmail,
          transcriptLanguage: meeting.transcriptLanguage,
          calendarInvitees: meeting.calendarInvitees,
          summaryMarkdown: meeting.summaryMarkdown,
          summaryTemplateName: meeting.summaryTemplateName,
          actionItems: meeting.actionItems,
          hasTranscript: meeting.hasTranscript,
          scheduledStartTime: meeting.scheduledStartTime,
          scheduledEndTime: meeting.scheduledEndTime,
          recordingStartTime: meeting.recordingStartTime,
          recordingEndTime: meeting.recordingEndTime,
          fathomCreatedAt: meeting.fathomCreatedAt,
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

export const upsertTranscriptInternal = internalMutation({
  args: {
    userId: v.id("users"),
    meetingId: v.id("life_fathomMeetings"),
    fathomRecordingId: v.string(),
    transcriptText: v.string(),
    utterances: v.array(
      v.object({
        speakerName: v.string(),
        speakerEmail: v.optional(v.string()),
        text: v.string(),
        timestamp: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("life_fathomTranscripts")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        transcriptText: args.transcriptText,
        utterances: args.utterances,
        updatedAt: now,
      });
      return { id: existing._id, isNew: false };
    }

    const id = await ctx.db.insert("life_fathomTranscripts", {
      userId: args.userId,
      meetingId: args.meetingId,
      fathomRecordingId: args.fathomRecordingId,
      transcriptText: args.transcriptText,
      utterances: args.utterances,
      createdAt: now,
      updatedAt: now,
    });

    return { id, isNew: true };
  },
});

export const updateSyncStatusInternal = internalMutation({
  args: {
    userId: v.id("users"),
    lastSyncAt: v.optional(v.number()),
    lastSyncMeetingCount: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
    isSyncing: v.optional(v.boolean()),
    lastSyncCursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { userId, ...updates } = args;

    const existing = await ctx.db
      .query("life_fathomSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...updates,
        updatedAt: now,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("life_fathomSyncStatus", {
      userId,
      lastSyncAt: updates.lastSyncAt,
      lastSyncMeetingCount: updates.lastSyncMeetingCount,
      lastSyncError: updates.lastSyncError,
      isSyncing: updates.isSyncing ?? false,
      lastSyncCursor: updates.lastSyncCursor,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

// ==================== PUBLIC MUTATIONS ====================

/**
 * Delete a Fathom meeting and its transcript
 */
export const deleteMeeting = mutation({
  args: {
    meetingId: v.id("life_fathomMeetings"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting || meeting.userId !== user._id) {
      throw new Error("Meeting not found or access denied");
    }

    // Delete associated transcript if exists
    const transcript = await ctx.db
      .query("life_fathomTranscripts")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .unique();

    if (transcript) {
      await ctx.db.delete(transcript._id);
    }

    await ctx.db.delete(args.meetingId);

    return { success: true };
  },
});

// ==================== FATHOM API TYPES ====================

interface FathomTranscriptItem {
  speaker: {
    display_name: string;
    matched_calendar_invitee_email?: string;
  };
  text: string;
  timestamp: string;
}

interface FathomActionItem {
  description: string;
  user_generated?: boolean;
  completed?: boolean;
  recording_timestamp?: string;
  recording_playback_url?: string;
  assignee?: {
    name?: string;
    email?: string;
    team?: string;
  };
}

interface FathomCalendarInvitee {
  email?: string;
  name?: string;
  email_domain?: string;
  is_external?: boolean;
  matched_speaker_display_name?: string;
}

interface FathomSummary {
  template_name?: string;
  markdown_formatted?: string;
}

interface FathomMeeting {
  title?: string;
  meeting_title?: string;
  recording_id: number | string;
  url?: string;
  share_url?: string;
  created_at: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  recording_start_time?: string;
  recording_end_time?: string;
  transcript_language?: string;
  recorded_by?: { name?: string; email?: string; email_domain?: string; team?: string };
  calendar_invitees?: FathomCalendarInvitee[];
  transcript?: FathomTranscriptItem[];
  default_summary?: FathomSummary;
  action_items?: FathomActionItem[];
}

interface FathomListResponse {
  items: FathomMeeting[];
  next_cursor?: string | null;
  limit?: number | null;
}

// ==================== SYNC ACTION ====================

/**
 * Sync meetings from Fathom API.
 * Reads FATHOM_API_KEY from environment.
 * Supports incremental sync via lastSyncCursor (created_after param).
 */
export const syncFathomMeetings = action({
  args: {
    fullSync: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    meetingsCount: number;
    insertedCount: number;
    updatedCount: number;
    error?: string;
  }> => {
    console.log("[fathom:sync] Starting Fathom sync...");

    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = (await ctx.runQuery(
      internal.common.users.getUserByTokenIdentifier,
      { tokenIdentifier: identity.tokenIdentifier }
    )) as { _id: Id<"users"> } | null;
    if (!user) {
      throw new Error("User not found");
    }
    const userId = user._id;

    // Get API key
    const apiKey = process.env.FATHOM_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.lifeos.fathom.updateSyncStatusInternal, {
        userId,
        isSyncing: false,
        lastSyncError: "FATHOM_API_KEY environment variable not set",
      });
      return {
        success: false,
        meetingsCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        error: "FATHOM_API_KEY not set",
      };
    }

    // Set syncing status
    await ctx.runMutation(internal.lifeos.fathom.updateSyncStatusInternal, {
      userId,
      isSyncing: true,
      lastSyncError: undefined,
    });

    try {
      // Get sync cursor for incremental sync
      let createdAfter: string | undefined;
      if (!args.fullSync) {
        const syncStatus = await ctx.runQuery(
          internal.lifeos.fathom.getSyncStatusInternal,
          { userId }
        );
        createdAfter = syncStatus?.lastSyncCursor ?? undefined;
      }

      const baseUrl = "https://api.fathom.ai/external/v1";
      let cursor: string | undefined;
      let totalMeetings = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      let latestCreatedAt: string | undefined;

      // Paginate through all meetings
      do {
        const params = new URLSearchParams({
          include_transcript: "true",
          include_summary: "true",
          include_action_items: "true",
        });
        if (createdAfter) {
          params.set("created_after", createdAfter);
        }
        if (cursor) {
          params.set("cursor", cursor);
        }

        console.log(
          `[fathom:sync] Fetching page${cursor ? ` (cursor: ${cursor})` : ""}...`
        );
        const response = await fetch(
          `${baseUrl}/meetings?${params.toString()}`,
          {
            headers: {
              "X-Api-Key": apiKey,
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Fathom API error ${response.status}: ${errorText}`
          );
        }

        const data: FathomListResponse = await response.json();
        const meetings = data.items || [];

        if (meetings.length === 0) {
          console.log("[fathom:sync] No more meetings to process");
          break;
        }

        console.log(
          `[fathom:sync] Processing ${meetings.length} meetings...`
        );

        // Transform meetings for upsert
        const transformedMeetings = meetings.map((m) => {
          const title = m.meeting_title || m.title || "Untitled Meeting";
          const recordingId = String(m.recording_id);

          // Track latest created_at for cursor
          if (
            !latestCreatedAt ||
            m.created_at > latestCreatedAt
          ) {
            latestCreatedAt = m.created_at;
          }

          return {
            fathomRecordingId: recordingId,
            title,
            fathomUrl: m.url || undefined,
            shareUrl: m.share_url || undefined,
            recordedByEmail: m.recorded_by?.email || undefined,
            transcriptLanguage: m.transcript_language || undefined,
            calendarInvitees: m.calendar_invitees
              ?.filter((i): i is typeof i & { email: string } => !!i.email)
              .map((i) => ({
                email: i.email,
                name: i.name || undefined,
              })),
            summaryMarkdown: m.default_summary?.markdown_formatted || undefined,
            summaryTemplateName: m.default_summary?.template_name || undefined,
            actionItems: m.action_items
              ?.map((item) => item.description)
              .filter((d): d is string => !!d),
            hasTranscript: !!(m.transcript && m.transcript.length > 0),
            scheduledStartTime: m.scheduled_start_time || undefined,
            scheduledEndTime: m.scheduled_end_time || undefined,
            recordingStartTime: m.recording_start_time || undefined,
            recordingEndTime: m.recording_end_time || undefined,
            fathomCreatedAt: m.created_at,
          };
        });

        // Batch upsert meetings
        const result = await ctx.runMutation(
          internal.lifeos.fathom.upsertMeetingsBatchInternal,
          {
            userId,
            meetings: transformedMeetings,
          }
        );
        totalInserted += result.insertedCount;
        totalUpdated += result.updatedCount;
        totalMeetings += meetings.length;

        // Upsert transcripts and auto-match attendees
        for (const m of meetings) {
          const recordingId = String(m.recording_id);

          // Look up the meeting to get its Convex ID
          const existingMeeting = await ctx.runQuery(
            internal.lifeos.fathom.getMeetingByRecordingIdInternal,
            { userId, fathomRecordingId: recordingId }
          );

          if (!existingMeeting) continue;

          // Upsert transcript if available
          if (m.transcript && m.transcript.length > 0) {
            const utterances = m.transcript.map((t) => ({
              speakerName: t.speaker.display_name || "Unknown",
              speakerEmail:
                t.speaker.matched_calendar_invitee_email || undefined,
              text: t.text,
              timestamp: t.timestamp,
            }));

            const transcriptText = utterances
              .map((u) => `${u.speakerName}: ${u.text}`)
              .join("\n");

            await ctx.runMutation(
              internal.lifeos.fathom.upsertTranscriptInternal,
              {
                userId,
                meetingId: existingMeeting._id,
                fathomRecordingId: recordingId,
                transcriptText,
                utterances,
              }
            );
          }

          // Auto-match calendar invitees to contacts
          const invitees = m.calendar_invitees?.filter(
            (i): i is typeof i & { email: string } => !!i.email
          );
          if (invitees && invitees.length > 0) {
            try {
              await ctx.runMutation(
                internal.lifeos.contact_matching
                  .autoMatchMeetingAttendees,
                {
                  userId,
                  userEmail: m.recorded_by?.email,
                  meetingSource: "fathom",
                  meetingId: existingMeeting._id as string,
                  attendees: invitees.map((i) => ({
                    email: i.email,
                    name: i.name || undefined,
                  })),
                }
              );
            } catch (e) {
              console.warn(
                `[fathom:sync] Failed to auto-match attendees for meeting ${recordingId}:`,
                e
              );
            }
          }
        }

        cursor = data.next_cursor ?? undefined;
      } while (cursor);

      // Update sync status on success
      await ctx.runMutation(
        internal.lifeos.fathom.updateSyncStatusInternal,
        {
          userId,
          isSyncing: false,
          lastSyncAt: Date.now(),
          lastSyncMeetingCount: totalMeetings,
          lastSyncError: undefined,
          lastSyncCursor: latestCreatedAt,
        }
      );

      console.log(
        `[fathom:sync] Sync complete: ${totalMeetings} meetings (${totalInserted} new, ${totalUpdated} updated)`
      );

      return {
        success: true,
        meetingsCount: totalMeetings,
        insertedCount: totalInserted,
        updatedCount: totalUpdated,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      console.error("[fathom:sync] Sync error:", errorMsg);

      await ctx.runMutation(
        internal.lifeos.fathom.updateSyncStatusInternal,
        {
          userId,
          isSyncing: false,
          lastSyncError: errorMsg,
        }
      );

      return {
        success: false,
        meetingsCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        error: errorMsg,
      };
    }
  },
});
