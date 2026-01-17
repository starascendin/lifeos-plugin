import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";

// ==================== QUERIES ====================

/**
 * Get all memos linked to a person
 */
export const getMemosForPerson = query({
  args: {
    personId: v.id("lifeos_frmPeople"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 50;

    // Verify person belongs to user
    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      return [];
    }

    // Get memo links
    const links = await ctx.db
      .query("lifeos_frmPersonMemos")
      .withIndex("by_person_created", (q) => q.eq("personId", args.personId))
      .order("desc")
      .take(limit);

    // Get actual memos with their data
    const memos = await Promise.all(
      links.map(async (link) => {
        const memo = await ctx.db.get(link.voiceMemoId);
        if (!memo || memo.userId !== user._id) return null;
        return {
          ...memo,
          linkId: link._id,
          context: link.context,
          linkedAt: link.createdAt,
        };
      })
    );

    return memos.filter(Boolean);
  },
});

/**
 * Get timeline entries for all people (or a specific person)
 */
export const getTimeline = query({
  args: {
    personId: v.optional(v.id("lifeos_frmPeople")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 50;

    let entries;
    if (args.personId) {
      // Verify person belongs to user
      const person = await ctx.db.get(args.personId);
      if (!person || person.userId !== user._id) {
        return [];
      }

      entries = await ctx.db
        .query("lifeos_frmTimeline")
        .withIndex("by_person_interaction", (q) =>
          q.eq("personId", args.personId!)
        )
        .order("desc")
        .take(limit);
    } else {
      entries = await ctx.db
        .query("lifeos_frmTimeline")
        .withIndex("by_user_interaction", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(limit);
    }

    return entries;
  },
});

// ==================== MUTATIONS ====================

/**
 * Link a voice memo to a person
 */
export const linkMemoToPerson = mutation({
  args: {
    personId: v.id("lifeos_frmPeople"),
    voiceMemoId: v.id("life_voiceMemos"),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Verify person belongs to user
    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      throw new Error("Person not found or access denied");
    }

    // Verify memo belongs to user
    const memo = await ctx.db.get(args.voiceMemoId);
    if (!memo || memo.userId !== user._id) {
      throw new Error("Voice memo not found or access denied");
    }

    // Check if already linked
    const existingLink = await ctx.db
      .query("lifeos_frmPersonMemos")
      .withIndex("by_memo", (q) => q.eq("voiceMemoId", args.voiceMemoId))
      .filter((q) => q.eq(q.field("personId"), args.personId))
      .first();

    if (existingLink) {
      // Update context if provided
      if (args.context !== undefined) {
        await ctx.db.patch(existingLink._id, { context: args.context });
      }
      return existingLink._id;
    }

    // Create link
    const linkId = await ctx.db.insert("lifeos_frmPersonMemos", {
      userId: user._id,
      personId: args.personId,
      voiceMemoId: args.voiceMemoId,
      context: args.context,
      createdAt: now,
    });

    // Create timeline entry
    await ctx.db.insert("lifeos_frmTimeline", {
      userId: user._id,
      personId: args.personId,
      entryType: "voice_memo",
      voiceMemoId: args.voiceMemoId,
      personName: person.name,
      title: memo.name,
      preview: memo.transcript?.slice(0, 200),
      interactionAt: memo.clientCreatedAt || memo.createdAt,
      createdAt: now,
    });

    // Update person's memo count and last interaction
    await ctx.db.patch(args.personId, {
      memoCount: person.memoCount + 1,
      lastInteractionAt: memo.clientCreatedAt || memo.createdAt,
      updatedAt: now,
    });

    return linkId;
  },
});

/**
 * Unlink a voice memo from a person
 */
export const unlinkMemoFromPerson = mutation({
  args: {
    personId: v.id("lifeos_frmPeople"),
    voiceMemoId: v.id("life_voiceMemos"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify person belongs to user
    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      throw new Error("Person not found or access denied");
    }

    // Find and delete the link
    const link = await ctx.db
      .query("lifeos_frmPersonMemos")
      .withIndex("by_memo", (q) => q.eq("voiceMemoId", args.voiceMemoId))
      .filter((q) => q.eq(q.field("personId"), args.personId))
      .first();

    if (!link) {
      throw new Error("Link not found");
    }

    await ctx.db.delete(link._id);

    // Delete timeline entry
    const timelineEntry = await ctx.db
      .query("lifeos_frmTimeline")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .filter((q) =>
        q.and(
          q.eq(q.field("voiceMemoId"), args.voiceMemoId),
          q.eq(q.field("entryType"), "voice_memo")
        )
      )
      .first();

    if (timelineEntry) {
      await ctx.db.delete(timelineEntry._id);
    }

    // Update person's memo count
    const newMemoCount = Math.max(0, person.memoCount - 1);

    // Find the latest remaining memo to update lastInteractionAt
    const remainingLinks = await ctx.db
      .query("lifeos_frmPersonMemos")
      .withIndex("by_person_created", (q) => q.eq("personId", args.personId))
      .order("desc")
      .take(1);

    let lastInteractionAt = person.lastInteractionAt;
    if (remainingLinks.length > 0) {
      const latestMemo = await ctx.db.get(remainingLinks[0].voiceMemoId);
      lastInteractionAt = latestMemo?.clientCreatedAt || latestMemo?.createdAt;
    } else {
      lastInteractionAt = undefined;
    }

    await ctx.db.patch(args.personId, {
      memoCount: newMemoCount,
      lastInteractionAt,
      updatedAt: Date.now(),
    });

    return link._id;
  },
});
