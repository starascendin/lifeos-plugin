import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ==================== EXERCISES ====================

export const listExercises = query({
  args: {
    categoryId: v.optional(v.id("contentCategories")),
    grammarRuleId: v.optional(v.id("grammarRules")),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let exercises;

    if (args.grammarRuleId) {
      exercises = await ctx.db
        .query("exercises")
        .withIndex("by_grammar_rule", (q) =>
          q.eq("grammarRuleId", args.grammarRuleId)
        )
        .collect();
    } else if (args.categoryId) {
      exercises = await ctx.db
        .query("exercises")
        .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
        .collect();
    } else if (args.type) {
      exercises = await ctx.db
        .query("exercises")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .collect();
    } else {
      exercises = await ctx.db.query("exercises").collect();
    }

    return exercises.sort((a, b) => a.order - b.order);
  },
});

export const getExercise = query({
  args: { exerciseId: v.id("exercises") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.exerciseId);
  },
});

export const getExerciseWithMatching = query({
  args: { exerciseId: v.id("exercises") },
  handler: async (ctx, args) => {
    const exercise = await ctx.db.get(args.exerciseId);
    if (!exercise) return null;

    if (exercise.type === "matching") {
      const pairs = await ctx.db
        .query("matchingPairs")
        .withIndex("by_exercise", (q) => q.eq("exerciseId", args.exerciseId))
        .collect();
      return { ...exercise, matchingPairs: pairs.sort((a, b) => a.order - b.order) };
    }

    return exercise;
  },
});

export const createExercise = mutation({
  args: {
    grammarRuleId: v.optional(v.id("grammarRules")),
    categoryId: v.optional(v.id("contentCategories")),
    type: v.string(),
    question: v.string(),
    questionSpanish: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    correctAnswer: v.string(),
    explanation: v.optional(v.string()),
    difficulty: v.number(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("exercises", args);
  },
});

export const createExerciseBatch = mutation({
  args: {
    exercises: v.array(
      v.object({
        grammarRuleId: v.optional(v.id("grammarRules")),
        categoryId: v.optional(v.id("contentCategories")),
        type: v.string(),
        question: v.string(),
        questionSpanish: v.optional(v.string()),
        options: v.optional(v.array(v.string())),
        correctAnswer: v.string(),
        explanation: v.optional(v.string()),
        difficulty: v.number(),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const exercise of args.exercises) {
      const id = await ctx.db.insert("exercises", exercise);
      ids.push(id);
    }
    return ids;
  },
});

// ==================== MATCHING PAIRS ====================

export const createMatchingPairs = mutation({
  args: {
    exerciseId: v.id("exercises"),
    pairs: v.array(
      v.object({
        spanish: v.string(),
        english: v.string(),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const pair of args.pairs) {
      const id = await ctx.db.insert("matchingPairs", {
        exerciseId: args.exerciseId,
        ...pair,
      });
      ids.push(id);
    }
    return ids;
  },
});

export const getMatchingPairs = query({
  args: { exerciseId: v.id("exercises") },
  handler: async (ctx, args) => {
    const pairs = await ctx.db
      .query("matchingPairs")
      .withIndex("by_exercise", (q) => q.eq("exerciseId", args.exerciseId))
      .collect();
    return pairs.sort((a, b) => a.order - b.order);
  },
});

// ==================== USER EXERCISE PROGRESS ====================

export const getUserExerciseProgress = query({
  args: {
    userId: v.id("users"),
    exerciseId: v.id("exercises"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userExerciseProgress")
      .withIndex("by_user_exercise", (q) =>
        q.eq("userId", args.userId).eq("exerciseId", args.exerciseId)
      )
      .first();
  },
});

export const getAllUserExerciseProgress = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userExerciseProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const recordExerciseAttempt = mutation({
  args: {
    userId: v.id("users"),
    exerciseId: v.id("exercises"),
    score: v.number(), // 0-100
    isCorrect: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userExerciseProgress")
      .withIndex("by_user_exercise", (q) =>
        q.eq("userId", args.userId).eq("exerciseId", args.exerciseId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        attempts: existing.attempts + 1,
        correctAttempts: existing.correctAttempts + (args.isCorrect ? 1 : 0),
        lastScore: args.score,
        bestScore: Math.max(existing.bestScore, args.score),
        lastAttemptedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("userExerciseProgress", {
        userId: args.userId,
        exerciseId: args.exerciseId,
        attempts: 1,
        correctAttempts: args.isCorrect ? 1 : 0,
        lastScore: args.score,
        bestScore: args.score,
        lastAttemptedAt: Date.now(),
      });
    }
  },
});

// ==================== QUIZ GENERATION ====================

export const generateQuiz = query({
  args: {
    categoryId: v.id("contentCategories"),
    count: v.optional(v.number()),
    difficulty: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const count = args.count ?? 10;

    let exercises = await ctx.db
      .query("exercises")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();

    // Filter by difficulty if specified
    if (args.difficulty) {
      exercises = exercises.filter((e) => e.difficulty <= args.difficulty!);
    }

    // Shuffle and take requested count
    const shuffled = exercises.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  },
});

export const getQuizStats = query({
  args: {
    userId: v.id("users"),
    categoryId: v.id("contentCategories"),
  },
  handler: async (ctx, args) => {
    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();

    const exerciseIds = exercises.map((e) => e._id);

    const userProgress = await ctx.db
      .query("userExerciseProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const relevantProgress = userProgress.filter((p) =>
      exerciseIds.includes(p.exerciseId)
    );

    const totalExercises = exercises.length;
    const attemptedExercises = relevantProgress.length;
    const totalAttempts = relevantProgress.reduce(
      (sum, p) => sum + p.attempts,
      0
    );
    const totalCorrect = relevantProgress.reduce(
      (sum, p) => sum + p.correctAttempts,
      0
    );
    const averageBestScore =
      relevantProgress.length > 0
        ? relevantProgress.reduce((sum, p) => sum + p.bestScore, 0) /
          relevantProgress.length
        : 0;

    return {
      totalExercises,
      attemptedExercises,
      completionRate:
        totalExercises > 0
          ? Math.round((attemptedExercises / totalExercises) * 100)
          : 0,
      totalAttempts,
      totalCorrect,
      accuracy:
        totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
      averageBestScore: Math.round(averageBestScore),
    };
  },
});
