/**
 * Capacitor OTA Updater
 *
 * For internal testing - provides manual OTA update capabilities.
 * Uses @capgo/capacitor-updater with Convex storage for self-hosted updates.
 */

import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { isCapacitor } from "./platform";

export interface UpdateInfo {
  version: string;
  bundleUrl: string;
  releaseNotes?: string;
  fileSize?: number;
  createdAt: number;
}

export interface CheckUpdateResult {
  hasUpdate: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  updateInfo: UpdateInfo | null;
}

/**
 * Initialize the updater - must be called on app start.
 * This notifies the plugin that the app has successfully loaded.
 */
export async function initUpdater(): Promise<void> {
  if (!isCapacitor) return;

  try {
    // Notify the plugin that the app is ready
    // This is required to confirm the update was successful
    await CapacitorUpdater.notifyAppReady();
    console.log("[Updater] App ready notified");
  } catch (error) {
    console.error("[Updater] Failed to notify app ready:", error);
  }
}

/**
 * Download and apply an update from a URL.
 * The URL should point to a zip file containing the web assets.
 *
 * @param updateUrl - URL to the update zip file
 * @param version - Version string for the update
 */
export async function downloadAndApplyUpdate(
  updateUrl: string,
  version: string
): Promise<void> {
  if (!isCapacitor) {
    console.warn("[Updater] Not running in Capacitor, skipping update");
    return;
  }

  try {
    console.log(`[Updater] Downloading update v${version} from ${updateUrl}`);

    // Download the update bundle
    const bundle = await CapacitorUpdater.download({
      url: updateUrl,
      version: version,
    });

    console.log("[Updater] Download complete, applying update...");

    // Apply the update - this will reload the app
    await CapacitorUpdater.set(bundle);
  } catch (error) {
    console.error("[Updater] Update failed:", error);
    throw error;
  }
}

/**
 * Get the current bundle information
 */
export async function getCurrentBundle() {
  if (!isCapacitor) return null;

  try {
    const current = await CapacitorUpdater.current();
    return current;
  } catch (error) {
    console.error("[Updater] Failed to get current bundle:", error);
    return null;
  }
}

/**
 * List all downloaded bundles
 */
export async function listBundles() {
  if (!isCapacitor) return [];

  try {
    const result = await CapacitorUpdater.list();
    return result.bundles;
  } catch (error) {
    console.error("[Updater] Failed to list bundles:", error);
    return [];
  }
}

/**
 * Reset to the original built-in bundle
 */
export async function resetToBuiltin(): Promise<void> {
  if (!isCapacitor) return;

  try {
    await CapacitorUpdater.reset();
    console.log("[Updater] Reset to builtin bundle");
  } catch (error) {
    console.error("[Updater] Failed to reset:", error);
    throw error;
  }
}

/**
 * Delete a specific bundle by ID
 */
export async function deleteBundle(bundleId: string): Promise<void> {
  if (!isCapacitor) return;

  try {
    await CapacitorUpdater.delete({ id: bundleId });
    console.log(`[Updater] Deleted bundle: ${bundleId}`);
  } catch (error) {
    console.error("[Updater] Failed to delete bundle:", error);
    throw error;
  }
}

/**
 * Compare semantic versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split(/[.-]/).map(p => parseInt(p, 10) || 0);
  const partsB = b.split(/[.-]/).map(p => parseInt(p, 10) || 0);

  const maxLen = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

/**
 * Check Convex for available updates.
 * Uses the Convex URL from environment to query the latest active update.
 */
export async function checkForUpdates(): Promise<CheckUpdateResult> {
  const result: CheckUpdateResult = {
    hasUpdate: false,
    currentVersion: null,
    latestVersion: null,
    updateInfo: null,
  };

  if (!isCapacitor) {
    console.log("[Updater] Not running in Capacitor");
    return result;
  }

  try {
    // Get current version from the bundle
    const current = await getCurrentBundle();
    result.currentVersion = current?.bundle?.version || null;
    console.log("[Updater] Current version:", result.currentVersion || "builtin");

    // Get the Convex URL from environment
    const convexUrl = import.meta.env.VITE_CONVEX_URL;
    if (!convexUrl) {
      console.error("[Updater] VITE_CONVEX_URL not set");
      return result;
    }

    // Query Convex for the latest update
    // Convex HTTP API format: POST to /api/query with function path and args
    const response = await fetch(`${convexUrl}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "lifeos/ota:getLatestUpdate",
        args: {},
      }),
    });

    if (!response.ok) {
      console.error("[Updater] Failed to check for updates:", response.statusText);
      return result;
    }

    const data = await response.json();
    const latestUpdate = data.value;

    if (!latestUpdate) {
      console.log("[Updater] No active update available");
      return result;
    }

    result.latestVersion = latestUpdate.version;
    result.updateInfo = {
      version: latestUpdate.version,
      bundleUrl: latestUpdate.bundleUrl,
      releaseNotes: latestUpdate.releaseNotes,
      fileSize: latestUpdate.fileSize,
      createdAt: latestUpdate.createdAt,
    };

    // Check if update is newer than current
    if (!result.currentVersion) {
      // No OTA applied yet, any version is an update
      result.hasUpdate = true;
    } else {
      result.hasUpdate = compareVersions(latestUpdate.version, result.currentVersion) > 0;
    }

    console.log(`[Updater] Latest version: ${result.latestVersion}, hasUpdate: ${result.hasUpdate}`);
    return result;
  } catch (error) {
    console.error("[Updater] Error checking for updates:", error);
    return result;
  }
}

/**
 * Check for updates and apply if available.
 * Returns true if an update was applied (app will reload).
 */
export async function checkAndApplyUpdate(): Promise<boolean> {
  const { hasUpdate, updateInfo } = await checkForUpdates();

  if (!hasUpdate || !updateInfo) {
    return false;
  }

  console.log(`[Updater] Applying update v${updateInfo.version}...`);
  await downloadAndApplyUpdate(updateInfo.bundleUrl, updateInfo.version);
  return true;
}
