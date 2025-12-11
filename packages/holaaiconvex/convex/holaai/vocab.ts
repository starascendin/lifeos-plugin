import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireUser } from "../_lib/auth";

/**
 * Vocabulary Bank API
 * Allows users to save and manage their personal vocabulary/phrases
 */

// ==================== QUERIES ====================

/**
 * List all vocab bank entries for the current user
 * Sorted by addedAt descending (newest first)
 */
export const listVocabBank = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 50;

    const entries = await ctx.db
      .query("hola_vocabBank")
      .withIndex("by_user_added", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit + 1);

    const hasMore = entries.length > limit;
    const items = hasMore ? entries.slice(0, limit) : entries;
    const nextCursor = hasMore ? items[items.length - 1]?._id : undefined;

    return {
      items,
      nextCursor,
      hasMore,
    };
  },
});

/**
 * Search vocab bank by text (for checking duplicates or searching)
 */
export const searchVocabBank = query({
  args: {
    searchText: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const normalizedSearch = args.searchText.toLowerCase().trim();

    // First try exact match by normalized key
    const exactMatch = await ctx.db
      .query("hola_vocabBank")
      .withIndex("by_user_normalized", (q) =>
        q.eq("userId", user._id).eq("normalizedKey", normalizedSearch)
      )
      .first();

    if (exactMatch) {
      return [exactMatch];
    }

    // Otherwise, do a partial text search
    const allEntries = await ctx.db
      .query("hola_vocabBank")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return allEntries.filter(
      (entry) =>
        entry.sourceText.toLowerCase().includes(normalizedSearch) ||
        entry.translatedText.toLowerCase().includes(normalizedSearch)
    );
  },
});

/**
 * Get a single vocab entry by ID
 */
export const getVocabEntry = query({
  args: {
    entryId: v.id("hola_vocabBank"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const entry = await ctx.db.get(args.entryId);

    if (!entry || entry.userId !== user._id) {
      return null;
    }

    return entry;
  },
});

/**
 * Check if a word/phrase already exists in vocab bank
 */
export const checkExists = query({
  args: {
    text: v.string(),
    sourceLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const normalizedKey = `${args.sourceLanguage}:${args.text.toLowerCase().trim()}`;

    const existing = await ctx.db
      .query("hola_vocabBank")
      .withIndex("by_user_normalized", (q) =>
        q.eq("userId", user._id).eq("normalizedKey", normalizedKey)
      )
      .first();

    return existing !== null;
  },
});

// ==================== MUTATIONS ====================

/**
 * Add a word/phrase to vocab bank
 * Uses upsert logic - if entry exists with same normalizedKey, updates it
 */
export const addToVocabBank = mutation({
  args: {
    sourceText: v.string(),
    translatedText: v.string(),
    sourceLanguage: v.string(),
    targetLanguage: v.string(),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Create normalized key for deduplication
    // Format: "sourceLanguage:lowercased_trimmed_text"
    const normalizedKey = `${args.sourceLanguage}:${args.sourceText.toLowerCase().trim()}`;

    // Check if entry already exists
    const existing = await ctx.db
      .query("hola_vocabBank")
      .withIndex("by_user_normalized", (q) =>
        q.eq("userId", user._id).eq("normalizedKey", normalizedKey)
      )
      .first();

    if (existing) {
      // Update existing entry with new translation (in case it changed)
      await ctx.db.patch(existing._id, {
        translatedText: args.translatedText,
        context: args.context ?? existing.context,
        addedAt: Date.now(), // Bump to top of list
      });
      return existing._id;
    }

    // Create new entry
    const entryId = await ctx.db.insert("hola_vocabBank", {
      userId: user._id,
      sourceText: args.sourceText.trim(),
      translatedText: args.translatedText.trim(),
      sourceLanguage: args.sourceLanguage,
      targetLanguage: args.targetLanguage,
      normalizedKey,
      context: args.context,
      addedAt: Date.now(),
    });

    return entryId;
  },
});

/**
 * Remove a vocab entry by ID
 */
export const removeFromVocabBank = mutation({
  args: {
    entryId: v.id("hola_vocabBank"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const entry = await ctx.db.get(args.entryId);

    if (!entry || entry.userId !== user._id) {
      throw new Error("Entry not found or access denied");
    }

    await ctx.db.delete(args.entryId);
    return { success: true };
  },
});

/**
 * Clear all vocab bank entries for the current user
 */
export const clearVocabBank = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const entries = await ctx.db
      .query("hola_vocabBank")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const entry of entries) {
      await ctx.db.delete(entry._id);
    }

    return { deletedCount: entries.length };
  },
});

/**
 * Get vocab bank statistics for the current user
 */
export const getVocabStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const entries = await ctx.db
      .query("hola_vocabBank")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const spanishToEnglish = entries.filter(
      (e) => e.sourceLanguage === "es"
    ).length;
    const englishToSpanish = entries.filter(
      (e) => e.sourceLanguage === "en"
    ).length;

    return {
      totalEntries: entries.length,
      spanishToEnglish,
      englishToSpanish,
    };
  },
});
