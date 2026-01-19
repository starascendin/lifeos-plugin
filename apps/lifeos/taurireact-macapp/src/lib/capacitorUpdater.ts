/**
 * Capacitor OTA Updater
 *
 * For internal testing - provides manual OTA update capabilities.
 * Uses @capgo/capacitor-updater for self-hosted updates.
 */

import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { isCapacitor } from "./platform";

export interface UpdateInfo {
  version: string;
  url: string;
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
