import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ==================== LEVELS ====================

export const listLevels = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("contentLevels")
      .withIndex("by_order")
      .order("asc")
      .collect();
  },
});

export const getLevel = query({
  args: { levelId: v.id("contentLevels") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.levelId);
  },
});

export const createLevel = mutation({
  args: {
    name: v.string(),
    displayName: v.string(),
    description: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("contentLevels", args);
  },
});

// ==================== CATEGORIES ====================

export const listCategories = query({
  args: { levelId: v.id("contentLevels") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contentCategories")
      .withIndex("by_level_order", (q) => q.eq("levelId", args.levelId))
      .order("asc")
      .collect();
  },
});

export const getCategory = query({
  args: { categoryId: v.id("contentCategories") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.categoryId);
  },
});

export const getCategoryWithLevel = query({
  args: { categoryId: v.id("contentCategories") },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId);
    if (!category) return null;

    const level = await ctx.db.get(category.levelId);
    return { ...category, level };
  },
});

export const createCategory = mutation({
  args: {
    levelId: v.id("contentLevels"),
    name: v.string(),
    description: v.string(),
    icon: v.optional(v.string()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("contentCategories", args);
  },
});

// ==================== VOCABULARY ====================

export const listVocabulary = query({
  args: { categoryId: v.id("contentCategories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vocabularyItems")
      .withIndex("by_category_order", (q) => q.eq("categoryId", args.categoryId))
      .order("asc")
      .collect();
  },
});

export const getVocabularyItem = query({
  args: { itemId: v.id("vocabularyItems") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.itemId);
  },
});

export const createVocabularyItem = mutation({
  args: {
    categoryId: v.id("contentCategories"),
    spanish: v.string(),
    english: v.string(),
    pronunciation: v.optional(v.string()),
    exampleSentence: v.optional(v.string()),
    exampleTranslation: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    difficulty: v.optional(v.number()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("vocabularyItems", args);
  },
});

export const createVocabularyBatch = mutation({
  args: {
    items: v.array(
      v.object({
        categoryId: v.id("contentCategories"),
        spanish: v.string(),
        english: v.string(),
        pronunciation: v.optional(v.string()),
        exampleSentence: v.optional(v.string()),
        exampleTranslation: v.optional(v.string()),
        audioUrl: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        difficulty: v.optional(v.number()),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const item of args.items) {
      const id = await ctx.db.insert("vocabularyItems", item);
      ids.push(id);
    }
    return ids;
  },
});

// ==================== GRAMMAR RULES ====================

export const listGrammarRules = query({
  args: { categoryId: v.id("contentCategories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("grammarRules")
      .withIndex("by_category_order", (q) => q.eq("categoryId", args.categoryId))
      .order("asc")
      .collect();
  },
});

export const getGrammarRule = query({
  args: { ruleId: v.id("grammarRules") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.ruleId);
  },
});

export const createGrammarRule = mutation({
  args: {
    categoryId: v.id("contentCategories"),
    title: v.string(),
    explanation: v.string(),
    formula: v.optional(v.string()),
    examples: v.array(
      v.object({
        spanish: v.string(),
        english: v.string(),
      })
    ),
    tips: v.array(v.string()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("grammarRules", args);
  },
});

// ==================== PHRASES ====================

export const listPhrases = query({
  args: { categoryId: v.id("contentCategories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("phrases")
      .withIndex("by_category_order", (q) => q.eq("categoryId", args.categoryId))
      .order("asc")
      .collect();
  },
});

export const getPhrase = query({
  args: { phraseId: v.id("phrases") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.phraseId);
  },
});

export const createPhrase = mutation({
  args: {
    categoryId: v.id("contentCategories"),
    spanish: v.string(),
    english: v.string(),
    context: v.optional(v.string()),
    formalityLevel: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("phrases", args);
  },
});

export const createPhraseBatch = mutation({
  args: {
    items: v.array(
      v.object({
        categoryId: v.id("contentCategories"),
        spanish: v.string(),
        english: v.string(),
        context: v.optional(v.string()),
        formalityLevel: v.optional(v.string()),
        audioUrl: v.optional(v.string()),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const item of args.items) {
      const id = await ctx.db.insert("phrases", item);
      ids.push(id);
    }
    return ids;
  },
});

// ==================== LESSONS ====================

export const listLessons = query({
  args: { categoryId: v.id("contentCategories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lessons")
      .withIndex("by_category_order", (q) => q.eq("categoryId", args.categoryId))
      .order("asc")
      .collect();
  },
});

export const getLesson = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.lessonId);
  },
});

export const getLessonWithContent = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) return null;

    // Fetch all related content
    const vocabulary = await Promise.all(
      lesson.vocabularyIds.map((id) => ctx.db.get(id))
    );
    const grammar = await Promise.all(
      lesson.grammarIds.map((id) => ctx.db.get(id))
    );
    const phrases = await Promise.all(
      lesson.phraseIds.map((id) => ctx.db.get(id))
    );

    return {
      ...lesson,
      vocabulary: vocabulary.filter(Boolean),
      grammar: grammar.filter(Boolean),
      phrases: phrases.filter(Boolean),
    };
  },
});

export const createLesson = mutation({
  args: {
    categoryId: v.id("contentCategories"),
    title: v.string(),
    description: v.string(),
    vocabularyIds: v.array(v.id("vocabularyItems")),
    grammarIds: v.array(v.id("grammarRules")),
    phraseIds: v.array(v.id("phrases")),
    estimatedMinutes: v.optional(v.number()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("lessons", args);
  },
});

// ==================== CATEGORY CONTENT SUMMARY ====================

export const getCategoryContentSummary = query({
  args: { categoryId: v.id("contentCategories") },
  handler: async (ctx, args) => {
    const [vocabulary, grammar, phrases, lessons] = await Promise.all([
      ctx.db
        .query("vocabularyItems")
        .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
        .collect(),
      ctx.db
        .query("grammarRules")
        .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
        .collect(),
      ctx.db
        .query("phrases")
        .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
        .collect(),
      ctx.db
        .query("lessons")
        .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
        .collect(),
    ]);

    return {
      vocabularyCount: vocabulary.length,
      grammarCount: grammar.length,
      phraseCount: phrases.length,
      lessonCount: lessons.length,
      totalItems: vocabulary.length + grammar.length + phrases.length,
    };
  },
});
