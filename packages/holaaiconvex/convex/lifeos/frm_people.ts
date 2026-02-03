import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { requireUser } from "../_lib/auth";
import { relationshipTypeValidator } from "./frm_schema";

// ==================== QUERIES ====================

/**
 * Get all people for the authenticated user
 */
export const getPeople = query({
  args: {
    includeArchived: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 100;

    let people = await ctx.db
      .query("lifeos_frmPeople")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    if (!args.includeArchived) {
      people = people.filter((p) => !p.archivedAt);
    }

    // Sort by last interaction (most recent first), then by name
    people.sort((a, b) => {
      if (a.lastInteractionAt && b.lastInteractionAt) {
        return b.lastInteractionAt - a.lastInteractionAt;
      }
      if (a.lastInteractionAt) return -1;
      if (b.lastInteractionAt) return 1;
      return a.name.localeCompare(b.name);
    });

    return people;
  },
});

/**
 * Get a single person by ID with their latest profile
 */
export const getPerson = query({
  args: {
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      return null;
    }

    // Get the latest completed profile
    const profiles = await ctx.db
      .query("lifeos_frmProfiles")
      .withIndex("by_person_version", (q) => q.eq("personId", args.personId))
      .order("desc")
      .take(1);

    const latestProfile =
      profiles.length > 0 && profiles[0].status === "completed"
        ? profiles[0]
        : null;

    return {
      ...person,
      profile: latestProfile,
    };
  },
});

/**
 * Search people by name
 */
export const searchPeople = query({
  args: {
    searchQuery: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 20;

    if (!args.searchQuery.trim()) {
      return [];
    }

    const results = await ctx.db
      .query("lifeos_frmPeople")
      .withSearchIndex("search_name", (q) =>
        q.search("name", args.searchQuery).eq("userId", user._id)
      )
      .take(limit);

    // Filter out archived
    return results.filter((p) => !p.archivedAt);
  },
});

/**
 * Get all known email addresses for a person (from unified contact system)
 */
export const getContactEmails = query({
  args: {
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      return [];
    }

    const emails = await ctx.db
      .query("lifeos_contactEmails")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .collect();

    return emails.map((e) => ({
      email: e.email,
      source: e.source,
      isPrimary: e.isPrimary,
    }));
  },
});

/**
 * Get all meetings linked to a person from the unified meeting system.
 * Currently returns Fathom meetings only.
 */
export const getPersonMeetings = query({
  args: {
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      return [];
    }

    const links = await ctx.db
      .query("lifeos_meetingPersonLinks")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .collect();

    const fathomLinks = links.filter((l) => l.meetingSource === "fathom");

    const meetings = await Promise.all(
      fathomLinks.map(async (link) => {
        try {
          const meeting = await ctx.db.get(
            link.meetingId as Id<"life_fathomMeetings">
          );
          if (!meeting) return null;
          return {
            meetingId: meeting._id,
            title: meeting.title,
            fathomCreatedAt: meeting.fathomCreatedAt,
            fathomUrl: meeting.fathomUrl,
            summaryMarkdown: meeting.summaryMarkdown?.slice(0, 500),
            actionItems: meeting.actionItems,
            attendeeCount: meeting.calendarInvitees?.length ?? 0,
          };
        } catch {
          return null;
        }
      })
    );

    return meetings.filter(Boolean);
  },
});

/**
 * Get all linked sources for a person - unified view of all data sources.
 * Returns: Beeper threads, Granola meetings, Fathom meetings, contact emails, and origin info.
 */
