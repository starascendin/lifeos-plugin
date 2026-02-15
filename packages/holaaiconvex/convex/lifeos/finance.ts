import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getAuthUserId } from "../_lib/auth";

// ==================== QUERIES ====================

export const getAccounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("lifeos_financeAccounts")
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
      .query("lifeos_financeSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const getTransactions = query({
  args: {
    accountId: v.optional(v.id("lifeos_financeAccounts")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const limit = args.limit ?? 100;

    if (args.accountId) {
      return await ctx.db
        .query("lifeos_financeTransactions")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("lifeos_financeTransactions")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const getNetWorthSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId)
      return { totalAssets: 0, totalLiabilities: 0, netWorth: 0, accounts: [] };

    const accounts = await ctx.db
      .query("lifeos_financeAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let totalAssets = 0;
    let totalLiabilities = 0;

    for (const acct of accounts) {
      if (acct.assetClass === "asset") {
        totalAssets += acct.balanceCents;
      } else {
        totalLiabilities += acct.balanceCents;
      }
    }

    return {
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      accounts,
    };
  },
});

export const getSnapshots = query({
  args: {
    days: v.optional(v.number()), // default 90
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const days = args.days ?? 90;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    return await ctx.db
      .query("lifeos_financeSnapshots")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).gte("date", cutoffStr),
      )
      .collect();
  },
});

