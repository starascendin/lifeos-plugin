import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Id } from "../_generated/dataModel";

// ==================== QUERIES ====================

/**
 * Get a single voice memo with full details including extraction
 */
export const getVoiceMemo = query({
  args: {
    memoId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const memo = await ctx.db.get(args.memoId as Id<"life_voiceMemos">);
    if (!memo || memo.userId !== user._id) {
      return null;
    }

    // Get latest extraction if available
    const extraction = await ctx.db
      .query("life_voiceMemoExtractions")
      .withIndex("by_voiceMemo", (q) => q.eq("voiceMemoId", memo._id))
      .order("desc")
      .first();

    return {
      ...memo,
      extraction: extraction
        ? {
            summary: extraction.summary,
            labels: extraction.labels,
            actionItems: extraction.actionItems,
            keyPoints: extraction.keyPoints,
            sentiment: extraction.sentiment,
          }
        : null,
    };
  },
});

/**
 * Get voice memos by date range with extractions
 */
export const getVoiceMemosByDateRange = query({
  args: {
    startDate: v.string(), // ISO date string
    endDate: v.string(), // ISO date string
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = Math.min(args.limit ?? 50, 100);

    const startTs = new Date(args.startDate).getTime();
    const endTs = new Date(args.endDate).setHours(23, 59, 59, 999);

    const memos = await ctx.db
      .query("life_voiceMemos")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.and(
          q.gte(q.field("clientCreatedAt"), startTs),
          q.lte(q.field("clientCreatedAt"), endTs)
        )
      )
      .order("desc")
      .take(limit);

    // Get extractions for all memos
    const results = await Promise.all(
      memos.map(async (memo) => {
        const extraction = await ctx.db
          .query("life_voiceMemoExtractions")
          .withIndex("by_voiceMemo", (q) => q.eq("voiceMemoId", memo._id))
          .order("desc")
          .first();

        return {
          id: memo._id,
          name: memo.name,
          transcript: memo.transcript,
          duration: memo.duration,
          createdAt: memo.clientCreatedAt,
          tags: memo.tags,
          extraction: extraction
            ? {
                summary: extraction.summary,
                labels: extraction.labels,
                actionItems: extraction.actionItems,
                keyPoints: extraction.keyPoints,
                sentiment: extraction.sentiment,
              }
            : null,
        };
      })
    );

    return results;
  },
});

/**
 * Get voice memos by labels/tags
 */
export const getVoiceMemosByLabels = query({
  args: {
    labels: v.array(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = Math.min(args.limit ?? 50, 100);

    // Get extractions with matching labels
    const extractions = await ctx.db
      .query("life_voiceMemoExtractions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    // Filter extractions that have any of the requested labels
    const matchingExtractions = extractions.filter((ext) =>
      ext.labels?.some((label) =>
        args.labels.some(
          (reqLabel) =>
            label.toLowerCase().includes(reqLabel.toLowerCase()) ||
            reqLabel.toLowerCase().includes(label.toLowerCase())
        )
      )
    );

    // Get the corresponding memos
    const results = await Promise.all(
      matchingExtractions.slice(0, limit).map(async (extraction) => {
        const memo = await ctx.db.get(extraction.voiceMemoId);
        if (!memo) return null;

        return {
          id: memo._id,
          name: memo.name,
          transcript: memo.transcript,
          duration: memo.duration,
          createdAt: memo.clientCreatedAt,
          tags: memo.tags,
          extraction: {
            summary: extraction.summary,
            labels: extraction.labels,
            actionItems: extraction.actionItems,
            keyPoints: extraction.keyPoints,
            sentiment: extraction.sentiment,
          },
        };
      })
    );

    return results.filter(Boolean);
  },
});

/**
 * Get all unique labels from voice memo extractions
 */
export const getVoiceMemoLabels = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const extractions = await ctx.db
      .query("life_voiceMemoExtractions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    // Count labels
    const labelCounts = new Map<string, number>();
    for (const ext of extractions) {
      for (const label of ext.labels ?? []) {
        labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
      }
    }

    // Sort by count descending
    return Array.from(labelCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));
  },
});

// ==================== AI CONVERSATION SUMMARIES ====================

/**
 * Create a new AI conversation summary (crystallization)
 */
