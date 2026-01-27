import { CapacitorUpdater } from '@capgo/capacitor-updater';
import type { BundleInfo } from '@capgo/capacitor-updater';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

// R2 manifest URL for update checks
const UPDATE_MANIFEST_URL = 'https://pub-bf60ae0f93494d11877f2c59d3db71bd.r2.dev/latest.json';

export interface UpdateInfo {
  hasUpdate: boolean;
  version?: string;
  downloading?: boolean;
  progress?: number;
  error?: string;
}

export interface CurrentBundleInfo {
  id: string;
  version: string;
  status: string;
  nativeVersion: string;
}

export interface LatestVersionInfo {
  version: string;
  url: string;
}

type UpdateListener = (info: UpdateInfo) => void;

let listeners: UpdateListener[] = [];
let autoUpdateEnabled = true;

export function onUpdateStatus(listener: UpdateListener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function notify(info: UpdateInfo) {
  listeners.forEach(l => l(info));
}

export const isNative = Capacitor.isNativePlatform();

/**
 * Compare version strings (e.g., "1.0.0" vs "1.0.1")
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(n => parseInt(n, 10) || 0);
  const partsB = b.split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

/**
 * Fetch the latest version info from R2 manifest
 * Uses native HTTP to bypass CORS restrictions
 */
export async function fetchLatestVersion(): Promise<LatestVersionInfo | null> {
  try {
    const url = UPDATE_MANIFEST_URL + '?t=' + Date.now();
    console.log('[Updater] Fetching:', url);

    if (Capacitor.isNativePlatform()) {
      // Use native HTTP to bypass CORS
      const response = await CapacitorHttp.get({
        url,
        headers: { 'Accept': 'application/json' },
      });
      console.log('[Updater] Response status:', response.status);
      if (response.status !== 200) {
        console.error('[Updater] Failed to fetch manifest:', response.status);
        return null;
      }
      const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      console.log('[Updater] Manifest data:', data);
      return data;
    } else {
      // Fallback to fetch for web
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      console.log('[Updater] Response status:', response.status);
      if (!response.ok) {
        console.error('[Updater] Failed to fetch manifest:', response.status);
        return null;
      }
      const data = await response.json();
      console.log('[Updater] Manifest data:', data);
      return data;
    }
  } catch (e) {
    console.error('[Updater] Error fetching manifest:', e);
    return null;
  }
}

/**
 * Check for updates and optionally auto-apply
 */
export async function checkForUpdates(autoApply = false): Promise<UpdateInfo> {
  if (!Capacitor.isNativePlatform()) {
    return { hasUpdate: false };
  }

  try {
    const [current, latest] = await Promise.all([
      CapacitorUpdater.current(),
      fetchLatestVersion(),
    ]);

    if (!latest) {
      return { hasUpdate: false, error: 'Could not fetch update info' };
    }

    const currentVersion = current.bundle.version || '0.0.0';
    const hasUpdate = compareVersions(currentVersion, latest.version) < 0;

    console.log(`[Updater] Current: ${currentVersion}, Latest: ${latest.version}, HasUpdate: ${hasUpdate}`);

    if (hasUpdate && autoApply) {
      notify({ hasUpdate: true, version: latest.version, downloading: true, progress: 0 });

      // Download and apply
      const result = await downloadAndApply(latest.url, latest.version, (percent) => {
        notify({ hasUpdate: true, version: latest.version, downloading: true, progress: percent });
      });

      if (!result.success) {
        notify({ hasUpdate: true, version: latest.version, downloading: false, error: result.error });
        return { hasUpdate: true, version: latest.version, error: result.error };
      }
    }

    return { hasUpdate, version: latest.version };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Check failed';
    console.error('[Updater] Check failed:', e);
    return { hasUpdate: false, error };
  }
}

/**
 * Initialize updater and optionally check for updates
 */
export async function initUpdater(autoCheck = true): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[Updater] Skipping - not a native platform');
    return;
  }

  console.log('[Updater] Initializing...');

  // Notify that the app is ready - required for updates to apply
  await CapacitorUpdater.notifyAppReady();

  // Listen for download progress
  CapacitorUpdater.addListener('download', (info) => {
    console.log('[Updater] Download progress:', info.percent);
    notify({
      hasUpdate: true,
      downloading: true,
      progress: info.percent,
    });
  });

  // Listen for download completion
  CapacitorUpdater.addListener('downloadComplete', (info) => {
    console.log('[Updater] Download complete:', info.bundle.version);
    notify({
      hasUpdate: true,
      version: info.bundle.version,
      downloading: false,
    });
  });

  // Listen for failed updates (will auto-rollback)
  CapacitorUpdater.addListener('updateFailed', (info) => {
    console.error('[Updater] Update failed:', info.bundle.version);
    notify({ hasUpdate: false, error: 'Update failed, rolled back' });
  });

  console.log('[Updater] Initialized successfully');

  // Check for updates on launch if enabled
  if (autoCheck && autoUpdateEnabled) {
    console.log('[Updater] Checking for updates...');
    // Delay slightly to not block app startup
    setTimeout(async () => {
      const result = await checkForUpdates(true); // Auto-apply if update found
      if (result.hasUpdate && !result.error) {
        console.log('[Updater] Update available:', result.version);
      }
    }, 2000);
  }
}

