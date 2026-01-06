import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc } from "../_generated/dataModel";
import { lifeCategoryValidator, statChangeSourceValidator } from "./avatar_schema";

// ==================== CONSTANTS ====================

const DEFAULT_STATS = {
  health: 50,
  work: 50,
  social: 50,
  learning: 50,
  finance: 50,
};

const STAT_MIN = 0;
const STAT_MAX = 100;

// XP required per level (simple formula: level * 100)
function xpForLevel(level: number): number {
  return level * 100;
}

// Calculate level from total XP
function calculateLevel(totalXP: number): number {
  let level = 1;
  let xpNeeded = 0;
  while (xpNeeded + xpForLevel(level) <= totalXP) {
    xpNeeded += xpForLevel(level);
    level++;
  }
  return level;
}

// Calculate overall level from all stats
function calculateOverallLevel(stats: {
  health: number;
  work: number;
  social: number;
  learning: number;
  finance: number;
}): number {
  const avg = (stats.health + stats.work + stats.social + stats.learning + stats.finance) / 5;
  return Math.floor(avg / 10) + 1; // Level 1-11 based on average stat
}

// Clamp stat value between min and max
function clampStat(value: number): number {
  return Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(value)));
}

// ==================== QUERIES ====================

/**
 * Get avatar stats for the authenticated user
 * Creates default stats if none exist
 */
export const getAvatarStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const stats = await ctx.db
      .query("lifeos_avatarStats")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!stats) {
      // Return default stats (will be created on first update)
      return {
        _id: null,
        userId: user._id,
        ...DEFAULT_STATS,
        overallLevel: calculateOverallLevel(DEFAULT_STATS),
        totalXP: 0,
        lastUpdatedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    return stats;
  },
});

/**
 * Get stats history for charts/animations
 */
export const getStatsHistory = query({
  args: {
    limit: v.optional(v.number()),
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 50;
    const daysBack = args.daysBack ?? 30;

    const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    const history = await ctx.db
      .query("lifeos_avatarStatsHistory")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).gte("recordedAt", cutoffTime)
      )
      .order("desc")
      .take(limit);

    return history;
  },
});

// ==================== MUTATIONS ====================

/**
 * Initialize stats for new user (called internally or on first access)
 */
export const initializeStats = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Check if stats already exist
    const existing = await ctx.db
      .query("lifeos_avatarStats")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      return existing._id;
    }

    const statsId = await ctx.db.insert("lifeos_avatarStats", {
      userId: user._id,
      ...DEFAULT_STATS,
      overallLevel: calculateOverallLevel(DEFAULT_STATS),
      totalXP: 0,
      lastUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Record initial state in history
    await ctx.db.insert("lifeos_avatarStatsHistory", {
      userId: user._id,
      ...DEFAULT_STATS,
      source: "system",
      note: "Initial stats created",
      recordedAt: now,
    });

    return statsId;
  },
});

/**
 * Update a single stat
 */
