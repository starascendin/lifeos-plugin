import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';

export interface UpdateInfo {
  hasUpdate: boolean;
  version?: string;
  downloading?: boolean;
  progress?: number;
}

type UpdateListener = (info: UpdateInfo) => void;

let listeners: UpdateListener[] = [];

export function onUpdateStatus(listener: UpdateListener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function notify(info: UpdateInfo) {
  listeners.forEach(l => l(info));
}

export async function initUpdater(): Promise<void> {
  // Only run on native platforms
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

  // Listen for update available
  CapacitorUpdater.addListener('updateAvailable', (info) => {
    console.log('[Updater] Update available:', info.bundle.version);
    notify({
      hasUpdate: true,
      version: info.bundle.version,
    });
  });

  // Listen for failed updates (will auto-rollback)
  CapacitorUpdater.addListener('updateFailed', (info) => {
    console.error('[Updater] Update failed:', info.bundle.version);
    notify({ hasUpdate: false });
  });

  console.log('[Updater] Initialized successfully');
}

// Manual update check (optional - autoUpdate handles this)
export async function checkForUpdate(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const latest = await CapacitorUpdater.getLatest();
    if (latest.url) {
      console.log('[Updater] Manual check found update');
      notify({ hasUpdate: true, version: latest.version });
    }
  } catch (e) {
    console.error('[Updater] Check failed:', e);
  }
}

// Get current bundle info
export async function getCurrentVersion(): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    return 'web';
  }

  try {
    const current = await CapacitorUpdater.current();
    return current.bundle.version || 'native';
  } catch {
    return 'native';
  }
}
