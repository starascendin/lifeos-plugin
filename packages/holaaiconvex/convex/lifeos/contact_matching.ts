import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import {
  emailSourceValidator,
  meetingSourceValidator,
  meetingLinkSourceValidator,
} from "./contact_schema";

// ==================== QUERIES ====================

/**
 * Resolve a contact by email address.
 * 1. Check lifeos_contactEmails table (primary lookup)
 * 2. Fallback: check lifeos_frmPeople.email field (backward compat)
 */
export const resolveContactByEmail = internalQuery({
  args: {
    userId: v.id("users"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();

    // Primary: check contact emails table
    const emailRecord = await ctx.db
      .query("lifeos_contactEmails")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", args.userId).eq("email", normalizedEmail)
      )
      .first();

    if (emailRecord) {
      return emailRecord.personId;
    }

    // Fallback: check frmPeople.email field directly
    const people = await ctx.db
      .query("lifeos_frmPeople")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", args.userId).eq("email", normalizedEmail)
      )
      .first();

    return people?._id ?? null;
  },
});

// ==================== MUTATIONS ====================

/**
 * Resolve an existing contact by email, or create a new one.
 * Returns { personId, isNew }.
 */
export const resolveOrCreateContact = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    displayName: v.optional(v.string()),
    source: emailSourceValidator,
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();

    // 1. Check contact emails table
    const emailRecord = await ctx.db
      .query("lifeos_contactEmails")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", args.userId).eq("email", normalizedEmail)
      )
      .first();

    if (emailRecord) {
      return { personId: emailRecord.personId, isNew: false };
    }

    // 2. Fallback: check frmPeople.email field
    const existingPerson = await ctx.db
      .query("lifeos_frmPeople")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", args.userId).eq("email", normalizedEmail)
      )
      .first();

    if (existingPerson) {
      // Also add to contact emails table for future lookups
      await ctx.db.insert("lifeos_contactEmails", {
        userId: args.userId,
        personId: existingPerson._id,
        email: normalizedEmail,
        source: args.source,
        isPrimary: true,
        createdAt: Date.now(),
      });
      return { personId: existingPerson._id, isNew: false };
    }

    // 3. Create new person
    const now = Date.now();
    const name =
      args.displayName || normalizedEmail.split("@")[0].replace(/[._-]/g, " ");

    const personId = await ctx.db.insert("lifeos_frmPeople", {
      userId: args.userId,
      name,
      email: normalizedEmail,
      relationshipType: "colleague",
      autoCreatedFrom: args.source !== "manual" ? args.source : undefined,
      memoCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Insert email record
    await ctx.db.insert("lifeos_contactEmails", {
      userId: args.userId,
      personId,
      email: normalizedEmail,
      source: args.source,
      isPrimary: true,
      createdAt: now,
    });

    return { personId, isNew: true };
  },
});

/**
 * Add an email to an existing contact (deduplicates by userId + email).
 */
export const addEmailToContact = internalMutation({
  args: {
    userId: v.id("users"),
    personId: v.id("lifeos_frmPeople"),
    email: v.string(),
    source: emailSourceValidator,
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();

    // Check if this user+email pair already exists
    const existing = await ctx.db
      .query("lifeos_contactEmails")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", args.userId).eq("email", normalizedEmail)
      )
      .first();

    if (existing) {
      return { id: existing._id, isNew: false };
    }

    // Check if this person already has any emails (to decide isPrimary)
    const existingForPerson = await ctx.db
      .query("lifeos_contactEmails")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .first();

    const id = await ctx.db.insert("lifeos_contactEmails", {
      userId: args.userId,
      personId: args.personId,
      email: normalizedEmail,
      source: args.source,
      isPrimary: !existingForPerson,
      createdAt: Date.now(),
    });

    return { id, isNew: true };
  },
});

/**
 * Link a meeting to a person (deduplicates by person + meetingSource + meetingId).
 */
