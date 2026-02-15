import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Oura Ring Health Tables
 *
 * Stores OAuth tokens, sync status, and daily health data from Oura Ring API.
 * All table names are prefixed with `lifeos_oura` to avoid conflicts.
 */

export const ouraSyncStatusValidator = v.union(
  v.literal("idle"),
  v.literal("running"),
  v.literal("success"),
  v.literal("failed"),
);

export const ouraTables = {
  // ==================== OURA TOKENS ====================
  lifeos_ouraTokens: defineTable({
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(), // epoch ms
    scope: v.optional(v.string()),
    connectedAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ==================== OURA SYNC STATUS ====================
  lifeos_ouraSyncStatus: defineTable({
    userId: v.id("users"),
    status: ouraSyncStatusValidator,
    lastSyncAt: v.optional(v.number()),
    lastSyncedDate: v.optional(v.string()), // YYYY-MM-DD
    lastSyncError: v.optional(v.string()),
    updatedAt: v.number(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // ==================== OURA DAILY SLEEP ====================
  lifeos_ouraDailySleep: defineTable({
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD
    // Scores
    score: v.optional(v.number()),
    // Durations in seconds
    totalSleepDuration: v.optional(v.number()),
    deepSleepDuration: v.optional(v.number()),
    remSleepDuration: v.optional(v.number()),
    lightSleepDuration: v.optional(v.number()),
    awakeDuration: v.optional(v.number()),
    // Quality metrics
    efficiency: v.optional(v.number()),
    latency: v.optional(v.number()),
    // Biometrics
    hrv: v.optional(v.number()),
    restingHeartRate: v.optional(v.number()),
    // Contributor scores
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
    // Raw JSON for debugging
    rawData: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  // ==================== OURA DAILY ACTIVITY ====================
  lifeos_ouraDailyActivity: defineTable({
    userId: v.id("users"),
    date: v.string(),
    score: v.optional(v.number()),
    steps: v.optional(v.number()),
    activeCalories: v.optional(v.number()),
    totalCalories: v.optional(v.number()),
    equivalentWalkingDistance: v.optional(v.number()),
    highActivityTime: v.optional(v.number()), // seconds
    mediumActivityTime: v.optional(v.number()),
    lowActivityTime: v.optional(v.number()),
    sedentaryTime: v.optional(v.number()),
    // Contributor scores
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  // ==================== OURA DAILY READINESS ====================
  lifeos_ouraDailyReadiness: defineTable({
    userId: v.id("users"),
    date: v.string(),
    score: v.optional(v.number()),
    temperatureDeviation: v.optional(v.number()),
    // Contributor scores
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  // ==================== OURA DAILY STRESS ====================
  lifeos_ouraDailyStress: defineTable({
    userId: v.id("users"),
    date: v.string(),
    stressHigh: v.optional(v.number()),
    recoveryHigh: v.optional(v.number()),
    dayTotal: v.optional(v.number()),
    rawData: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  // ==================== OURA DAILY SPO2 ====================
  lifeos_ouraDailySpo2: defineTable({
    userId: v.id("users"),
    date: v.string(),
    spo2Average: v.optional(v.number()),
    rawData: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  // ==================== OURA HEART RATE (daily batch) ====================
  lifeos_ouraHeartRate: defineTable({
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  // ==================== OURA WORKOUTS ====================
  lifeos_ouraWorkouts: defineTable({
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD
    ouraId: v.string(),
    activity: v.string(),
    calories: v.optional(v.number()),
    distance: v.optional(v.number()),
    duration: v.optional(v.number()), // seconds
    intensity: v.optional(v.string()),
    startDatetime: v.optional(v.string()),
    endDatetime: v.optional(v.string()),
    rawData: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_oura_id", ["userId", "ouraId"]),
};
