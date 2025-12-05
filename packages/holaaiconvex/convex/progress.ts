import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ==================== SM-2 SPACED REPETITION ALGORITHM ====================

// Calculate next review interval based on SM-2 algorithm
function calculateNextReview(
  quality: number, // 0-5 rating (0-2 = incorrect, 3-5 = correct with varying ease)
  easeFactor: number,
  interval: number,
  repetitions: number
): { newInterval: number; newEaseFactor: number; nextReviewAt: number } {
  let newEaseFactor = easeFactor;
  let newInterval = interval;

  if (quality < 3) {
    // Incorrect answer - reset
    newInterval = 1;
  } else {
    // Correct answer - increase interval
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * easeFactor);
    }

    // Update ease factor
    newEaseFactor = Math.max(
      1.3,
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );
  }

  // Calculate next review timestamp (interval is in days)
  const nextReviewAt = Date.now() + newInterval * 24 * 60 * 60 * 1000;

  return { newInterval, newEaseFactor, nextReviewAt };
}

// Convert quality (0-5) to mastery percentage
function qualityToMastery(quality: number, currentMastery: number): number {
  if (quality >= 4) {
    return Math.min(100, currentMastery + 15);
  } else if (quality === 3) {
    return Math.min(100, currentMastery + 5);
  } else if (quality === 2) {
    return Math.max(0, currentMastery - 5);
  } else {
    return Math.max(0, currentMastery - 15);
  }
}

// ==================== USER PROGRESS ====================

export const getUserProgress = query({
  args: {
    userId: v.id("users"),
    contentType: v.string(),
    contentId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userProgress")
      .withIndex("by_user_content", (q) =>
        q
          .eq("userId", args.userId)
          .eq("contentType", args.contentType)
          .eq("contentId", args.contentId)
      )
      .first();
  },
});

export const getUserProgressBatch = query({
  args: {
    userId: v.id("users"),
    contentType: v.string(),
    contentIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const results: Record<string, {
      _id: string;
      _creationTime: number;
      userId: string;
      contentType: string;
      contentId: string;
      masteryLevel: number;
      timesPracticed: number;
      correctCount: number;
      incorrectCount: number;
      lastPracticedAt: number;
      nextReviewAt: number;
      easeFactor: number;
      interval: number;
    }> = {};

    for (const contentId of args.contentIds) {
      const progress = await ctx.db
        .query("userProgress")
        .withIndex("by_user_content", (q) =>
          q
            .eq("userId", args.userId)
            .eq("contentType", args.contentType)
            .eq("contentId", contentId)
        )
        .first();
      if (progress) {
        results[contentId] = progress as typeof results[string];
      }
    }

    return results;
  },
});

export const getItemsDueForReview = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const limit = args.limit ?? 20;

    const dueItems = await ctx.db
      .query("userProgress")
      .withIndex("by_user_next_review", (q) =>
        q.eq("userId", args.userId).lte("nextReviewAt", now)
      )
      .take(limit);

    return dueItems;
  },
});

export const recordPractice = mutation({
  args: {
    userId: v.id("users"),
    contentType: v.string(),
    contentId: v.string(),
    quality: v.number(), // 0-5 rating
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userProgress")
      .withIndex("by_user_content", (q) =>
        q
          .eq("userId", args.userId)
          .eq("contentType", args.contentType)
          .eq("contentId", args.contentId)
      )
      .first();

    const isCorrect = args.quality >= 3;

    if (existing) {
      // Update existing progress
      const { newInterval, newEaseFactor, nextReviewAt } = calculateNextReview(
        args.quality,
        existing.easeFactor,
        existing.interval,
        existing.timesPracticed
      );

      const newMastery = qualityToMastery(args.quality, existing.masteryLevel);

      await ctx.db.patch(existing._id, {
        masteryLevel: newMastery,
        timesPracticed: existing.timesPracticed + 1,
        correctCount: existing.correctCount + (isCorrect ? 1 : 0),
        incorrectCount: existing.incorrectCount + (isCorrect ? 0 : 1),
        lastPracticedAt: Date.now(),
        nextReviewAt,
        easeFactor: newEaseFactor,
        interval: newInterval,
      });

      return existing._id;
    } else {
      // Create new progress record
      const { newInterval, newEaseFactor, nextReviewAt } = calculateNextReview(
        args.quality,
        2.5, // Default ease factor
        0,
        0
      );

      const initialMastery = qualityToMastery(args.quality, 0);

      return await ctx.db.insert("userProgress", {
        userId: args.userId,
        contentType: args.contentType,
        contentId: args.contentId,
        masteryLevel: initialMastery,
        timesPracticed: 1,
        correctCount: isCorrect ? 1 : 0,
        incorrectCount: isCorrect ? 0 : 1,
        lastPracticedAt: Date.now(),
        nextReviewAt,
        easeFactor: newEaseFactor,
        interval: newInterval,
      });
    }
  },
});