export const linkMeetingToPerson = internalMutation({
  args: {
    userId: v.id("users"),
    personId: v.id("lifeos_frmPeople"),
    meetingSource: meetingSourceValidator,
    meetingId: v.string(),
    linkSource: meetingLinkSourceValidator,
    confidence: v.optional(v.number()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Dedup: check if this exact link already exists
    const existing = await ctx.db
      .query("lifeos_meetingPersonLinks")
      .withIndex("by_meeting", (q) =>
        q.eq("meetingSource", args.meetingSource).eq("meetingId", args.meetingId)
      )
      .filter((q) => q.eq(q.field("personId"), args.personId))
      .first();

    if (existing) {
      return { id: existing._id, isNew: false };
    }

    const id = await ctx.db.insert("lifeos_meetingPersonLinks", {
      userId: args.userId,
      personId: args.personId,
      meetingSource: args.meetingSource,
      meetingId: args.meetingId,
      linkSource: args.linkSource,
      confidence: args.confidence,
      reason: args.reason,
      createdAt: Date.now(),
    });

    return { id, isNew: true };
  },
});

/**
 * Auto-match meeting attendees to contacts.
 * For each attendee: resolve or create contact, then link to the meeting.
 * Skips the user's own email.
 */
export const autoMatchMeetingAttendees = internalMutation({
  args: {
    userId: v.id("users"),
    userEmail: v.optional(v.string()),
    meetingSource: meetingSourceValidator,
    meetingId: v.string(),
    attendees: v.array(
      v.object({
        email: v.string(),
        name: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userEmailLower = args.userEmail?.toLowerCase().trim();
    let matched = 0;
    let created = 0;
    let skipped = 0;

    for (const attendee of args.attendees) {
      const email = attendee.email.toLowerCase().trim();

      // Skip self
      if (userEmailLower && email === userEmailLower) {
        skipped++;
        continue;
      }

      // Skip empty emails
      if (!email) {
        skipped++;
        continue;
      }

      // Resolve or create contact
      // Inline the logic since we can't call other mutations from a mutation
      const normalizedEmail = email;

      // Check contact emails table
      let personId: Id<"lifeos_frmPeople"> | null = null;
      let isNew = false;

      const emailRecord = await ctx.db
        .query("lifeos_contactEmails")
        .withIndex("by_user_email", (q) =>
          q.eq("userId", args.userId).eq("email", normalizedEmail)
        )
        .first();

      if (emailRecord) {
        personId = emailRecord.personId;
      } else {
        // Fallback: check frmPeople.email field
        const existingPerson = await ctx.db
          .query("lifeos_frmPeople")
          .withIndex("by_user_email", (q) =>
            q.eq("userId", args.userId).eq("email", normalizedEmail)
          )
          .first();

        if (existingPerson) {
          personId = existingPerson._id;
          // Backfill contact emails table
          await ctx.db.insert("lifeos_contactEmails", {
            userId: args.userId,
            personId: existingPerson._id,
            email: normalizedEmail,
            source: args.meetingSource,
            isPrimary: true,
            createdAt: Date.now(),
          });
        } else {
          // Create new person
          const now = Date.now();
          const name =
            attendee.name ||
            normalizedEmail.split("@")[0].replace(/[._-]/g, " ");

          personId = await ctx.db.insert("lifeos_frmPeople", {
            userId: args.userId,
            name,
            email: normalizedEmail,
            relationshipType: "colleague",
            autoCreatedFrom: args.meetingSource,
            memoCount: 0,
            createdAt: now,
            updatedAt: now,
          });

          await ctx.db.insert("lifeos_contactEmails", {
            userId: args.userId,
            personId,
            email: normalizedEmail,
            source: args.meetingSource,
            isPrimary: true,
            createdAt: now,
          });

          isNew = true;
        }
      }

      // Link meeting to person (dedup)
      const existingLink = await ctx.db
        .query("lifeos_meetingPersonLinks")
        .withIndex("by_meeting", (q) =>
          q
            .eq("meetingSource", args.meetingSource)
            .eq("meetingId", args.meetingId)
        )
        .filter((q) => q.eq(q.field("personId"), personId))
        .first();

      if (!existingLink) {
        await ctx.db.insert("lifeos_meetingPersonLinks", {
          userId: args.userId,
          personId: personId!,
          meetingSource: args.meetingSource,
          meetingId: args.meetingId,
          linkSource: "auto_email",
          confidence: 1.0,
          reason: `Matched by email: ${normalizedEmail}`,
          createdAt: Date.now(),
        });
      }

      if (isNew) {
        created++;
      } else {
        matched++;
      }
    }

    return { matched, created, skipped };
  },
});
