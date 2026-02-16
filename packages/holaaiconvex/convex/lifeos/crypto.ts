import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "../_generated/server";
import { getAuthUserId } from "../_lib/auth";

// ==================== QUERIES ====================

export const getAccounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("lifeos_cryptoAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getBalances = query({
  args: {
    accountId: v.optional(v.id("lifeos_cryptoAccounts")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    if (args.accountId) {
      return await ctx.db
        .query("lifeos_cryptoBalances")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId!))
        .collect();
    }

    return await ctx.db
      .query("lifeos_cryptoBalances")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getSyncStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("lifeos_cryptoSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const getSnapshots = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const days = args.days ?? 90;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    return await ctx.db
      .query("lifeos_cryptoSnapshots")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).gte("date", cutoffStr),
      )
      .collect();
  },
});

export const getPortfolioSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { totalUsdValue: 0, accounts: [], topHoldings: [] };

    const accounts = await ctx.db
      .query("lifeos_cryptoAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let totalUsdValue = 0;
    for (const acct of accounts) {
      totalUsdValue += acct.totalUsdValue;
    }

    // Get all balances and aggregate by asset
    const allBalances = await ctx.db
      .query("lifeos_cryptoBalances")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const byAsset = new Map<
      string,
      { total: number; usdValue: number; usdPrice: number }
    >();
    for (const b of allBalances) {
      const existing = byAsset.get(b.asset) ?? {
        total: 0,
        usdValue: 0,
        usdPrice: b.usdPrice,
      };
      existing.total += b.total;
      existing.usdValue += b.usdValue;
      byAsset.set(b.asset, existing);
    }

    const topHoldings = Array.from(byAsset.entries())
      .map(([asset, data]) => ({ asset, ...data }))
      .filter((h) => h.usdValue > 0)
      .sort((a, b) => b.usdValue - a.usdValue);

    return { totalUsdValue, accounts, topHoldings };
  },
});

// ==================== INTERNAL QUERIES ====================

/** Get distinct userIds that have crypto accounts (for cron sync) */
export const getUsersWithCryptoAccounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("lifeos_cryptoAccounts").collect();
    const userIds = new Set(accounts.map((a) => a.userId));
    return Array.from(userIds);
  },
});

// ==================== MUTATIONS ====================

export const upsertAccount = internalMutation({
  args: {
    userId: v.id("users"),
    exchange: v.string(),
    accountName: v.string(),
    apiKeyLastFour: v.string(),
    totalUsdValue: v.number(),
    assetCount: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find by user + exchange + accountName
    const accounts = await ctx.db
      .query("lifeos_cryptoAccounts")
      .withIndex("by_user_exchange", (q) =>
        q.eq("userId", args.userId).eq("exchange", args.exchange),
      )
      .collect();

    const existing = accounts.find(
      (a) => a.accountName === args.accountName,
    );

    if (existing) {
      await ctx.db.patch(existing._id, {
        apiKeyLastFour: args.apiKeyLastFour,
        totalUsdValue: args.totalUsdValue,
        assetCount: args.assetCount,
        lastSyncAt: now,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("lifeos_cryptoAccounts", {
      userId: args.userId,
      exchange: args.exchange,
      accountName: args.accountName,
      apiKeyLastFour: args.apiKeyLastFour,
      totalUsdValue: args.totalUsdValue,
      assetCount: args.assetCount,
      lastSyncAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const upsertBalances = internalMutation({
  args: {
    userId: v.id("users"),
    accountId: v.id("lifeos_cryptoAccounts"),
    balances: v.array(
      v.object({
        asset: v.string(),
        free: v.number(),
        locked: v.number(),
        total: v.number(),
        usdValue: v.number(),
        usdPrice: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Delete old balances for this account
    const existing = await ctx.db
      .query("lifeos_cryptoBalances")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    for (const b of existing) {
      await ctx.db.delete(b._id);
    }

    // Insert new balances
    for (const b of args.balances) {
      await ctx.db.insert("lifeos_cryptoBalances", {
        userId: args.userId,
        accountId: args.accountId,
        asset: b.asset,
        free: b.free,
        locked: b.locked,
        total: b.total,
        usdValue: b.usdValue,
        usdPrice: b.usdPrice,
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
    lastSyncError: v.optional(v.string()),
    totalUsdValue: v.optional(v.number()),
    accountCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("lifeos_cryptoSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    const data = {
      status: args.status,
      lastSyncAt: now,
      lastSyncError: args.lastSyncError,
      totalUsdValue: args.totalUsdValue,
      accountCount: args.accountCount,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("lifeos_cryptoSyncStatus", {
        userId: args.userId,
        ...data,
        createdAt: now,
      });
    }

    // Create/update today's snapshot on success
    if (args.status === "success" && args.totalUsdValue !== undefined) {
      const today = new Date(now).toISOString().slice(0, 10);

      const accounts = await ctx.db
        .query("lifeos_cryptoAccounts")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();

      const accountValues = accounts.map((a) => ({
        accountId: a._id,
        accountName: a.accountName,
        exchange: a.exchange,
        usdValue: a.totalUsdValue,
      }));

      // Get top holdings across all accounts
      const allBalances = await ctx.db
        .query("lifeos_cryptoBalances")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();

      const byAsset = new Map<string, { total: number; usdValue: number }>();
      for (const b of allBalances) {
        const ex = byAsset.get(b.asset) ?? { total: 0, usdValue: 0 };
        ex.total += b.total;
        ex.usdValue += b.usdValue;
        byAsset.set(b.asset, ex);
      }

      const topHoldings = Array.from(byAsset.entries())
        .map(([asset, data]) => ({ asset, ...data }))
        .filter((h) => h.usdValue > 0)
        .sort((a, b) => b.usdValue - a.usdValue)
        .slice(0, 20);

      const existingSnapshot = await ctx.db
        .query("lifeos_cryptoSnapshots")
        .withIndex("by_user_date", (q) =>
          q.eq("userId", args.userId).eq("date", today),
        )
        .unique();

      if (existingSnapshot) {
        await ctx.db.patch(existingSnapshot._id, {
          totalUsdValue: args.totalUsdValue,
          accountValues,
          topHoldings,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("lifeos_cryptoSnapshots", {
          userId: args.userId,
          date: today,
          totalUsdValue: args.totalUsdValue,
          accountValues,
          topHoldings,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  },
});
