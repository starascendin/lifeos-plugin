import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * One-time migration to backfill the unified contact system tables.
 * All steps are idempotent - safe to run multiple times.
 */

/**
 * Step 1: Backfill lifeos_contactEmails from existing lifeos_frmPeople.email fields.
 * Scans all people with non-null email and inserts into lifeos_contactEmails.
 */
export const backfillContactEmails = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const people = await ctx.db
      .query("lifeos_frmPeople")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let inserted = 0;
    let skipped = 0;

    for (const person of people) {
      if (!person.email) {
        skipped++;
        continue;
      }

      const normalizedEmail = person.email.toLowerCase().trim();

      // Check if already exists
      const existing = await ctx.db
        .query("lifeos_contactEmails")
        .withIndex("by_user_email", (q) =>
          q.eq("userId", args.userId).eq("email", normalizedEmail)
        )
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("lifeos_contactEmails", {
        userId: args.userId,
        personId: person._id,
        email: normalizedEmail,
        source: "manual",
        isPrimary: true,
        createdAt: Date.now(),
      });
      inserted++;
    }

    return {
      totalPeople: people.length,
      inserted,
      skipped,
    };
  },
});

/**
 * Step 2: Copy existing life_granolaMeetingPersonLinks to lifeos_meetingPersonLinks.
 * Preserves the legacy table for backward compat.
 */
export const backfillGranolaMeetingLinks = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const legacyLinks = await ctx.db
      .query("life_granolaMeetingPersonLinks")
      .withIndex("by_user_meeting", (q) => q.eq("userId", args.userId))
      .collect();

    let inserted = 0;
    let skipped = 0;

    for (const link of legacyLinks) {
      const meetingIdStr = link.meetingId as string;

      // Check if already exists in unified table
      const existing = await ctx.db
        .query("lifeos_meetingPersonLinks")
        .withIndex("by_meeting", (q) =>
          q.eq("meetingSource", "granola").eq("meetingId", meetingIdStr)
        )
        .filter((q) => q.eq(q.field("personId"), link.personId))
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      // Map legacy linkSource to new linkSource
      const linkSource =
        link.linkSource === "ai_suggestion" ? "ai_suggestion" : "manual";

      await ctx.db.insert("lifeos_meetingPersonLinks", {
        userId: args.userId,
        personId: link.personId,
        meetingSource: "granola",
        meetingId: meetingIdStr,
        linkSource: linkSource as "ai_suggestion" | "manual",
        confidence: link.aiConfidence,
        reason: link.aiReason,
        createdAt: link.createdAt,
      });
      inserted++;
    }

    return {
      totalLegacyLinks: legacyLinks.length,
      inserted,
      skipped,
    };
  },
});

/**
 * Run all migration steps for a user.
 */
export const runFullMigration = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Step 1: Backfill contact emails
    const people = await ctx.db
      .query("lifeos_frmPeople")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let emailsInserted = 0;
    let emailsSkipped = 0;

    for (const person of people) {
      if (!person.email) {
        emailsSkipped++;
        continue;
      }

      const normalizedEmail = person.email.toLowerCase().trim();
      const existing = await ctx.db
        .query("lifeos_contactEmails")
        .withIndex("by_user_email", (q) =>
          q.eq("userId", args.userId).eq("email", normalizedEmail)
        )
        .first();

      if (existing) {
        emailsSkipped++;
        continue;
      }

      await ctx.db.insert("lifeos_contactEmails", {
        userId: args.userId,
        personId: person._id,
        email: normalizedEmail,
        source: "manual",
        isPrimary: true,
        createdAt: Date.now(),
      });
      emailsInserted++;
    }

    // Step 2: Backfill granola meeting links
    const legacyLinks = await ctx.db
      .query("life_granolaMeetingPersonLinks")
      .withIndex("by_user_meeting", (q) => q.eq("userId", args.userId))
      .collect();

    let linksInserted = 0;
    let linksSkipped = 0;

    for (const link of legacyLinks) {
      const meetingIdStr = link.meetingId as string;
      const existing = await ctx.db
        .query("lifeos_meetingPersonLinks")
        .withIndex("by_meeting", (q) =>
          q.eq("meetingSource", "granola").eq("meetingId", meetingIdStr)
        )
        .filter((q) => q.eq(q.field("personId"), link.personId))
        .first();

      if (existing) {
        linksSkipped++;
        continue;
      }

      const linkSource =
        link.linkSource === "ai_suggestion" ? "ai_suggestion" : "manual";

      await ctx.db.insert("lifeos_meetingPersonLinks", {
        userId: args.userId,
        personId: link.personId,
        meetingSource: "granola",
        meetingId: meetingIdStr,
        linkSource: linkSource as "ai_suggestion" | "manual",
        confidence: link.aiConfidence,
        reason: link.aiReason,
        createdAt: link.createdAt,
      });
      linksInserted++;
    }

    return {
      emails: {
        totalPeople: people.length,
        inserted: emailsInserted,
        skipped: emailsSkipped,
      },
      meetingLinks: {
        totalLegacyLinks: legacyLinks.length,
        inserted: linksInserted,
        skipped: linksSkipped,
      },
    };
  },
});
