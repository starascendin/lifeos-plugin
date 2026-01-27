export {
  initUpdater,
  checkForUpdates,
  fetchLatestVersion,
  getCurrentVersion,
  getCurrentBundle,
  onUpdateStatus,
  isNative,
  setAutoUpdate,
  downloadAndApply,
  downloadForLater,
  applyPendingUpdate,
  getPendingUpdate,
  listBundles,
  deleteBundle,
  resetToBuiltin,
  resetToLastSuccessful,
} from './updater';

export type { UpdateInfo, CurrentBundleInfo, LatestVersionInfo } from './updater';

export {
  initAppState,
  onAppStateChange,
  isAppActive,
  isNativePlatform,
} from './app-state';
