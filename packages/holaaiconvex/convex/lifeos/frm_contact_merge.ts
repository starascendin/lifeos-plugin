import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { requireUser } from "../_lib/auth";

// ==================== QUERIES ====================

/**
 * Get pending merge suggestions for a user
 */
export const getMergeSuggestions = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const suggestions = await ctx.db
      .query("lifeos_frmMergeSuggestions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "pending")
      )
      .collect();

    // Enrich with person details
    const enrichedSuggestions = await Promise.all(
      suggestions.map(async (suggestion) => {
        const targetPerson = await ctx.db.get(suggestion.targetPersonId);
        const sourcePerson = await ctx.db.get(suggestion.sourcePersonId);

        if (!targetPerson || !sourcePerson) {
          return null;
        }

        return {
          ...suggestion,
          targetPerson: {
            _id: targetPerson._id,
            name: targetPerson.name,
            email: targetPerson.email,
            phone: targetPerson.phone,
            autoCreatedFrom: targetPerson.autoCreatedFrom,
            memoCount: targetPerson.memoCount,
          },
          sourcePerson: {
            _id: sourcePerson._id,
            name: sourcePerson.name,
            email: sourcePerson.email,
            phone: sourcePerson.phone,
            autoCreatedFrom: sourcePerson.autoCreatedFrom,
            memoCount: sourcePerson.memoCount,
          },
        };
      })
    );

    return enrichedSuggestions.filter(Boolean);
  },
});

// ==================== INTERNAL MUTATIONS ====================

/**
 * Create a merge suggestion in the database
 */