/**
 * Enable or disable auto-updates
 */
export function setAutoUpdate(enabled: boolean): void {
  autoUpdateEnabled = enabled;
  console.log('[Updater] Auto-update:', enabled ? 'enabled' : 'disabled');
}

/**
 * Get current bundle info
 */
export async function getCurrentVersion(): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    return 'web';
  }

  try {
    const current = await CapacitorUpdater.current();
    return current.bundle.version || 'builtin';
  } catch {
    return 'unknown';
  }
}

/**
 * Get detailed current bundle info
 */
export async function getCurrentBundle(): Promise<CurrentBundleInfo> {
  if (!Capacitor.isNativePlatform()) {
    return {
      id: 'web',
      version: 'web',
      status: 'web',
      nativeVersion: 'web',
    };
  }

  try {
    const current = await CapacitorUpdater.current();
    return {
      id: current.bundle.id,
      version: current.bundle.version || 'builtin',
      status: current.bundle.status,
      nativeVersion: current.native,
    };
  } catch {
    return {
      id: 'unknown',
      version: 'unknown',
      status: 'error',
      nativeVersion: 'unknown',
    };
  }
}

/**
 * Download and immediately apply update
 */
export async function downloadAndApply(
  url: string,
  version: string,
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, error: 'Not a native platform' };
  }

  try {
    // Set up progress listener
    const listener = await CapacitorUpdater.addListener('download', (event) => {
      onProgress?.(event.percent);
    });

    // Download the bundle
    const bundle = await CapacitorUpdater.download({ url, version });

    // Remove listener
    await listener.remove();

    // Apply immediately (this reloads the app)
    await CapacitorUpdater.set({ id: bundle.id });

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Download failed',
    };
  }
}

/**
 * Download for later (applies on next background/restart)
 */
export async function downloadForLater(
  url: string,
  version: string,
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; bundle?: BundleInfo; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, error: 'Not a native platform' };
  }

  try {
    const listener = await CapacitorUpdater.addListener('download', (event) => {
      onProgress?.(event.percent);
    });

    const bundle = await CapacitorUpdater.download({ url, version });
    await listener.remove();

    // Queue for next restart
    await CapacitorUpdater.next({ id: bundle.id });

    return { success: true, bundle };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Download failed',
    };
  }
}

/**
 * Apply pending update now
 */
export async function applyPendingUpdate(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await CapacitorUpdater.reload();
}

/**
 * Get pending update info
 */
export async function getPendingUpdate(): Promise<BundleInfo | null> {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    return await CapacitorUpdater.getNextBundle();
  } catch {
    return null;
  }
}

/**
 * List all downloaded bundles
 */
export async function listBundles(): Promise<BundleInfo[]> {
  if (!Capacitor.isNativePlatform()) return [];

  try {
    const result = await CapacitorUpdater.list();
    return result.bundles;
  } catch {
    return [];
  }
}

/**
 * Delete a bundle
 */
export async function deleteBundle(id: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    await CapacitorUpdater.delete({ id });
    return true;
  } catch (e) {
    console.error('[Updater] Delete failed:', e);
    return false;
  }
}

/**
 * Reset to builtin version
 */
export async function resetToBuiltin(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await CapacitorUpdater.reset({ toLastSuccessful: false });
}

/**
 * Reset to last successful version
 */
export async function resetToLastSuccessful(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await CapacitorUpdater.reset({ toLastSuccessful: true });
}
