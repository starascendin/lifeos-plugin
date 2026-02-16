"use node";

/**
 * Crypto Portfolio Actions
 *
 * Uses ccxt to fetch balances from Binance (and other exchanges).
 * Requires a non-US proxy since Convex servers are US-based and Binance
 * geo-blocks US IPs. Set BINANCE_PROXY env var to an HTTP/HTTPS/SOCKS proxy.
 *
 * Env vars:
 *   BINANCE_PROXY          — proxy URL, e.g. "http://proxy.example.com:8080"
 *                             or "socks5://user:pass@proxy.example.com:1080"
 *   BINANCE_1_NAME         — account display name
 *   BINANCE_1_API_KEY      — read-only API key
 *   BINANCE_1_API_SECRET   — API secret
 *   BINANCE_2_NAME, etc.
 */

import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import ccxt from "ccxt";

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

interface BinanceAccountConfig {
  name: string;
  apiKey: string;
  apiSecret: string;
}

function getBinanceAccounts(): BinanceAccountConfig[] {
  const accounts: BinanceAccountConfig[] = [];
  for (let i = 1; i <= 10; i++) {
    const name = process.env[`BINANCE_${i}_NAME`];
    const apiKey = process.env[`BINANCE_${i}_API_KEY`];
    const apiSecret = process.env[`BINANCE_${i}_API_SECRET`];
    if (!name || !apiKey || !apiSecret) break;
    accounts.push({ name, apiKey, apiSecret });
  }
  if (accounts.length === 0) {
    throw new Error(
      "No Binance accounts configured. Set BINANCE_1_NAME, BINANCE_1_API_KEY, BINANCE_1_API_SECRET env vars.",
    );
  }
  return accounts;
}

function getProxyConfig(): Record<string, string> {
  const proxy = process.env.BINANCE_PROXY;
  if (!proxy) {
    throw new Error(
      "BINANCE_PROXY env var required. Convex servers are US-based and Binance blocks US IPs. " +
        "Set to an HTTP/HTTPS/SOCKS5 proxy in a non-restricted region. " +
        'e.g. "http://proxy.example.com:8080" or "socks5://user:pass@host:1080"',
    );
  }

  if (proxy.startsWith("socks")) {
    return { socksProxy: proxy };
  }
  // ccxt uses httpsProxy for HTTPS targets (which Binance API is)
  return { httpsProxy: proxy };
}

async function fetchBinanceBalances(config: BinanceAccountConfig) {
  const proxyConfig = getProxyConfig();

  const exchange = new ccxt.binance({
    apiKey: config.apiKey,
    secret: config.apiSecret,
    enableRateLimit: true,
    ...proxyConfig,
  });

  // Fetch spot balances
  const balance = await exchange.fetchBalance();

  // Get non-zero assets
  const bal = balance as unknown as Record<string, Record<string, number>>;
  const nonZeroAssets = Object.entries(bal.total || {})
    .filter(([, amount]) => amount > 0)
    .map(([asset]) => asset);

  // Build ticker symbols for price lookup
  const stablecoins = new Set([
    "USDT", "USDC", "BUSD", "TUSD", "DAI", "FDUSD",
  ]);
  const tickerSymbols: string[] = [];
  for (const asset of nonZeroAssets) {
    if (asset === "USD" || stablecoins.has(asset)) continue;
    tickerSymbols.push(`${asset}/USDT`);
  }

  // Fetch prices
  const prices = new Map<string, number>();
  for (const sc of stablecoins) prices.set(sc, 1);
  prices.set("USD", 1);

  if (tickerSymbols.length > 0) {
    try {
      const tickers = await exchange.fetchTickers(tickerSymbols);
      for (const [symbol, ticker] of Object.entries(tickers)) {
        const asset = symbol.split("/")[0];
        if (ticker.last) prices.set(asset, ticker.last);
      }
    } catch {
      // Batch might fail if some pairs don't exist — try one by one
      for (const sym of tickerSymbols) {
        try {
          const ticker = await exchange.fetchTicker(sym);
          const asset = sym.split("/")[0];
          if (ticker.last) prices.set(asset, ticker.last);
        } catch {
          // Skip un-priceable assets
        }
      }
    }
  }

  // Build balance list
  const balances: Array<{
    asset: string;
    free: number;
    locked: number;
    total: number;
    usdValue: number;
    usdPrice: number;
  }> = [];
  let totalUsdValue = 0;

  for (const asset of nonZeroAssets) {
    const free = bal.free?.[asset] || 0;
    const locked = bal.used?.[asset] || 0;
    const total = bal.total?.[asset] || 0;
    const price = prices.get(asset) ?? 0;
    const usdValue = total * price;
    totalUsdValue += usdValue;

    balances.push({
      asset,
      free,
      locked,
      total,
      usdValue: Math.round(usdValue * 100),
      usdPrice: Math.round(price * 100),
    });
  }

  return {
    balances: balances.sort((a, b) => b.usdValue - a.usdValue),
    totalUsdValue: Math.round(totalUsdValue * 100),
    assetCount: balances.filter((b) => b.usdValue > 0).length,
  };
}

// ==================== CORE SYNC LOGIC ====================

async function syncForUser(
  ctx: any,
  userId: Id<"users">,
): Promise<{ totalUsdValue: number; accountCount: number }> {
  await ctx.runMutation(internal.lifeos.crypto.updateSyncStatus, {
    userId,
    status: "running",
  });

  try {
    const configs = getBinanceAccounts();
    let grandTotalUsd = 0;

    for (const config of configs) {
      const { balances, totalUsdValue, assetCount } =
        await fetchBinanceBalances(config);

      const accountId = await ctx.runMutation(
        internal.lifeos.crypto.upsertAccount,
        {
          userId,
          exchange: "binance",
          accountName: config.name,
          apiKeyLastFour: config.apiKey.slice(-4),
          totalUsdValue,
          assetCount,
        },
      );

      await ctx.runMutation(internal.lifeos.crypto.upsertBalances, {
        userId,
        accountId,
        balances,
      });

      grandTotalUsd += totalUsdValue;
    }

    await ctx.runMutation(internal.lifeos.crypto.updateSyncStatus, {
      userId,
      status: "success",
      totalUsdValue: grandTotalUsd,
      accountCount: configs.length,
    });

    return { totalUsdValue: grandTotalUsd, accountCount: configs.length };
  } catch (error: any) {
    await ctx.runMutation(internal.lifeos.crypto.updateSyncStatus, {
      userId,
      status: "failed",
      lastSyncError: error.message ?? String(error),
    });
    throw error;
  }
}

// ==================== ACTIONS ====================

/** User-facing action (requires auth) */
export const syncAllAccounts = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getActionUserId(ctx);
    const result = await syncForUser(ctx, userId);
    return { success: true, ...result };
  },
});

/** Cron job: sync all users that have crypto accounts */
export const cronSyncAllUsers = internalAction({
  args: {},
  handler: async (ctx) => {
    const userIds = await ctx.runQuery(
      internal.lifeos.crypto.getUsersWithCryptoAccounts,
    );

    for (const userId of userIds) {
      try {
        await syncForUser(ctx, userId);
        console.log(`Crypto sync succeeded for user ${userId}`);
      } catch (err: any) {
        console.error(`Crypto sync failed for user ${userId}:`, err.message);
      }
    }
  },
});
