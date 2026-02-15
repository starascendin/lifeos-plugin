"use node";

/**
 * Oura Ring Integration - Actions
 *
 * OAuth flow (authorization URL, token exchange, refresh) and data sync actions.
 * Requires Node.js runtime for fetch. Queries/mutations are in oura.ts.
 */

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

// ==================== CONSTANTS ====================

const OURA_AUTH_URL = "https://cloud.ouraring.com/oauth/authorize";
const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";
const OURA_API_BASE = "https://api.ouraring.com/v2/usercollection";

// ==================== AUTH HELPER ====================

async function getActionUserId(ctx: any): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.runQuery(
    internal.common.users.getUserByTokenIdentifier,
    { tokenIdentifier: identity.tokenIdentifier },
  );
  if (!user) throw new Error("User not found");
  return user._id as Id<"users">;
}

// ==================== HELPERS ====================

function getOuraConfig() {
  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;
  const redirectUri = process.env.OURA_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing OURA_CLIENT_ID, OURA_CLIENT_SECRET, or OURA_REDIRECT_URI env vars");
  }
  return { clientId, clientSecret, redirectUri };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDatetime(d: Date): string {
  return d.toISOString();
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function fetchOuraApi(accessToken: string, endpoint: string, params: Record<string, string>) {
  const url = new URL(`${OURA_API_BASE}/${endpoint}`);
  for (const [k, val] of Object.entries(params)) {
    url.searchParams.set(k, val);
  }
  console.log(`[Oura] Fetching: ${url.toString()}`);
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Oura API ${endpoint} failed (${resp.status}): ${body}`);
  }
  const json = await resp.json();
  const count = json.data?.length ?? "no data key";
  console.log(`[Oura] ${endpoint}: ${count} records`);
  return json;
}

async function refreshTokenIfNeeded(
  ctx: any,
  userId: any,
  accessToken: string,
  refreshToken: string,
  expiresAt: number,
): Promise<string> {
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return accessToken;
  }
  // No refresh token (implicit flow) - just return the access token and hope it works
  if (!refreshToken) {
    console.log("[Oura] Token may be expired but no refresh token available (implicit flow)");
    return accessToken;
  }

  const { clientId, clientSecret } = getOuraConfig();
  const resp = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Token refresh failed (${resp.status}): ${body}`);
  }

  const data = await resp.json();
  const newExpiresAt = Date.now() + data.expires_in * 1000;

  await ctx.runMutation(internal.lifeos.oura.upsertTokens, {
    userId,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: newExpiresAt,
    scope: data.scope,
  });

  return data.access_token;
}

// ==================== OAUTH ACTIONS ====================

export const getAuthorizationUrl = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getActionUserId(ctx);

    const { clientId, redirectUri } = getOuraConfig();
    const scopes = "email personal daily heartrate tag workout session spo2 ring_configuration stress heart_health";
    const state = userId;

    const url = new URL(OURA_AUTH_URL);
    url.searchParams.set("response_type", "token");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes);
    url.searchParams.set("state", state);

    return url.toString();
  },
});

export const exchangeToken = action({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getActionUserId(ctx);
    const { clientId, clientSecret, redirectUri } = getOuraConfig();

    const resp = await fetch(OURA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: args.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!resp.ok) {
      const respBody = await resp.text();
      throw new Error(`Token exchange failed (${resp.status}): ${respBody}`);
    }

    const data = await resp.json();
    const expiresAt = Date.now() + data.expires_in * 1000;

    await ctx.runMutation(internal.lifeos.oura.upsertTokens, {
      userId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      scope: data.scope,
    });

    return { success: true };
  },
});

export const saveImplicitToken = action({
  args: {
    accessToken: v.string(),
    expiresIn: v.number(),
    scope: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getActionUserId(ctx);
    const expiresAt = Date.now() + args.expiresIn * 1000;

    await ctx.runMutation(internal.lifeos.oura.upsertTokens, {
      userId,
      accessToken: args.accessToken,
      refreshToken: "",
      expiresAt,
      scope: args.scope,
    });

    return { success: true };
  },
});

