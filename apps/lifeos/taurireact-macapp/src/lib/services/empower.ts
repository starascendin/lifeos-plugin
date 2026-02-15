/**
 * Empower Finance Service
 *
 * Reads cleaned finance data from Tauri Rust backend,
 * then pushes each account + transactions to Convex via mutations.
 *
 * Flow: Rust reads all_accounts.json → cleans data → returns to frontend
 *       → frontend calls syncAccount mutation per account → updates sync status
 */

import { ConvexClient } from "convex/browser";
import { api } from "@holaai/convex";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

// Types matching Rust structs
interface CleanedTransaction {
  date: string;
  dateMs: number;
  description: string;
  category: string;
  amountCents: number;
  action?: string;
  quantity?: number;
  priceCents?: number;
}

interface CleanedAccount {
  accountNum: string;
  institution: string;
  accountName: string;
  accountType: "cash" | "investment" | "credit_card" | "loan" | "other";
  accountSubtype:
    | "checking"
    | "savings"
    | "roth_ira"
    | "rollover_ira"
    | "brokerage"
    | "individual"
    | "401k"
    | "credit_card"
    | "other";
  assetClass: "asset" | "liability";
  balanceCents: number;
  isDebt: boolean;
  rawInstitution: string;
  rawAccountTitle: string;
  transactions: CleanedTransaction[];
}

interface EmpowerReadResult {
  success: boolean;
  accounts: CleanedAccount[];
  message: string;
  error?: string;
}

export interface EmpowerSyncProgress {
  status: "idle" | "reading" | "syncing" | "error" | "complete";
  currentStep: string;
  error?: string;
  accountsSynced: number;
  totalAccounts: number;
  transactionsSynced: number;
}

export const initialSyncProgress: EmpowerSyncProgress = {
  status: "idle",
  currentStep: "",
  accountsSynced: 0,
  totalAccounts: 0,
  transactionsSynced: 0,
};

/**
 * Read scraped data from Rust (all_accounts.json already cleaned)
 */