export const updateStat = mutation({
  args: {
    stat: lifeCategoryValidator,
    value: v.number(),
    source: v.optional(statChangeSourceValidator),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const clampedValue = clampStat(args.value);

    // Get or create stats
    let stats = await ctx.db
      .query("lifeos_avatarStats")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!stats) {
      // Create new stats
      const statsId = await ctx.db.insert("lifeos_avatarStats", {
        userId: user._id,
        ...DEFAULT_STATS,
        [args.stat]: clampedValue,
        overallLevel: calculateOverallLevel({ ...DEFAULT_STATS, [args.stat]: clampedValue }),
        totalXP: 0,
        lastUpdatedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      stats = await ctx.db.get(statsId);
    } else {
      // Calculate delta
      const oldValue = stats[args.stat];
      const delta = clampedValue - oldValue;

      // Update stats
      const newStats = {
        ...stats,
        [args.stat]: clampedValue,
      };
      const newOverallLevel = calculateOverallLevel({
        health: newStats.health,
        work: newStats.work,
        social: newStats.social,
        learning: newStats.learning,
        finance: newStats.finance,
      });

      // Award XP for increases
      const xpGain = delta > 0 ? delta * 10 : 0;

      await ctx.db.patch(stats._id, {
        [args.stat]: clampedValue,
        overallLevel: newOverallLevel,
        totalXP: stats.totalXP + xpGain,
        lastUpdatedAt: now,
        updatedAt: now,
      });

      // Record history
      await ctx.db.insert("lifeos_avatarStatsHistory", {
        userId: user._id,
        health: args.stat === "health" ? clampedValue : stats.health,
        work: args.stat === "work" ? clampedValue : stats.work,
        social: args.stat === "social" ? clampedValue : stats.social,
        learning: args.stat === "learning" ? clampedValue : stats.learning,
        finance: args.stat === "finance" ? clampedValue : stats.finance,
        source: args.source ?? "manual",
        changedStat: args.stat,
        delta,
        note: args.note,
        recordedAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Update all stats at once
 */
export const updateAllStats = mutation({
  args: {
    health: v.number(),
    work: v.number(),
    social: v.number(),
    learning: v.number(),
    finance: v.number(),
    source: v.optional(statChangeSourceValidator),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const newStats = {
      health: clampStat(args.health),
      work: clampStat(args.work),
      social: clampStat(args.social),
      learning: clampStat(args.learning),
      finance: clampStat(args.finance),
    };
    const newOverallLevel = calculateOverallLevel(newStats);

    // Get or create stats
    const stats = await ctx.db
      .query("lifeos_avatarStats")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!stats) {
      await ctx.db.insert("lifeos_avatarStats", {
        userId: user._id,
        ...newStats,
        overallLevel: newOverallLevel,
        totalXP: 0,
        lastUpdatedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // Calculate total XP gain
      const xpGain =
        Math.max(0, newStats.health - stats.health) +
        Math.max(0, newStats.work - stats.work) +
        Math.max(0, newStats.social - stats.social) +
        Math.max(0, newStats.learning - stats.learning) +
        Math.max(0, newStats.finance - stats.finance);

      await ctx.db.patch(stats._id, {
        ...newStats,
        overallLevel: newOverallLevel,
        totalXP: stats.totalXP + xpGain * 10,
        lastUpdatedAt: now,
        updatedAt: now,
      });
    }

    // Record history
    await ctx.db.insert("lifeos_avatarStatsHistory", {
      userId: user._id,
      ...newStats,
      source: args.source ?? "manual",
      note: args.note,
      recordedAt: now,
    });

    return { success: true };
  },
});

/**
 * Increment/decrement a stat by a delta value
 */
export const adjustStat = mutation({
  args: {
    stat: lifeCategoryValidator,
    delta: v.number(),
    source: v.optional(statChangeSourceValidator),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Get or create stats
    let stats = await ctx.db
      .query("lifeos_avatarStats")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!stats) {
      // Initialize with default stats first
      const statsId = await ctx.db.insert("lifeos_avatarStats", {
        userId: user._id,
        ...DEFAULT_STATS,
        overallLevel: calculateOverallLevel(DEFAULT_STATS),
        totalXP: 0,
        lastUpdatedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      stats = (await ctx.db.get(statsId))!;
    }

    const oldValue = stats[args.stat];
    const newValue = clampStat(oldValue + args.delta);
    const actualDelta = newValue - oldValue;

    if (actualDelta === 0) {
      return { success: true, newValue };
    }

    // Update stats
    const newStats = {
      health: args.stat === "health" ? newValue : stats.health,
      work: args.stat === "work" ? newValue : stats.work,
      social: args.stat === "social" ? newValue : stats.social,
      learning: args.stat === "learning" ? newValue : stats.learning,
      finance: args.stat === "finance" ? newValue : stats.finance,
    };
    const newOverallLevel = calculateOverallLevel(newStats);

    // Award XP for increases
    const xpGain = actualDelta > 0 ? actualDelta * 10 : 0;

    await ctx.db.patch(stats._id, {
      [args.stat]: newValue,
      overallLevel: newOverallLevel,
      totalXP: stats.totalXP + xpGain,
      lastUpdatedAt: now,
      updatedAt: now,
    });

    // Record history
    await ctx.db.insert("lifeos_avatarStatsHistory", {
      userId: user._id,
      ...newStats,
      source: args.source ?? "manual",
      changedStat: args.stat,
      delta: actualDelta,
      note: args.note,
      recordedAt: now,
    });

    return { success: true, newValue };
  },
});