export const getPersonLinkedSources = query({
  args: {
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      return null;
    }

    // Get Beeper threads linked to this person
    const beeperThreads = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_linkedPerson", (q) => q.eq("linkedPersonId", args.personId))
      .collect();
    const filteredBeeperThreads = beeperThreads.filter(
      (t) => t.userId === user._id
    );

    // Get Granola meetings linked to this person
    const granolaPersonLinks = await ctx.db
      .query("life_granolaMeetingPersonLinks")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .collect();

    const granolaMeetings = await Promise.all(
      granolaPersonLinks.map(async (link) => {
        try {
          const meeting = await ctx.db.get(link.meetingId);
          if (!meeting) return null;
          return {
            meetingId: meeting._id,
            granolaDocId: meeting.granolaDocId,
            title: meeting.title,
            granolaCreatedAt: meeting.granolaCreatedAt,
            resumeMarkdown: meeting.resumeMarkdown?.slice(0, 300),
            linkSource: link.linkSource,
            aiConfidence: link.aiConfidence,
          };
        } catch {
          return null;
        }
      })
    );

    // Get Fathom meetings via unified meeting links
    const meetingLinks = await ctx.db
      .query("lifeos_meetingPersonLinks")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .collect();

    const fathomLinks = meetingLinks.filter((l) => l.meetingSource === "fathom");
    const fathomMeetings = await Promise.all(
      fathomLinks.map(async (link) => {
        try {
          const meeting = await ctx.db.get(
            link.meetingId as Id<"life_fathomMeetings">
          );
          if (!meeting) return null;
          return {
            meetingId: meeting._id,
            title: meeting.title,
            fathomCreatedAt: meeting.fathomCreatedAt,
            fathomUrl: meeting.fathomUrl,
            attendeeCount: meeting.calendarInvitees?.length ?? 0,
          };
        } catch {
          return null;
        }
      })
    );

    // Get contact emails
    const emails = await ctx.db
      .query("lifeos_contactEmails")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .collect();

    // Build sources summary
    const sources: string[] = [];
    if (person.autoCreatedFrom) {
      sources.push(person.autoCreatedFrom);
    }
    if (filteredBeeperThreads.length > 0 && !sources.includes("beeper")) {
      sources.push("beeper");
    }
    if (granolaMeetings.filter(Boolean).length > 0 && !sources.includes("granola")) {
      sources.push("granola");
    }
    if (fathomMeetings.filter(Boolean).length > 0 && !sources.includes("fathom")) {
      sources.push("fathom");
    }
    // Check email sources
    for (const email of emails) {
      if (!sources.includes(email.source)) {
        sources.push(email.source);
      }
    }

    return {
      personId: args.personId,
      autoCreatedFrom: person.autoCreatedFrom,
      sources,
      beeperThreads: filteredBeeperThreads.map((t) => ({
        _id: t._id,
        threadId: t.threadId,
        threadName: t.threadName,
        threadType: t.threadType,
        messageCount: t.messageCount,
        lastMessageAt: t.lastMessageAt,
        businessNote: t.businessNote,
      })),
      granolaMeetings: granolaMeetings.filter(Boolean),
      fathomMeetings: fathomMeetings.filter(Boolean),
      emails: emails.map((e) => ({
        email: e.email,
        source: e.source,
        isPrimary: e.isPrimary,
      })),
    };
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new person (minimal data - just name)
 */
export const createPerson = mutation({
  args: {
    name: v.string(),
    nickname: v.optional(v.string()),
    relationshipType: v.optional(relationshipTypeValidator),
    avatarEmoji: v.optional(v.string()),
    color: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const personId = await ctx.db.insert("lifeos_frmPeople", {
      userId: user._id,
      name: args.name.trim(),
      nickname: args.nickname?.trim(),
      relationshipType: args.relationshipType,
      avatarEmoji: args.avatarEmoji,
      color: args.color,
      notes: args.notes?.trim(),
      memoCount: 0,
      lastInteractionAt: undefined,
      createdAt: now,
      updatedAt: now,
      archivedAt: undefined,
    });

    return personId;
  },
});

/**
 * Update a person's details
 */
export const updatePerson = mutation({
  args: {
    personId: v.id("lifeos_frmPeople"),
    name: v.optional(v.string()),
    nickname: v.optional(v.string()),
    relationshipType: v.optional(relationshipTypeValidator),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    avatarEmoji: v.optional(v.string()),
    color: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      throw new Error("Person not found or access denied");
    }

    const updates: Partial<typeof person> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.nickname !== undefined) updates.nickname = args.nickname.trim();
    if (args.relationshipType !== undefined)
      updates.relationshipType = args.relationshipType;
    if (args.email !== undefined) updates.email = args.email.trim();
    if (args.phone !== undefined) updates.phone = args.phone.trim();
    if (args.avatarEmoji !== undefined) updates.avatarEmoji = args.avatarEmoji;
    if (args.color !== undefined) updates.color = args.color;
    if (args.notes !== undefined) updates.notes = args.notes.trim();

    await ctx.db.patch(args.personId, updates);
    return args.personId;
  },
});

/**
 * Archive a person (soft delete)
 */
export const archivePerson = mutation({
  args: {
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      throw new Error("Person not found or access denied");
    }

    await ctx.db.patch(args.personId, {
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return args.personId;
  },
});

/**
 * Restore an archived person
 */
export const restorePerson = mutation({
  args: {
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      throw new Error("Person not found or access denied");
    }

    await ctx.db.patch(args.personId, {
      archivedAt: undefined,
      updatedAt: Date.now(),
    });

    return args.personId;
  },
});

/**
 * Permanently delete a person and all related data
 */
export const deletePerson = mutation({
  args: {
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      throw new Error("Person not found or access denied");
    }

    // Delete all related person-memo links
    const memoLinks = await ctx.db
      .query("lifeos_frmPersonMemos")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .collect();

    for (const link of memoLinks) {
      await ctx.db.delete(link._id);
    }

    // Delete all related profiles
    const profiles = await ctx.db
      .query("lifeos_frmProfiles")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .collect();

    for (const profile of profiles) {
      await ctx.db.delete(profile._id);
    }

    // Delete all timeline entries
    const timelineEntries = await ctx.db
      .query("lifeos_frmTimeline")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .collect();

    for (const entry of timelineEntries) {
      await ctx.db.delete(entry._id);
    }

    // Delete the person
    await ctx.db.delete(args.personId);

    return args.personId;
  },
});
