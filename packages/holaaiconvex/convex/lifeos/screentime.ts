import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";

// ==================== MUTATIONS ====================

/**
 * Batch upsert Screen Time sessions
 * Creates sessions that don't exist (deduplication by sessionKey)
 */
export const upsertSessionBatch = mutation({
  args: {
    sessions: v.array(
      v.object({
        sessionKey: v.string(),
        bundleId: v.string(),
        appName: v.optional(v.string()),
        category: v.optional(v.string()),
        startTime: v.number(),
        endTime: v.number(),
        durationSeconds: v.number(),
        timezoneOffset: v.optional(v.number()),
        deviceId: v.optional(v.string()),
        isWebUsage: v.boolean(),
        domain: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    let insertedCount = 0;

    for (const session of args.sessions) {
      // Check if session already exists (deduplication)
      const existing = await ctx.db
        .query("life_screentimeSessions")
        .withIndex("by_session_key", (q) =>
          q.eq("userId", user._id).eq("sessionKey", session.sessionKey)
        )
        .unique();

      if (!existing) {
        await ctx.db.insert("life_screentimeSessions", {
          userId: user._id,
          sessionKey: session.sessionKey,
          bundleId: session.bundleId,
          appName: session.appName,
          category: session.category,
          startTime: session.startTime,
          endTime: session.endTime,
          durationSeconds: session.durationSeconds,
          timezoneOffset: session.timezoneOffset,
          deviceId: session.deviceId,
          isWebUsage: session.isWebUsage,
          domain: session.domain,
          createdAt: now,
        });
        insertedCount++;
      }
    }

    return { insertedCount };
  },
});

/**
 * Upsert a daily Screen Time summary
 * Creates or updates the summary for a specific date
 */
export const upsertDailySummary = mutation({
  args: {
    date: v.string(),
    totalSeconds: v.number(),
    appUsage: v.array(
      v.object({
        bundleId: v.string(),
        appName: v.optional(v.string()),
        category: v.optional(v.string()),
        seconds: v.number(),
        sessionCount: v.number(),
      })
    ),
    categoryUsage: v.array(
      v.object({
        category: v.string(),
        seconds: v.number(),
      })
    ),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Check if summary already exists for this user and date
    const existing = await ctx.db
      .query("life_screentimeDailySummaries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date)
      )
      .unique();

    if (existing) {
      // Update existing summary
      await ctx.db.patch(existing._id, {
        totalSeconds: args.totalSeconds,
        appUsage: args.appUsage,
        categoryUsage: args.categoryUsage,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new summary
    return await ctx.db.insert("life_screentimeDailySummaries", {
      userId: user._id,
      date: args.date,
      totalSeconds: args.totalSeconds,
      appUsage: args.appUsage,
      categoryUsage: args.categoryUsage,
      deviceId: args.deviceId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update Screen Time sync status
 */
export const updateSyncStatus = mutation({
  args: {
    lastSyncAt: v.number(),
    lastSessionTime: v.number(),
    deviceId: v.optional(v.string()),
    autoSyncEnabled: v.optional(v.boolean()),
    autoSyncIntervalMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Check if status already exists
    const existing = await ctx.db
      .query("life_screentimeSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      // Update existing status
      await ctx.db.patch(existing._id, {
        lastSyncAt: args.lastSyncAt,
        lastSessionTime: args.lastSessionTime,
        deviceId: args.deviceId ?? existing.deviceId,
        autoSyncEnabled: args.autoSyncEnabled ?? existing.autoSyncEnabled,
        autoSyncIntervalMinutes:
          args.autoSyncIntervalMinutes ?? existing.autoSyncIntervalMinutes,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new status
    return await ctx.db.insert("life_screentimeSyncStatus", {
      userId: user._id,
      lastSyncAt: args.lastSyncAt,
      lastSessionTime: args.lastSessionTime,
      deviceId: args.deviceId,
      autoSyncEnabled: args.autoSyncEnabled ?? false,
      autoSyncIntervalMinutes: args.autoSyncIntervalMinutes ?? 30,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ==================== QUERIES ====================

/**
 * Get Screen Time sync status for the authenticated user
 */
export const getSyncStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("life_screentimeSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
  },
});

/**
 * Get daily summary for a specific date
 */
export const getDailySummary = query({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("life_screentimeDailySummaries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date)
      )
      .unique();
  },
});

/**
 * Get recent daily summaries (last N days)
 */
export const getRecentSummaries = query({
  args: {
    days: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Get all summaries and sort by date descending
    const summaries = await ctx.db
      .query("life_screentimeDailySummaries")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Sort by date descending and take the requested number
    return summaries
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, args.days);
  },
});

/**
 * Get sessions by date range
 */
export const getSessionsByDateRange = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Get sessions within the date range
    const sessions = await ctx.db
      .query("life_screentimeSessions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).gte("startTime", args.startDate)
      )
      .filter((q) => q.lte(q.field("startTime"), args.endDate))
      .collect();

    return sessions;
  },
});

/**
 * Get sessions for a specific app
 */
export const getSessionsByApp = query({
  args: {
    bundleId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const sessions = await ctx.db
      .query("life_screentimeSessions")
      .withIndex("by_user_bundle", (q) =>
        q.eq("userId", user._id).eq("bundleId", args.bundleId)
      )
      .collect();

    // Sort by startTime descending and limit
    return sessions
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, args.limit ?? 100);
  },
});

/**
 * Get top apps by usage for a date range
 */
export const getTopApps = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 10;

    // Get all sessions in the date range
    const sessions = await ctx.db
      .query("life_screentimeSessions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).gte("startTime", args.startDate)
      )
      .filter((q) => q.lte(q.field("startTime"), args.endDate))
      .collect();

    // Aggregate by bundleId
    const appUsage = new Map<
      string,
      { bundleId: string; appName: string | undefined; totalSeconds: number; sessionCount: number }
    >();

    for (const session of sessions) {
      const existing = appUsage.get(session.bundleId);
      if (existing) {
        existing.totalSeconds += session.durationSeconds;
        existing.sessionCount += 1;
      } else {
        appUsage.set(session.bundleId, {
          bundleId: session.bundleId,
          appName: session.appName,
          totalSeconds: session.durationSeconds,
          sessionCount: 1,
        });
      }
    }

    // Sort by total seconds and return top N
    return Array.from(appUsage.values())
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .slice(0, limit);
  },
});

/**
 * Get total screen time for today
 */
export const getTodayTotal = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    const summary = await ctx.db
      .query("life_screentimeDailySummaries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", today)
      )
      .unique();

    return summary?.totalSeconds ?? 0;
  },
});