export const createMergeSuggestion = internalMutation({
  args: {
    targetPersonId: v.id("lifeos_frmPeople"),
    sourcePersonId: v.id("lifeos_frmPeople"),
    confidence: v.number(),
    reasons: v.array(v.string()),
    matchedFields: v.any(),
  },
  handler: async (ctx, args) => {
    // Get the user from target person
    const targetPerson = await ctx.db.get(args.targetPersonId);
    if (!targetPerson) return null;

    // Check if suggestion already exists
    const existing = await ctx.db
      .query("lifeos_frmMergeSuggestions")
      .withIndex("by_pair", (q) =>
        q.eq("targetPersonId", args.targetPersonId).eq("sourcePersonId", args.sourcePersonId)
      )
      .first();

    if (existing) {
      // Update existing suggestion
      await ctx.db.patch(existing._id, {
        confidence: args.confidence,
        reasons: args.reasons,
        matchedFields: args.matchedFields,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    // Create new suggestion
    return await ctx.db.insert("lifeos_frmMergeSuggestions", {
      userId: targetPerson.userId,
      targetPersonId: args.targetPersonId,
      sourcePersonId: args.sourcePersonId,
      confidence: args.confidence,
      reasons: args.reasons,
      matchedFields: args.matchedFields,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// ==================== MUTATIONS ====================

/**
 * Accept a merge suggestion - merge source into target
 */
export const acceptMergeSuggestion = mutation({
  args: {
    suggestionId: v.id("lifeos_frmMergeSuggestions"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion || suggestion.userId !== user._id) {
      throw new Error("Suggestion not found or access denied");
    }

    if (suggestion.status !== "pending") {
      throw new Error("Suggestion already processed");
    }

    const targetPerson = await ctx.db.get(suggestion.targetPersonId);
    const sourcePerson = await ctx.db.get(suggestion.sourcePersonId);

    if (!targetPerson || !sourcePerson) {
      throw new Error("One or both contacts no longer exist");
    }

    // Step 1: Merge data from source into target
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    // Merge email (keep target's if exists, otherwise use source's)
    if (!targetPerson.email && sourcePerson.email) {
      updates.email = sourcePerson.email;
    }

    // Merge phone
    if (!targetPerson.phone && sourcePerson.phone) {
      updates.phone = sourcePerson.phone;
    }

    // Merge notes (combine)
    if (sourcePerson.notes) {
      updates.notes = targetPerson.notes
        ? `${targetPerson.notes}\n\n--- Merged from ${sourcePerson.name} ---\n${sourcePerson.notes}`
        : sourcePerson.notes;
    }

    // Update memo count
    updates.memoCount = (targetPerson.memoCount || 0) + (sourcePerson.memoCount || 0);

    await ctx.db.patch(suggestion.targetPersonId, updates);

    // Step 2: Re-link all source person's relationships to target

    // Re-link voice memo links
    const memoLinks = await ctx.db
      .query("lifeos_frmPersonMemos")
      .withIndex("by_person", (q) => q.eq("personId", suggestion.sourcePersonId))
      .collect();

    for (const link of memoLinks) {
      // Check if target already has this memo linked
      const existingLink = await ctx.db
        .query("lifeos_frmPersonMemos")
        .withIndex("by_person", (q) => q.eq("personId", suggestion.targetPersonId))
        .filter((q) => q.eq(q.field("voiceMemoId"), link.voiceMemoId))
        .first();

      if (!existingLink) {
        await ctx.db.insert("lifeos_frmPersonMemos", {
          userId: link.userId,
          personId: suggestion.targetPersonId,
          voiceMemoId: link.voiceMemoId,
          context: link.context,
          createdAt: link.createdAt,
        });
      }
      await ctx.db.delete(link._id);
    }

    // Re-link Beeper threads
    const beeperThreads = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_linkedPerson", (q) => q.eq("linkedPersonId", suggestion.sourcePersonId))
      .collect();

    for (const thread of beeperThreads) {
      await ctx.db.patch(thread._id, {
        linkedPersonId: suggestion.targetPersonId,
        updatedAt: Date.now(),
      });
    }

    // Re-link meeting person links
    const meetingLinks = await ctx.db
      .query("lifeos_meetingPersonLinks")
      .withIndex("by_person", (q) => q.eq("personId", suggestion.sourcePersonId))
      .collect();

    for (const link of meetingLinks) {
      // Check if target already has this meeting linked
      const existingLink = await ctx.db
        .query("lifeos_meetingPersonLinks")
        .withIndex("by_person", (q) => q.eq("personId", suggestion.targetPersonId))
        .filter((q) =>
          q.and(
            q.eq(q.field("meetingSource"), link.meetingSource),
            q.eq(q.field("meetingId"), link.meetingId)
          )
        )
        .first();

      if (!existingLink) {
        await ctx.db.insert("lifeos_meetingPersonLinks", {
          userId: link.userId,
          personId: suggestion.targetPersonId,
          meetingSource: link.meetingSource,
          meetingId: link.meetingId,
          linkSource: link.linkSource,
          confidence: link.confidence,
          reason: link.reason,
          createdAt: link.createdAt,
        });
      }
      await ctx.db.delete(link._id);
    }

    // Re-link contact emails
    const emails = await ctx.db
      .query("lifeos_contactEmails")
      .withIndex("by_person", (q) => q.eq("personId", suggestion.sourcePersonId))
      .collect();

    for (const email of emails) {
      // Check if target already has this email
      const existingEmail = await ctx.db
        .query("lifeos_contactEmails")
        .withIndex("by_person", (q) => q.eq("personId", suggestion.targetPersonId))
        .filter((q) => q.eq(q.field("email"), email.email))
        .first();

      if (!existingEmail) {
        await ctx.db.insert("lifeos_contactEmails", {
          userId: email.userId,
          personId: suggestion.targetPersonId,
          email: email.email,
          source: email.source,
          isPrimary: false, // Don't overwrite primary
          createdAt: email.createdAt,
        });
      }
      await ctx.db.delete(email._id);
    }

    // Step 3: Archive the source person
    await ctx.db.patch(suggestion.sourcePersonId, {
      archivedAt: Date.now(),
      notes: `[MERGED INTO ${targetPerson.name}]\n${sourcePerson.notes || ""}`,
      updatedAt: Date.now(),
    });

    // Step 4: Mark suggestion as accepted
    await ctx.db.patch(args.suggestionId, {
      status: "accepted",
      updatedAt: Date.now(),
    });

    return {
      success: true,
      targetPersonId: suggestion.targetPersonId,
    };
  },
});

/**
 * Reject a merge suggestion
 */
export const rejectMergeSuggestion = mutation({
  args: {
    suggestionId: v.id("lifeos_frmMergeSuggestions"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion || suggestion.userId !== user._id) {
      throw new Error("Suggestion not found or access denied");
    }

    await ctx.db.patch(args.suggestionId, {
      status: "rejected",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Dismiss all pending suggestions
 */
export const dismissAllSuggestions = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const suggestions = await ctx.db
      .query("lifeos_frmMergeSuggestions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "pending")
      )
      .collect();

    for (const suggestion of suggestions) {
      await ctx.db.patch(suggestion._id, {
        status: "dismissed",
        updatedAt: Date.now(),
      });
    }

    return { success: true, count: suggestions.length };
  },
});
