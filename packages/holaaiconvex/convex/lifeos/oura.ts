import { v } from "convex/values";
import { query, mutation, internalMutation } from "../_generated/server";
import { getAuthUserId } from "../_lib/auth";

// ==================== QUERIES ====================

export const getTokenStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const token = await ctx.db
      .query("lifeos_ouraTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!token) return null;
    return { connected: true, connectedAt: token.connectedAt, expiresAt: token.expiresAt };
  },
});

export const getSyncStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("lifeos_ouraSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const getDailySleep = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const limit = args.days ?? 30;
    return await ctx.db
      .query("lifeos_ouraDailySleep")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const getDailyActivity = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const limit = args.days ?? 30;
    return await ctx.db
      .query("lifeos_ouraDailyActivity")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const getDailyReadiness = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const limit = args.days ?? 30;
    return await ctx.db
      .query("lifeos_ouraDailyReadiness")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const getDailyStress = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const limit = args.days ?? 30;
    return await ctx.db
      .query("lifeos_ouraDailyStress")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const getDailySpo2 = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const limit = args.days ?? 30;
    return await ctx.db
      .query("lifeos_ouraDailySpo2")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const getHeartRate = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const limit = args.days ?? 14;
    return await ctx.db
      .query("lifeos_ouraHeartRate")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const getWorkouts = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const limit = args.days ?? 30;
    return await ctx.db
      .query("lifeos_ouraWorkouts")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

// ==================== MUTATIONS (user-facing) ====================

export const disconnectOura = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const token = await ctx.db
      .query("lifeos_ouraTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (token) await ctx.db.delete(token._id);

    const syncStatus = await ctx.db
      .query("lifeos_ouraSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (syncStatus) await ctx.db.delete(syncStatus._id);
  },
});

// ==================== INTERNAL MUTATIONS (called from actions) ====================

export const upsertTokens = internalMutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("lifeos_ouraTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        scope: args.scope,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("lifeos_ouraTokens", {
        userId: args.userId,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        scope: args.scope,
        connectedAt: now,
        updatedAt: now,
      });
    }
  },
});

export const updateSyncStatus = internalMutation({
  args: {
    userId: v.id("users"),
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
    ),
    lastSyncedDate: v.optional(v.string()),
    lastSyncError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("lifeos_ouraSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    const data = {
      status: args.status,
      lastSyncAt: args.status === "success" || args.status === "failed" ? now : undefined,
      lastSyncedDate: args.lastSyncedDate,
      lastSyncError: args.lastSyncError,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("lifeos_ouraSyncStatus", {
        userId: args.userId,
        ...data,
        createdAt: now,
      });
    }
  },
});