// ==================== USER LEVEL PROGRESS ====================

export const getUserLevelProgress = query({
  args: {
    userId: v.id("users"),
    levelId: v.id("contentLevels"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userLevelProgress")
      .withIndex("by_user_level", (q) =>
        q.eq("userId", args.userId).eq("levelId", args.levelId)
      )
      .first();
  },
});

export const getAllUserLevelProgress = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userLevelProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const updateLevelProgress = mutation({
  args: {
    userId: v.id("users"),
    levelId: v.id("contentLevels"),
    vocabMastery: v.number(),
    grammarMastery: v.number(),
    phraseMastery: v.number(),
    totalItemsStudied: v.number(),
    totalItemsAvailable: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userLevelProgress")
      .withIndex("by_user_level", (q) =>
        q.eq("userId", args.userId).eq("levelId", args.levelId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        vocabMastery: args.vocabMastery,
        grammarMastery: args.grammarMastery,
        phraseMastery: args.phraseMastery,
        totalItemsStudied: args.totalItemsStudied,
        totalItemsAvailable: args.totalItemsAvailable,
        lastStudiedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("userLevelProgress", {
        userId: args.userId,
        levelId: args.levelId,
        vocabMastery: args.vocabMastery,
        grammarMastery: args.grammarMastery,
        phraseMastery: args.phraseMastery,
        totalItemsStudied: args.totalItemsStudied,
        totalItemsAvailable: args.totalItemsAvailable,
        lastStudiedAt: Date.now(),
      });
    }
  },
});

// ==================== STATISTICS ====================

export const getUserStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const allProgress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;

    const totalItems = allProgress.length;
    const totalPractices = allProgress.reduce(
      (sum, p) => sum + p.timesPracticed,
      0
    );
    const totalCorrect = allProgress.reduce((sum, p) => sum + p.correctCount, 0);
    const totalIncorrect = allProgress.reduce(
      (sum, p) => sum + p.incorrectCount,
      0
    );

    const practicedToday = allProgress.filter(
      (p) => p.lastPracticedAt >= todayStart
    ).length;
    const practicedThisWeek = allProgress.filter(
      (p) => p.lastPracticedAt >= weekStart
    ).length;

    const dueForReview = allProgress.filter(
      (p) => p.nextReviewAt <= now
    ).length;

    const averageMastery =
      totalItems > 0
        ? allProgress.reduce((sum, p) => sum + p.masteryLevel, 0) / totalItems
        : 0;

    const masteredItems = allProgress.filter(
      (p) => p.masteryLevel >= 80
    ).length;

    return {
      totalItems,
      totalPractices,
      totalCorrect,
      totalIncorrect,
      accuracy:
        totalCorrect + totalIncorrect > 0
          ? Math.round((totalCorrect / (totalCorrect + totalIncorrect)) * 100)
          : 0,
      practicedToday,
      practicedThisWeek,
      dueForReview,
      averageMastery: Math.round(averageMastery),
      masteredItems,
    };
  },
});

// ==================== STREAK TRACKING ====================

export const getStudyStreak = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const allProgress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (allProgress.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    // Get unique days when user practiced
    const practiceDays = new Set(
      allProgress.map((p) => {
        const date = new Date(p.lastPracticedAt);
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      })
    );

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    const checkDate = new Date(today);

    while (true) {
      const dateKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
      if (practiceDays.has(dateKey)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (currentStreak === 0) {
        // Check if yesterday had practice (allow for today not yet practiced)
        checkDate.setDate(checkDate.getDate() - 1);
        const yesterdayKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
        if (practiceDays.has(yesterdayKey)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return {
      currentStreak,
      longestStreak: currentStreak, // Simplified - would need more logic for actual longest
    };
  },
});