// ==================== SYNC ACTIONS ====================

export const manualSync = action({
  args: { daysBack: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getActionUserId(ctx);

    const tokens = await ctx.runMutation(internal.lifeos.oura.getTokensForUser, { userId });
    if (!tokens) throw new Error("Oura not connected");

    const daysBack = args.daysBack ?? 30;
    await syncUserData(ctx, userId, tokens.accessToken, tokens.refreshToken, tokens.expiresAt, daysBack);
    return { success: true };
  },
});

export const cronSyncAllUsers = internalAction({
  args: {},
  handler: async (ctx) => {
    const allTokens = await ctx.runMutation(internal.lifeos.oura.getAllUsersWithTokens, {});

    for (const t of allTokens) {
      try {
        const syncStatus = await ctx.runMutation(internal.lifeos.oura.getSyncStatusForUser, {
          userId: t.userId,
        });
        const daysBack = syncStatus?.lastSyncedDate ? 3 : 30;
        await syncUserData(ctx, t.userId, t.accessToken, t.refreshToken, t.expiresAt, daysBack);
      } catch (err: any) {
        console.error(`Oura sync failed for user ${t.userId}:`, err.message);
        await ctx.runMutation(internal.lifeos.oura.updateSyncStatus, {
          userId: t.userId,
          status: "failed",
          lastSyncError: err.message,
        });
      }
    }
  },
});