export const createAiConvoSummary = mutation({
  args: {
    title: v.string(),
    summary: v.string(),
    keyInsights: v.optional(v.array(v.string())),
    actionItems: v.optional(v.array(v.string())),
    ideas: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    relatedMemoIds: v.optional(v.array(v.string())),
    memoDateRange: v.optional(
      v.object({
        start: v.number(),
        end: v.number(),
      })
    ),
    summaryType: v.optional(v.string()),
    conversationContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const summaryId = await ctx.db.insert("life_voiceNotesAiConvoSummary", {
      userId: user._id,
      title: args.title,
      summary: args.summary,
      keyInsights: args.keyInsights,
      actionItems: args.actionItems,
      ideas: args.ideas,
      tags: args.tags,
      relatedMemoIds: args.relatedMemoIds?.map(
        (id) => id as Id<"life_voiceMemos">
      ),
      memoDateRange: args.memoDateRange,
      summaryType: args.summaryType,
      conversationContext: args.conversationContext,
      createdAt: now,
      updatedAt: now,
    });

    return { id: summaryId };
  },
});

/**
 * Get AI conversation summaries with optional filters
 */
export const getAiConvoSummaries = query({
  args: {
    summaryType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = Math.min(args.limit ?? 20, 50);

    let summariesQuery = ctx.db
      .query("life_voiceNotesAiConvoSummary")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc");

    const summaries = await summariesQuery.take(limit);

    // Filter by type if specified
    const filtered = args.summaryType
      ? summaries.filter((s) => s.summaryType === args.summaryType)
      : summaries;

    return filtered.map((s) => ({
      id: s._id,
      title: s.title,
      summary: s.summary,
      keyInsights: s.keyInsights,
      actionItems: s.actionItems,
      ideas: s.ideas,
      tags: s.tags,
      summaryType: s.summaryType,
      createdAt: s.createdAt,
    }));
  },
});

/**
 * Get a single AI conversation summary by ID
 */
export const getAiConvoSummary = query({
  args: {
    summaryId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const summary = await ctx.db.get(
      args.summaryId as Id<"life_voiceNotesAiConvoSummary">
    );
    if (!summary || summary.userId !== user._id) {
      return null;
    }

    // Get related memos if any
    const relatedMemos = summary.relatedMemoIds
      ? await Promise.all(
          summary.relatedMemoIds.map(async (memoId) => {
            const memo = await ctx.db.get(memoId);
            return memo
              ? {
                  id: memo._id,
                  name: memo.name,
                  createdAt: memo.clientCreatedAt,
                }
              : null;
          })
        )
      : [];

    return {
      ...summary,
      relatedMemos: relatedMemos.filter(Boolean),
    };
  },
});

/**
 * Update an AI conversation summary
 */
export const updateAiConvoSummary = mutation({
  args: {
    summaryId: v.string(),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    keyInsights: v.optional(v.array(v.string())),
    actionItems: v.optional(v.array(v.string())),
    ideas: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db.get(
      args.summaryId as Id<"life_voiceNotesAiConvoSummary">
    );
    if (!existing || existing.userId !== user._id) {
      throw new Error("Summary not found");
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) updates.title = args.title;
    if (args.summary !== undefined) updates.summary = args.summary;
    if (args.keyInsights !== undefined) updates.keyInsights = args.keyInsights;
    if (args.actionItems !== undefined) updates.actionItems = args.actionItems;
    if (args.ideas !== undefined) updates.ideas = args.ideas;
    if (args.tags !== undefined) updates.tags = args.tags;

    await ctx.db.patch(
      args.summaryId as Id<"life_voiceNotesAiConvoSummary">,
      updates
    );

    return { success: true };
  },
});

/**
 * Delete an AI conversation summary
 */
export const deleteAiConvoSummary = mutation({
  args: {
    summaryId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db.get(
      args.summaryId as Id<"life_voiceNotesAiConvoSummary">
    );
    if (!existing || existing.userId !== user._id) {
      throw new Error("Summary not found");
    }

    await ctx.db.delete(args.summaryId as Id<"life_voiceNotesAiConvoSummary">);

    return { success: true };
  },
});

/**
 * Search AI conversation summaries
 */
export const searchAiConvoSummaries = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = Math.min(args.limit ?? 10, 50);

    const results = await ctx.db
      .query("life_voiceNotesAiConvoSummary")
      .withSearchIndex("search_summary", (q) =>
        q.search("summary", args.query).eq("userId", user._id)
      )
      .take(limit);

    return results.map((s) => ({
      id: s._id,
      title: s.title,
      summary: s.summary,
      keyInsights: s.keyInsights,
      tags: s.tags,
      summaryType: s.summaryType,
      createdAt: s.createdAt,
    }));
  },
});