export const getDailySpending = query({
  args: {
    days: v.optional(v.number()), // default 30
    accountId: v.optional(v.id("lifeos_financeAccounts")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const days = args.days ?? 30;
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

    let txns;
    if (args.accountId) {
      txns = await ctx.db
        .query("lifeos_financeTransactions")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId!))
        .collect();
      txns = txns.filter((t) => t.dateMs >= cutoffMs);
    } else {
      txns = await ctx.db
        .query("lifeos_financeTransactions")
        .withIndex("by_user_date", (q) =>
          q.eq("userId", userId).gte("dateMs", cutoffMs),
        )
        .collect();
    }

    // Aggregate by day
    const byDay = new Map<
      string,
      { income: number; spending: number; net: number }
    >();
    for (const t of txns) {
      const existing = byDay.get(t.date) ?? {
        income: 0,
        spending: 0,
        net: 0,
      };
      if (t.amountCents >= 0) {
        existing.income += t.amountCents;
      } else {
        existing.spending += Math.abs(t.amountCents);
      }
      existing.net += t.amountCents;
      byDay.set(t.date, existing);
    }

    return Array.from(byDay.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});

// ==================== MUTATIONS ====================

/**
 * Sync a single account with its transactions to Convex.
 * Called from the frontend after Rust reads + cleans the scraped JSON.
 * We split per-account to stay within Convex mutation limits.
 */
export const syncAccount = mutation({
  args: {
    accountNum: v.string(),
    institution: v.string(),
    accountName: v.string(),
    accountType: v.union(
      v.literal("cash"),
      v.literal("investment"),
      v.literal("credit_card"),
      v.literal("loan"),
      v.literal("other"),
    ),
    accountSubtype: v.union(
      v.literal("checking"),
      v.literal("savings"),
      v.literal("roth_ira"),
      v.literal("rollover_ira"),
      v.literal("brokerage"),
      v.literal("individual"),
      v.literal("401k"),
      v.literal("credit_card"),
      v.literal("other"),
    ),
    assetClass: v.union(v.literal("asset"), v.literal("liability")),
    balanceCents: v.number(),
    isDebt: v.boolean(),
    rawInstitution: v.optional(v.string()),
    rawAccountTitle: v.optional(v.string()),
    transactions: v.array(
      v.object({
        date: v.string(),
        dateMs: v.number(),
        description: v.string(),
        category: v.string(),
        amountCents: v.number(),
        action: v.optional(v.string()),
        quantity: v.optional(v.number()),
        priceCents: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();

    // Upsert account by (userId, accountNum)
    const existing = await ctx.db
      .query("lifeos_financeAccounts")
      .withIndex("by_user_accountNum", (q) =>
        q.eq("userId", userId).eq("accountNum", args.accountNum),
      )
      .unique();

    let accountId;
    if (existing) {
      await ctx.db.patch(existing._id, {
        institution: args.institution,
        accountName: args.accountName,
        accountType: args.accountType,
        accountSubtype: args.accountSubtype,
        assetClass: args.assetClass,
        balanceCents: args.balanceCents,
        isDebt: args.isDebt,
        rawInstitution: args.rawInstitution,
        rawAccountTitle: args.rawAccountTitle,
        lastSeenAt: now,
        updatedAt: now,
      });
      accountId = existing._id;
    } else {
      accountId = await ctx.db.insert("lifeos_financeAccounts", {
        userId,
        accountNum: args.accountNum,
        institution: args.institution,
        accountName: args.accountName,
        accountType: args.accountType,
        accountSubtype: args.accountSubtype,
        assetClass: args.assetClass,
        balanceCents: args.balanceCents,
        isDebt: args.isDebt,
        rawInstitution: args.rawInstitution,
        rawAccountTitle: args.rawAccountTitle,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Upsert transactions by dedupKey
    let txnCount = 0;
    for (const txn of args.transactions) {
      const dedupKey = `${args.accountNum}::${txn.date}::${txn.description}::${txn.amountCents}`;

      const existingTxn = await ctx.db
        .query("lifeos_financeTransactions")
        .withIndex("by_dedupKey", (q) => q.eq("dedupKey", dedupKey))
        .unique();

      if (existingTxn) {
        await ctx.db.patch(existingTxn._id, {
          category: txn.category,
          action: txn.action,
          quantity: txn.quantity,
          priceCents: txn.priceCents,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("lifeos_financeTransactions", {
          userId,
          accountId,
          dedupKey,
          date: txn.date,
          dateMs: txn.dateMs,
          description: txn.description,
          category: txn.category,
          amountCents: txn.amountCents,
          action: txn.action,
          quantity: txn.quantity,
          priceCents: txn.priceCents,
          createdAt: now,
          updatedAt: now,
        });
      }
      txnCount++;
    }

    return { accountId, transactionCount: txnCount };
  },
});

/**
 * Update the sync status after all accounts have been synced.
 * Also creates/updates today's daily snapshot.
 */
export const updateSyncStatus = mutation({
  args: {
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
    ),
    lastSyncResult: v.optional(v.string()),
    lastSyncError: v.optional(v.string()),
    totalAssetsCents: v.optional(v.number()),
    totalLiabilitiesCents: v.optional(v.number()),
    netWorthCents: v.optional(v.number()),
    accountCount: v.optional(v.number()),
    transactionCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();

    const existing = await ctx.db
      .query("lifeos_financeSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const data = {
      status: args.status,
      lastSyncAt: now,
      lastSyncResult: args.lastSyncResult,
      lastSyncError: args.lastSyncError,
      totalAssetsCents: args.totalAssetsCents,
      totalLiabilitiesCents: args.totalLiabilitiesCents,
      netWorthCents: args.netWorthCents,
      accountCount: args.accountCount,
      transactionCount: args.transactionCount,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("lifeos_financeSyncStatus", {
        userId,
        ...data,
        createdAt: now,
      });
    }

    // Create/update today's daily snapshot on successful sync
    if (
      args.status === "success" &&
      args.totalAssetsCents !== undefined &&
      args.totalLiabilitiesCents !== undefined &&
      args.netWorthCents !== undefined
    ) {
      const today = new Date(now).toISOString().slice(0, 10); // "2026-02-15"

      // Get current account balances for the snapshot
      const accounts = await ctx.db
        .query("lifeos_financeAccounts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      const accountBalances = accounts.map((a) => ({
        accountNum: a.accountNum,
        institution: a.institution,
        accountName: a.accountName,
        accountType: a.accountType,
        assetClass: a.assetClass,
        balanceCents: a.balanceCents,
      }));

      const existingSnapshot = await ctx.db
        .query("lifeos_financeSnapshots")
        .withIndex("by_user_date", (q) =>
          q.eq("userId", userId).eq("date", today),
        )
        .unique();

      if (existingSnapshot) {
        await ctx.db.patch(existingSnapshot._id, {
          netWorthCents: args.netWorthCents,
          totalAssetsCents: args.totalAssetsCents,
          totalLiabilitiesCents: args.totalLiabilitiesCents,
          accountCount: args.accountCount ?? accounts.length,
          accountBalances,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("lifeos_financeSnapshots", {
          userId,
          date: today,
          netWorthCents: args.netWorthCents,
          totalAssetsCents: args.totalAssetsCents,
          totalLiabilitiesCents: args.totalLiabilitiesCents,
          accountCount: args.accountCount ?? accounts.length,
          accountBalances,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  },
});

/**
 * Import historical net worth snapshots (backfill from scraper data).
 * Skips dates that already have a snapshot.
 */
export const importHistoricalSnapshots = mutation({
  args: {
    points: v.array(
      v.object({
        date: v.string(), // ISO "2026-02-15"
        netWorthCents: v.number(),
        assetsCents: v.optional(v.number()),
        liabilitiesCents: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    let imported = 0;
    let skipped = 0;

    for (const point of args.points) {
      // Skip if snapshot already exists for this date
      const existing = await ctx.db
        .query("lifeos_financeSnapshots")
        .withIndex("by_user_date", (q) =>
          q.eq("userId", userId).eq("date", point.date),
        )
        .unique();

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("lifeos_financeSnapshots", {
        userId,
        date: point.date,
        netWorthCents: point.netWorthCents,
        totalAssetsCents: point.assetsCents ?? 0,
        totalLiabilitiesCents: point.liabilitiesCents ?? 0,
        accountCount: 0,
        accountBalances: [], // historical imports don't have per-account detail
        createdAt: now,
        updatedAt: now,
      });
      imported++;
    }

    return { imported, skipped };
  },
});

/**
 * Update the cron schedule for Empower sync.
 * Stored in Convex so the UI can display it. The Tauri store is the
 * source of truth for the Rust scheduler; the frontend writes to both.
 */
export const updateCronSchedule = mutation({
  args: {
    cronExpression: v.string(),
    cronEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();

    const existing = await ctx.db
      .query("lifeos_financeSyncStatus")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        cronExpression: args.cronExpression,
        cronEnabled: args.cronEnabled,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("lifeos_financeSyncStatus", {
        userId,
        status: "idle" as const,
        cronExpression: args.cronExpression,
        cronEnabled: args.cronEnabled,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