async function syncUserData(
  ctx: any,
  userId: any,
  accessToken: string,
  refreshToken: string,
  expiresAt: number,
  daysBack: number,
) {
  await ctx.runMutation(internal.lifeos.oura.updateSyncStatus, {
    userId,
    status: "running",
  });

  try {
    const token = await refreshTokenIfNeeded(ctx, userId, accessToken, refreshToken, expiresAt);
    const startD = daysAgo(daysBack);
    const endD = new Date();
    const startDate = formatDate(startD);
    const endDate = formatDate(endD);
    // Heartrate needs datetime params
    const startDatetime = formatDatetime(startD);
    const endDatetime = formatDatetime(endD);

    const dateParams = { start_date: startDate, end_date: endDate };
    const datetimeParams = { start_datetime: startDatetime, end_datetime: endDatetime };

    console.log("[Oura] Syncing", { startDate, endDate, tokenLength: token.length, daysBack });

    // Fetch with error logging
    const fetchWithLog = (endpoint: string, params: Record<string, string>) =>
      fetchOuraApi(token, endpoint, params).catch((err: any) => {
        console.error(`[Oura] ${endpoint} failed:`, err.message);
        return { data: [] };
      });

    // Fetch all endpoints - note: heartrate uses datetime params, sleep (periods) is separate from daily_sleep
    const [
      dailySleepData, sleepPeriodsData, activityData, readinessData,
      stressData, spo2Data, heartRateData, workoutData,
    ] = await Promise.all([
      fetchWithLog("daily_sleep", dateParams),
      fetchWithLog("sleep", dateParams),         // Detailed sleep sessions with durations/HRV/HR
      fetchWithLog("daily_activity", dateParams),
      fetchWithLog("daily_readiness", dateParams),
      fetchWithLog("daily_stress", dateParams),
      fetchWithLog("daily_spo2", dateParams),
      fetchWithLog("heartrate", datetimeParams),  // Uses start_datetime/end_datetime
      fetchWithLog("workout", dateParams),
    ]);

    console.log("[Oura] Data counts:", {
      daily_sleep: dailySleepData.data?.length ?? 0,
      sleep_periods: sleepPeriodsData.data?.length ?? 0,
      activity: activityData.data?.length ?? 0,
      readiness: readinessData.data?.length ?? 0,
      stress: stressData.data?.length ?? 0,
      spo2: spo2Data.data?.length ?? 0,
      heartrate: heartRateData.data?.length ?? 0,
      workouts: workoutData.data?.length ?? 0,
    });

    // Merge daily_sleep scores with sleep periods (detailed data)
    // daily_sleep has: score, contributors
    // sleep periods has: durations, HRV, HR, efficiency, latency, bedtime
    const sleepByDate = new Map<string, any>();

    // First add daily_sleep scores
    for (const item of dailySleepData.data ?? []) {
      sleepByDate.set(item.day, {
        score: item.score ?? undefined,
        contributors: item.contributors,
      });
    }

    // Then merge in sleep period details (use the longest/primary period per day)
    for (const item of sleepPeriodsData.data ?? []) {
      const date = item.day;
      const existing = sleepByDate.get(date) ?? {};
      // Only overwrite if this period has more total sleep (primary sleep)
      const existingDuration = existing.totalSleepDuration ?? 0;
      const thisDuration = item.total_sleep_duration ?? 0;
      if (thisDuration >= existingDuration) {
        sleepByDate.set(date, {
          ...existing,
          totalSleepDuration: item.total_sleep_duration ?? undefined,
          deepSleepDuration: item.deep_sleep_duration ?? undefined,
          remSleepDuration: item.rem_sleep_duration ?? undefined,
          lightSleepDuration: item.light_sleep_duration ?? undefined,
          awakeDuration: item.awake_time ?? undefined,
          efficiency: item.efficiency ?? undefined,
          latency: item.latency ?? undefined,
          hrv: item.average_hrv ?? undefined,
          restingHeartRate: item.lowest_heart_rate ?? undefined,
          rawData: JSON.stringify(item),
        });
      }
    }

    // Upsert merged sleep data
    for (const [date, data] of sleepByDate) {
      await ctx.runMutation(internal.lifeos.oura.upsertDailySleep, {
        userId,
        date,
        score: data.score,
        totalSleepDuration: data.totalSleepDuration,
        deepSleepDuration: data.deepSleepDuration,
        remSleepDuration: data.remSleepDuration,
        lightSleepDuration: data.lightSleepDuration,
        awakeDuration: data.awakeDuration,
        efficiency: data.efficiency,
        latency: data.latency,
        hrv: data.hrv,
        restingHeartRate: data.restingHeartRate,
        contributors: data.contributors
          ? {
              deep_sleep: data.contributors.deep_sleep ?? undefined,
              efficiency: data.contributors.efficiency ?? undefined,
              latency: data.contributors.latency ?? undefined,
              rem_sleep: data.contributors.rem_sleep ?? undefined,
              restfulness: data.contributors.restfulness ?? undefined,
              timing: data.contributors.timing ?? undefined,
              total_sleep: data.contributors.total_sleep ?? undefined,
            }
          : undefined,
        rawData: data.rawData,
      });
    }

    // Upsert activity data
    for (const item of activityData.data ?? []) {
      await ctx.runMutation(internal.lifeos.oura.upsertDailyActivity, {
        userId,
        date: item.day,
        score: item.score ?? undefined,
        steps: item.steps ?? undefined,
        activeCalories: item.active_calories ?? undefined,
        totalCalories: item.total_calories ?? undefined,
        equivalentWalkingDistance: item.equivalent_walking_distance ?? undefined,
        highActivityTime: item.high_activity_time ?? undefined,
        mediumActivityTime: item.medium_activity_time ?? undefined,
        lowActivityTime: item.low_activity_time ?? undefined,
        sedentaryTime: item.sedentary_time ?? undefined,
        contributors: item.contributors
          ? {
              meet_daily_targets: item.contributors.meet_daily_targets ?? undefined,
              move_every_hour: item.contributors.move_every_hour ?? undefined,
              recovery_time: item.contributors.recovery_time ?? undefined,
              stay_active: item.contributors.stay_active ?? undefined,
              training_frequency: item.contributors.training_frequency ?? undefined,
              training_volume: item.contributors.training_volume ?? undefined,
            }
          : undefined,
        rawData: JSON.stringify(item),
      });
    }

    // Upsert readiness data
    for (const item of readinessData.data ?? []) {
      await ctx.runMutation(internal.lifeos.oura.upsertDailyReadiness, {
        userId,
        date: item.day,
        score: item.score ?? undefined,
        temperatureDeviation: item.temperature_deviation ?? undefined,
        contributors: item.contributors
          ? {
              activity_balance: item.contributors.activity_balance ?? undefined,
              body_temperature: item.contributors.body_temperature ?? undefined,
              hrv_balance: item.contributors.hrv_balance ?? undefined,
              previous_day_activity: item.contributors.previous_day_activity ?? undefined,
              previous_night: item.contributors.previous_night ?? undefined,
              recovery_index: item.contributors.recovery_index ?? undefined,
              resting_heart_rate: item.contributors.resting_heart_rate ?? undefined,
              sleep_balance: item.contributors.sleep_balance ?? undefined,
            }
          : undefined,
        rawData: JSON.stringify(item),
      });
    }

    // Upsert stress data
    for (const item of stressData.data ?? []) {
      await ctx.runMutation(internal.lifeos.oura.upsertDailyStress, {
        userId,
        date: item.day,
        stressHigh: item.stress_high ?? undefined,
        recoveryHigh: item.recovery_high ?? undefined,
        dayTotal: item.day_summary ?? undefined,
        rawData: JSON.stringify(item),
      });
    }

    // Upsert SpO2 data
    for (const item of spo2Data.data ?? []) {
      await ctx.runMutation(internal.lifeos.oura.upsertDailySpo2, {
        userId,
        date: item.day,
        spo2Average: item.spo2_percentage?.average ?? undefined,
        rawData: JSON.stringify(item),
      });
    }

    // Upsert heart rate - aggregate by date
    const hrByDate = new Map<string, Array<{ bpm: number; source: string; timestamp: string }>>();
    for (const item of heartRateData.data ?? []) {
      const date = item.timestamp?.slice(0, 10);
      if (!date) continue;
      if (!hrByDate.has(date)) hrByDate.set(date, []);
      hrByDate.get(date)!.push({
        bpm: item.bpm,
        source: item.source ?? "unknown",
        timestamp: item.timestamp,
      });
    }
    for (const [date, readings] of hrByDate) {
      const bpms = readings.map((r) => r.bpm);
      await ctx.runMutation(internal.lifeos.oura.upsertHeartRate, {
        userId,
        date,
        readings,
        minBpm: Math.min(...bpms),
        maxBpm: Math.max(...bpms),
        avgBpm: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length),
      });
    }

    // Upsert workouts
    for (const item of workoutData.data ?? []) {
      const date = item.day || item.start_datetime?.slice(0, 10) || endDate;
      await ctx.runMutation(internal.lifeos.oura.upsertWorkout, {
        userId,
        date,
        ouraId: item.id,
        activity: item.activity ?? "unknown",
        calories: item.calories ?? undefined,
        distance: item.distance ?? undefined,
        duration: item.total_duration ?? undefined,
        intensity: item.intensity ?? undefined,
        startDatetime: item.start_datetime ?? undefined,
        endDatetime: item.end_datetime ?? undefined,
        rawData: JSON.stringify(item),
      });
    }

    // Mark success
    await ctx.runMutation(internal.lifeos.oura.updateSyncStatus, {
      userId,
      status: "success",
      lastSyncedDate: endDate,
    });
  } catch (err: any) {
    await ctx.runMutation(internal.lifeos.oura.updateSyncStatus, {
      userId,
      status: "failed",
      lastSyncError: err.message,
    });
    throw err;
  }
}
