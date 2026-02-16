import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Crypto Portfolio Tables
 *
 * Stores crypto exchange accounts, balances, and snapshots.
 * Supports multiple exchanges (Binance, etc.) with multiple accounts each.
 * All table names are prefixed with `lifeos_crypto` to avoid conflicts.
 */

export const cryptoTables = {
  // ==================== CRYPTO ACCOUNTS ====================
  lifeos_cryptoAccounts: defineTable({
    userId: v.id("users"),
    exchange: v.string(), // "binance", "coinbase", etc.
    accountName: v.string(), // user-friendly name e.g. "MAIN"
    apiKeyLastFour: v.string(), // last 4 chars of API key for display
    // Aggregate values (updated on each sync)
    totalUsdValue: v.number(), // total portfolio value in USD (cents)
    assetCount: v.number(), // number of non-zero assets
    // Timestamps
    lastSyncAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_exchange", ["userId", "exchange"]),

  // ==================== CRYPTO BALANCES ====================
  lifeos_cryptoBalances: defineTable({
    userId: v.id("users"),
    accountId: v.id("lifeos_cryptoAccounts"),
    asset: v.string(), // "BTC", "ETH", "USDT", etc.
    free: v.number(), // available balance
    locked: v.number(), // in orders
    total: v.number(), // free + locked
    usdValue: v.number(), // USD value (cents)
    usdPrice: v.number(), // price per unit in USD (cents)
    // Timestamps
    updatedAt: v.number(),
  })
    .index("by_account", ["accountId"])
    .index("by_user", ["userId"])
    .index("by_account_asset", ["accountId", "asset"]),

  // ==================== CRYPTO SNAPSHOTS ====================
  lifeos_cryptoSnapshots: defineTable({
    userId: v.id("users"),
    date: v.string(), // ISO "2026-02-16"
    totalUsdValue: v.number(), // total across all accounts (cents)
    // Per-account breakdown
    accountValues: v.array(
      v.object({
        accountId: v.string(),
        accountName: v.string(),
        exchange: v.string(),
        usdValue: v.number(),
      }),
    ),
    // Top holdings
    topHoldings: v.array(
      v.object({
        asset: v.string(),
        total: v.number(),
        usdValue: v.number(),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  // ==================== CRYPTO SYNC STATUS ====================
  lifeos_cryptoSyncStatus: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
    ),
    lastSyncAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
    totalUsdValue: v.optional(v.number()),
    accountCount: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
};