async function readEmpowerData(): Promise<EmpowerReadResult> {
  if (!isTauri) {
    return { success: false, accounts: [], message: "Not running in Tauri" };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<EmpowerReadResult>("read_empower_data");
}

/**
 * Run the full scraper (Chrome/Patchright) then return cleaned data
 */
async function runEmpowerScraper(): Promise<EmpowerReadResult> {
  if (!isTauri) {
    return { success: false, accounts: [], message: "Not running in Tauri" };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<EmpowerReadResult>("run_empower_scraper");
}

/**
 * Push accounts to Convex one by one via authenticated mutations.
 */
async function pushAccountsToConvex(
  client: ConvexClient,
  accounts: CleanedAccount[],
  onProgress: (update: Partial<EmpowerSyncProgress>) => void,
): Promise<{ totalTransactions: number }> {
  let totalTransactions = 0;

  for (let i = 0; i < accounts.length; i++) {
    const acct = accounts[i];
    onProgress({
      currentStep: `Syncing ${acct.institution} ...${acct.accountNum} (${i + 1}/${accounts.length})`,
      accountsSynced: i,
    });

    const result = await client.mutation(api.lifeos.finance.syncAccount, {
      accountNum: acct.accountNum,
      institution: acct.institution,
      accountName: acct.accountName,
      accountType: acct.accountType,
      accountSubtype: acct.accountSubtype,
      assetClass: acct.assetClass,
      balanceCents: acct.balanceCents,
      isDebt: acct.isDebt,
      rawInstitution: acct.rawInstitution,
      rawAccountTitle: acct.rawAccountTitle,
      transactions: acct.transactions,
    });

    totalTransactions += result.transactionCount;
    onProgress({
      accountsSynced: i + 1,
      transactionsSynced: totalTransactions,
    });
  }

  return { totalTransactions };
}

/**
 * Sync existing scraped data to Convex.
 * Reads from all_accounts.json (Rust), pushes to Convex (frontend mutations).
 */
export async function syncEmpowerToConvex(
  client: ConvexClient,
  onProgress?: (progress: EmpowerSyncProgress) => void,
): Promise<{ success: boolean; message: string }> {
  const updateProgress = (update: Partial<EmpowerSyncProgress>) => {
    onProgress?.({
      ...initialSyncProgress,
      ...update,
    } as EmpowerSyncProgress);
  };

  try {
    updateProgress({ status: "reading", currentStep: "Reading scraped data..." });

    const data = await readEmpowerData();
    if (!data.success || data.accounts.length === 0) {
      updateProgress({
        status: "error",
        currentStep: data.error || "No data found",
        error: data.error || "No scraped data. Run full scrape first.",
      });
      return { success: false, message: data.error || "No data found" };
    }

    updateProgress({
      status: "syncing",
      currentStep: `Syncing ${data.accounts.length} accounts...`,
      totalAccounts: data.accounts.length,
    });

    // Push to Convex
    const { totalTransactions } = await pushAccountsToConvex(
      client,
      data.accounts,
      updateProgress,
    );

    // Compute totals for sync status
    let totalAssets = 0;
    let totalLiabilities = 0;
    for (const a of data.accounts) {
      if (a.assetClass === "asset") totalAssets += a.balanceCents;
      else totalLiabilities += a.balanceCents;
    }

    // Update sync status in Convex
    await client.mutation(api.lifeos.finance.updateSyncStatus, {
      status: "success",
      lastSyncResult: `Synced ${data.accounts.length} accounts, ${totalTransactions} transactions`,
      totalAssetsCents: totalAssets,
      totalLiabilitiesCents: totalLiabilities,
      netWorthCents: totalAssets - totalLiabilities,
      accountCount: data.accounts.length,
      transactionCount: totalTransactions,
    });

    const msg = `Synced ${data.accounts.length} accounts, ${totalTransactions} transactions`;
    updateProgress({
      status: "complete",
      currentStep: msg,
      accountsSynced: data.accounts.length,
      totalAccounts: data.accounts.length,
      transactionsSynced: totalTransactions,
    });

    return { success: true, message: msg };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    updateProgress({ status: "error", currentStep: msg, error: msg });
    return { success: false, message: msg };
  }
}

/**
 * Run full scrape (Chrome) then sync to Convex.
 */
export async function scrapeAndSyncEmpower(
  client: ConvexClient,
  onProgress?: (progress: EmpowerSyncProgress) => void,
): Promise<{ success: boolean; message: string }> {
  const updateProgress = (update: Partial<EmpowerSyncProgress>) => {
    onProgress?.({
      ...initialSyncProgress,
      ...update,
    } as EmpowerSyncProgress);
  };

  try {
    updateProgress({
      status: "reading",
      currentStep: "Running Empower scraper (this takes 2-5 min)...",
    });

    const data = await runEmpowerScraper();
    if (!data.success || data.accounts.length === 0) {
      updateProgress({
        status: "error",
        currentStep: data.error || "Scrape failed",
        error: data.error,
      });
      return { success: false, message: data.error || "Scrape failed" };
    }

    updateProgress({
      status: "syncing",
      currentStep: `Scraped ${data.accounts.length} accounts, syncing to Convex...`,
      totalAccounts: data.accounts.length,
    });

    const { totalTransactions } = await pushAccountsToConvex(
      client,
      data.accounts,
      updateProgress,
    );

    let totalAssets = 0;
    let totalLiabilities = 0;
    for (const a of data.accounts) {
      if (a.assetClass === "asset") totalAssets += a.balanceCents;
      else totalLiabilities += a.balanceCents;
    }

    await client.mutation(api.lifeos.finance.updateSyncStatus, {
      status: "success",
      lastSyncResult: `Scraped & synced ${data.accounts.length} accounts, ${totalTransactions} transactions`,
      totalAssetsCents: totalAssets,
      totalLiabilitiesCents: totalLiabilities,
      netWorthCents: totalAssets - totalLiabilities,
      accountCount: data.accounts.length,
      transactionCount: totalTransactions,
    });

    const msg = `Scraped & synced ${data.accounts.length} accounts, ${totalTransactions} transactions`;
    updateProgress({
      status: "complete",
      currentStep: msg,
      accountsSynced: data.accounts.length,
      totalAccounts: data.accounts.length,
      transactionsSynced: totalTransactions,
    });

    // After scrape+sync, try to import net worth history
    try {
      await importNetWorthHistory(client);
    } catch (e) {
      console.warn("Net worth history import failed:", e);
    }

    return { success: true, message: msg };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    updateProgress({ status: "error", currentStep: msg, error: msg });
    return { success: false, message: msg };
  }
}

interface NetWorthHistoryPoint {
  date: string;
  netWorthCents: number;
  assetsCents?: number;
  liabilitiesCents?: number;
}

interface NetWorthHistoryResult {
  success: boolean;
  points: NetWorthHistoryPoint[];
  message: string;
  error?: string;
}

/**
 * Read net worth history from Rust and import into Convex snapshots.
 * Called automatically after a full scrape.
 */
export async function importNetWorthHistory(
  client: ConvexClient,
): Promise<{ imported: number; skipped: number }> {
  if (!isTauri) return { imported: 0, skipped: 0 };

  const { invoke } = await import("@tauri-apps/api/core");
  const result = await invoke<NetWorthHistoryResult>("read_net_worth_history");

  if (!result.success || result.points.length === 0) {
    return { imported: 0, skipped: 0 };
  }

  console.log(
    `[Empower] Importing ${result.points.length} net worth history points`,
  );

  // Send in batches of 50 to stay within mutation limits
  let totalImported = 0;
  let totalSkipped = 0;
  const batchSize = 50;

  for (let i = 0; i < result.points.length; i += batchSize) {
    const batch = result.points.slice(i, i + batchSize);
    const res = await client.mutation(
      api.lifeos.finance.importHistoricalSnapshots,
      { points: batch },
    );
    totalImported += res.imported;
    totalSkipped += res.skipped;
  }

  if (totalImported > 0) {
    console.log(
      `[Empower] Imported ${totalImported} history points, skipped ${totalSkipped}`,
    );
  }

  return { imported: totalImported, skipped: totalSkipped };
}
