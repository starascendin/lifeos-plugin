import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Personal Finance Tables
 *
 * Stores accounts, transactions, and sync status from Empower Retirement scraper.
 * All table names are prefixed with `lifeos_finance` to avoid conflicts.
 */

export const accountTypeValidator = v.union(
  v.literal("cash"),
  v.literal("investment"),
  v.literal("credit_card"),
  v.literal("loan"),
  v.literal("other"),
);

export const accountSubtypeValidator = v.union(
  v.literal("checking"),
  v.literal("savings"),
  v.literal("roth_ira"),
  v.literal("rollover_ira"),
  v.literal("brokerage"),
  v.literal("individual"),
  v.literal("401k"),
  v.literal("credit_card"),
  v.literal("other"),
);

export const assetClassValidator = v.union(
  v.literal("asset"),
  v.literal("liability"),
);

export const syncStatusValidator = v.union(
  v.literal("idle"),
  v.literal("running"),
  v.literal("success"),
  v.literal("failed"),
);

export const financeTables = {
  // ==================== FINANCE ACCOUNTS ====================
  lifeos_financeAccounts: defineTable({
    userId: v.id("users"),
    accountNum: v.string(),
    institution: v.string(),
    accountName: v.string(),
    accountType: accountTypeValidator,
    accountSubtype: accountSubtypeValidator,
    assetClass: assetClassValidator,
    balanceCents: v.number(),
    isDebt: v.boolean(),
    // Raw fields from scraper (for debugging)
    rawInstitution: v.optional(v.string()),
    rawAccountTitle: v.optional(v.string()),
    // Timestamps
    lastSeenAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_accountNum", ["userId", "accountNum"])
    .index("by_user_type", ["userId", "accountType"])
    .index("by_user_assetClass", ["userId", "assetClass"]),

  // ==================== FINANCE TRANSACTIONS ====================
  lifeos_financeTransactions: defineTable({
    userId: v.id("users"),
    accountId: v.id("lifeos_financeAccounts"),
    dedupKey: v.string(),
    // Transaction fields
    date: v.string(), // ISO "2026-02-14"
    dateMs: v.number(), // epoch ms for sorting
    description: v.string(),
    category: v.string(),
    amountCents: v.number(),
    // Investment-only fields
    action: v.optional(v.string()),
    quantity: v.optional(v.number()),
    priceCents: v.optional(v.number()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_account", ["accountId"])
    .index("by_user_date", ["userId", "dateMs"])
    .index("by_dedupKey", ["dedupKey"])
    .searchIndex("search_description", {
      searchField: "description",
      filterFields: ["userId", "accountId"],
    }),

  // ==================== FINANCE DAILY SNAPSHOTS ====================
  lifeos_financeSnapshots: defineTable({
    userId: v.id("users"),
    date: v.string(), // ISO "2026-02-15" — one row per day
    netWorthCents: v.number(),
    totalAssetsCents: v.number(),
    totalLiabilitiesCents: v.number(),
    accountCount: v.number(),
    // Per-account balances for drill-down
    accountBalances: v.array(
      v.object({
        accountNum: v.string(),
        institution: v.string(),
        accountName: v.string(),
        accountType: v.string(),
        assetClass: v.string(),
        balanceCents: v.number(),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  // ==================== FINANCE SYNC STATUS ====================
  lifeos_financeSyncStatus: defineTable({
    userId: v.id("users"),
    status: syncStatusValidator,
    lastSyncAt: v.optional(v.number()),
    lastSyncResult: v.optional(v.string()),
    lastSyncError: v.optional(v.string()),
    // Snapshot totals
    totalAssetsCents: v.optional(v.number()),
    totalLiabilitiesCents: v.optional(v.number()),
    netWorthCents: v.optional(v.number()),
    accountCount: v.optional(v.number()),
    transactionCount: v.optional(v.number()),
    // Cron schedule (standard 5-field: "0 */6 * * *")
    cronExpression: v.optional(v.string()),
    cronEnabled: v.optional(v.boolean()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
};
