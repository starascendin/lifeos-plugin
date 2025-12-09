import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Interactive Lesson Learning Session Management
 * Handles session creation, progress tracking, and mastery updates
 */

// Get or create a learning session for a lesson
export const getOrCreateSession = mutation({
  args: {
    userId: v.id("users"),
    lessonId: v.id("hola_moduleLessons"),
    stages: v.array(
      v.object({
        id: v.string(),
        type: v.string(),
        title: v.string(),
        contentIds: v.array(v.string()),
        isCompleted: v.boolean(),
        drillTypes: v.optional(v.array(v.string())),
      })
    ),
    itemMastery: v.any(),
  },
  handler: async (ctx, args) => {
    // Check for existing in-progress session
    const existingSession = await ctx.db
      .query("hola_lessonSessions")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", args.userId).eq("lessonId", args.lessonId)
      )
      .filter((q) => q.eq(q.field("status"), "in_progress"))
      .first();

    if (existingSession) {
      return existingSession;
    }

    // Create new session
    const sessionId = await ctx.db.insert("hola_lessonSessions", {
      userId: args.userId,
      lessonId: args.lessonId,
      status: "in_progress",
      currentStageIndex: 0,
      stages: args.stages,
      itemMastery: args.itemMastery,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      sessionStats: {
        totalDrills: 0,
        correctDrills: 0,
        hintsUsed: 0,
        totalTimeSpent: 0,
      },
    });

    return await ctx.db.get(sessionId);
  },
});

// Update session progress
export const updateSessionProgress = mutation({
  args: {
    sessionId: v.id("hola_lessonSessions"),
    currentStageIndex: v.number(),
    stages: v.array(
      v.object({
        id: v.string(),
        type: v.string(),
        title: v.string(),
        contentIds: v.array(v.string()),
        isCompleted: v.boolean(),
        drillTypes: v.optional(v.array(v.string())),
      })
    ),
    itemMastery: v.any(),
    sessionStats: v.object({
      totalDrills: v.number(),
      correctDrills: v.number(),
      hintsUsed: v.number(),
      totalTimeSpent: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      currentStageIndex: args.currentStageIndex,
      stages: args.stages,
      itemMastery: args.itemMastery,
      sessionStats: args.sessionStats,
      lastActivityAt: Date.now(),
    });
  },
});

// Complete a learning session
export const completeSession = mutation({
  args: {
    sessionId: v.id("hola_lessonSessions"),
    sessionStats: v.object({
      totalDrills: v.number(),
      correctDrills: v.number(),
      hintsUsed: v.number(),
      totalTimeSpent: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      status: "completed",
      completedAt: Date.now(),
      sessionStats: args.sessionStats,
      lastActivityAt: Date.now(),
    });
  },
});

// Get existing session for a lesson
export const getSession = query({
  args: {
    userId: v.id("users"),
    lessonId: v.id("hola_moduleLessons"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hola_lessonSessions")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", args.userId).eq("lessonId", args.lessonId)
      )
      .filter((q) => q.eq(q.field("status"), "in_progress"))
      .first();
  },
});

// Get user's learning statistics
export const getUserLearningStats = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("hola_lessonSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const completedSessions = sessions.filter((s) => s.status === "completed");
    const totalDrills = sessions.reduce(
      (sum, s) => sum + (s.sessionStats?.totalDrills || 0),
      0
    );
    const correctDrills = sessions.reduce(
      (sum, s) => sum + (s.sessionStats?.correctDrills || 0),
      0
    );
    const totalTime = sessions.reduce(
      (sum, s) => sum + (s.sessionStats?.totalTimeSpent || 0),
      0
    );

    return {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      totalDrills,
      correctDrills,
      accuracy: totalDrills > 0 ? Math.round((correctDrills / totalDrills) * 100) : 0,
      totalTimeSpent: totalTime,
    };
  },
});

// Abandon a session (if user exits without completing)
export const abandonSession = mutation({
  args: {
    sessionId: v.id("hola_lessonSessions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      status: "abandoned",
      lastActivityAt: Date.now(),
    });
  },
});