export const upsertDailySleep = internalMutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    score: v.optional(v.number()),
    totalSleepDuration: v.optional(v.number()),
    deepSleepDuration: v.optional(v.number()),
    remSleepDuration: v.optional(v.number()),
    lightSleepDuration: v.optional(v.number()),
    awakeDuration: v.optional(v.number()),
    efficiency: v.optional(v.number()),
    latency: v.optional(v.number()),
    hrv: v.optional(v.number()),
    restingHeartRate: v.optional(v.number()),
    contributors: v.optional(
      v.object({
        deep_sleep: v.optional(v.number()),
        efficiency: v.optional(v.number()),
        latency: v.optional(v.number()),
        rem_sleep: v.optional(v.number()),
        restfulness: v.optional(v.number()),
        timing: v.optional(v.number()),
        total_sleep: v.optional(v.number()),
      }),
    ),
    rawData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("lifeos_ouraDailySleep")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", args.date))
      .unique();

    const { userId, ...rest } = args;
    if (existing) {
      await ctx.db.patch(existing._id, { ...rest, updatedAt: now });
    } else {
      await ctx.db.insert("lifeos_ouraDailySleep", {
        userId,
        ...rest,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const upsertDailyActivity = internalMutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    score: v.optional(v.number()),
    steps: v.optional(v.number()),
    activeCalories: v.optional(v.number()),
    totalCalories: v.optional(v.number()),
    equivalentWalkingDistance: v.optional(v.number()),
    highActivityTime: v.optional(v.number()),
    mediumActivityTime: v.optional(v.number()),
    lowActivityTime: v.optional(v.number()),
    sedentaryTime: v.optional(v.number()),
    contributors: v.optional(
      v.object({
        meet_daily_targets: v.optional(v.number()),
        move_every_hour: v.optional(v.number()),
        recovery_time: v.optional(v.number()),
        stay_active: v.optional(v.number()),
        training_frequency: v.optional(v.number()),
        training_volume: v.optional(v.number()),
      }),
    ),
    rawData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("lifeos_ouraDailyActivity")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", args.date))
      .unique();

    const { userId, ...rest } = args;
    if (existing) {
      await ctx.db.patch(existing._id, { ...rest, updatedAt: now });
    } else {
      await ctx.db.insert("lifeos_ouraDailyActivity", {
        userId,
        ...rest,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const upsertDailyReadiness = internalMutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    score: v.optional(v.number()),
    temperatureDeviation: v.optional(v.number()),
    contributors: v.optional(
      v.object({
        activity_balance: v.optional(v.number()),
        body_temperature: v.optional(v.number()),
        hrv_balance: v.optional(v.number()),
        previous_day_activity: v.optional(v.number()),
        previous_night: v.optional(v.number()),
        recovery_index: v.optional(v.number()),
        resting_heart_rate: v.optional(v.number()),
        sleep_balance: v.optional(v.number()),
      }),
    ),
    rawData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("lifeos_ouraDailyReadiness")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", args.date))
      .unique();

    const { userId, ...rest } = args;
    if (existing) {
      await ctx.db.patch(existing._id, { ...rest, updatedAt: now });
    } else {
      await ctx.db.insert("lifeos_ouraDailyReadiness", {
        userId,
        ...rest,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const upsertDailyStress = internalMutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    stressHigh: v.optional(v.number()),
    recoveryHigh: v.optional(v.number()),
    dayTotal: v.optional(v.number()),
    rawData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("lifeos_ouraDailyStress")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", args.date))
      .unique();

    const { userId, ...rest } = args;
    if (existing) {
      await ctx.db.patch(existing._id, { ...rest, updatedAt: now });
    } else {
      await ctx.db.insert("lifeos_ouraDailyStress", {
        userId,
        ...rest,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const upsertDailySpo2 = internalMutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    spo2Average: v.optional(v.number()),
    rawData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("lifeos_ouraDailySpo2")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", args.date))
      .unique();

    const { userId, ...rest } = args;
    if (existing) {
      await ctx.db.patch(existing._id, { ...rest, updatedAt: now });
    } else {
      await ctx.db.insert("lifeos_ouraDailySpo2", {
        userId,
        ...rest,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const upsertHeartRate = internalMutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    readings: v.array(
      v.object({
        bpm: v.number(),
        source: v.string(),
        timestamp: v.string(),
      }),
    ),
    minBpm: v.optional(v.number()),
    maxBpm: v.optional(v.number()),
    avgBpm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("lifeos_ouraHeartRate")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", args.date))
      .unique();

    const { userId, ...rest } = args;
    if (existing) {
      await ctx.db.patch(existing._id, { ...rest, updatedAt: now });
    } else {
      await ctx.db.insert("lifeos_ouraHeartRate", {
        userId,
        ...rest,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const upsertWorkout = internalMutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    ouraId: v.string(),
    activity: v.string(),
    calories: v.optional(v.number()),
    distance: v.optional(v.number()),
    duration: v.optional(v.number()),
    intensity: v.optional(v.string()),
    startDatetime: v.optional(v.string()),
    endDatetime: v.optional(v.string()),
    rawData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("lifeos_ouraWorkouts")
      .withIndex("by_oura_id", (q) => q.eq("userId", args.userId).eq("ouraId", args.ouraId))
      .unique();

    const { userId, ...rest } = args;
    if (existing) {
      await ctx.db.patch(existing._id, { ...rest, updatedAt: now });
    } else {
      await ctx.db.insert("lifeos_ouraWorkouts", {
        userId,
        ...rest,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Internal query to get all users with tokens (for cron)
export const getAllUsersWithTokens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tokens = await ctx.db.query("lifeos_ouraTokens").collect();
    return tokens.map((t) => ({
      userId: t.userId,
      accessToken: t.accessToken,
      refreshToken: t.refreshToken,
      expiresAt: t.expiresAt,
    }));
  },
});

export const getTokensForUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lifeos_ouraTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const getSyncStatusForUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lifeos_ouraSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});
