import { useEffect, useState, useCallback } from "react";
import { useTheme } from "../../lib/contexts/ThemeContext";
import { useApiKeys } from "../../lib/hooks/useApiKeys";
import { isCapacitor } from "../../lib/platform";
import {
  checkForUpdates,
  checkAndApplyUpdate,
  getCurrentBundle,
  listBundles,
  resetToBuiltin,
  onUpdateStatus,
  type CheckUpdateResult,
  type UpdateStatus,
} from "../../lib/capacitorUpdater";

const convexUrl = import.meta.env.VITE_CONVEX_URL || "";
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";

function getEnvironment(): "development" | "staging" | "production" {
  // Detect based on Clerk publishable key prefix and Convex URL
  if (clerkKey.startsWith("pk_live_")) {
    return "production";
  }
  if (clerkKey.startsWith("pk_test_")) {
    // Check Convex URL for staging (adorable-firefly-704) vs dev (keen-nightingale-310)
    if (convexUrl.includes("adorable-firefly")) {
      return "staging";
    }
    return "development";
  }
  return "development";
}

function getClerkDomain(): string {
  // Extract domain from Clerk key (base64 encoded after pk_test_ or pk_live_)
  try {
    const prefix = clerkKey.startsWith("pk_live_") ? "pk_live_" : "pk_test_";
    const encoded = clerkKey.replace(prefix, "").replace(/\$$/g, "");
    const decoded = atob(encoded);
    return decoded || "Unknown";
  } catch {
    return "Unknown";
  }
}

export function SettingsTab() {
  const environment = getEnvironment();
  const clerkDomain = getClerkDomain();
  const { theme, setTheme } = useTheme();

  const envColors: Record<string, string> = {
    development: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    staging: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    production: "bg-green-500/20 text-green-400 border-green-500/30",
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6">
        {/* Environment Badge */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-secondary)]">
            Environment:
          </span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium border ${envColors[environment]}`}
          >
            {environment.toUpperCase()}
          </span>
        </div>

        {/* Theme Selection */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">
            Appearance
          </h2>
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-secondary)] mb-2">
              Theme
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTheme("light")}
                className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  theme === "light"
                    ? "bg-[var(--app-accent)] text-white"
                    : "bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--app-border)]"
                }`}
              >
                Light
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  theme === "dark"
                    ? "bg-[var(--app-accent)] text-white"
                    : "bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--app-border)]"
                }`}
              >
                Dark
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  theme === "system"
                    ? "bg-[var(--app-accent)] text-white"
                    : "bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--app-border)]"
                }`}
              >
                System
              </button>
            </div>
          </div>
        </div>

        {/* Environment Variables */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">
            Configuration
          </h2>

          <div className="space-y-3">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <div className="text-xs text-[var(--text-secondary)] mb-1">
                Convex URL
              </div>
              <div className="text-sm text-[var(--text-primary)] font-mono break-all">
                {convexUrl || "Not set"}
              </div>
            </div>

            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <div className="text-xs text-[var(--text-secondary)] mb-1">
                Clerk Domain
              </div>
              <div className="text-sm text-[var(--text-primary)] font-mono break-all">
                {clerkDomain}
              </div>
            </div>

            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <div className="text-xs text-[var(--text-secondary)] mb-1">
                Clerk Key Type
              </div>
              <div className="text-sm text-[var(--text-primary)] font-mono">
                {clerkKey.startsWith("pk_live_")
                  ? "Production (pk_live_)"
                  : clerkKey.startsWith("pk_test_")
                    ? "Test (pk_test_)"
                    : "Unknown"}
              </div>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <ApiKeysSection />

        {/* OTA Updates - always show for internal testing */}
        <OTAUpdateSection />

        {/* App Info */}
        <AppInfoSection />
      </div>
    </div>
  );
}

function ApiKeysSection() {
  const {
    groqApiKey,
    hasGroqApiKey,
    isLoading,
    isSaving,
    error,
    saveGroqApiKey,
    deleteGroqApiKey,
  } = useApiKeys();

  const [inputValue, setInputValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (groqApiKey) {
      setInputValue(groqApiKey);
    }
  }, [groqApiKey]);

  const handleSave = async () => {
    if (!inputValue.trim()) return;
    const success = await saveGroqApiKey(inputValue.trim());
    if (success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const handleDelete = async () => {
    const success = await deleteGroqApiKey();
    if (success) {
      setInputValue("");
    }
  };

  const openFullDiskAccessSettings = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_full_disk_access_settings");
    } catch (e) {
      console.error("Failed to open settings:", e);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">
          API Keys
        </h2>
        <div className="bg-[var(--bg-secondary)] rounded-lg p-3 text-sm text-[var(--text-secondary)]">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-[var(--text-primary)]">
        API Keys
      </h2>

      {/* Groq API Key */}
      <div className="bg-[var(--bg-secondary)] rounded-lg p-3 space-y-3">
        <div>
          <div className="text-xs text-[var(--text-secondary)] mb-1">
            Groq API Key
          </div>
          <div className="text-xs text-[var(--text-secondary)] mb-2">
            Required for voice memo transcription.{" "}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--app-accent)] hover:underline"
            >
              Get your key →
            </a>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? "text" : "password"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="gsk_..."
              className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--app-border)] focus:outline-none focus:ring-1 focus:ring-[var(--app-accent)] pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving || !inputValue.trim()}
            className="px-3 py-2 text-sm font-medium rounded-md bg-[var(--app-accent)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "..." : saveSuccess ? "✓" : "Save"}
          </button>
          {hasGroqApiKey && (
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="px-3 py-2 text-sm font-medium rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>

        {hasGroqApiKey && (
          <div className="text-xs text-green-400 flex items-center gap-1">
            ✓ API key configured
          </div>
        )}

        {error && <div className="text-xs text-red-400">{error}</div>}
      </div>

      {/* Full Disk Access */}
      <div className="bg-[var(--bg-secondary)] rounded-lg p-3 space-y-2">
        <div className="text-xs text-[var(--text-secondary)]">
          <strong>Note:</strong> Full Disk Access may be required for the app to
          save settings.
        </div>
        <button
          onClick={openFullDiskAccessSettings}
          className="px-3 py-2 text-xs font-medium rounded-md bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--app-border)] hover:bg-[var(--app-border)] flex items-center gap-2"
        >
          ↗ Open Full Disk Access Settings
        </button>
      </div>
    </div>
  );
}

function AppInfoSection() {
  const [bundleVersion, setBundleVersion] = useState<string | null>(null);

  useEffect(() => {
    if (isCapacitor) {
      getCurrentBundle().then((bundle) => {
        setBundleVersion(bundle?.bundle?.version || null);
      });
    }
  }, []);

  const buildTime = new Date(__BUILD_TIMESTAMP__).toLocaleString();

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-[var(--text-primary)]">
        App Info
      </h2>

      <div className="space-y-3">
        <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
          <div className="text-xs text-[var(--text-secondary)] mb-1">
            App Version
          </div>
          <div className="text-sm text-[var(--text-primary)] font-mono">
            {__APP_VERSION__}
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
          <div className="text-xs text-[var(--text-secondary)] mb-1">
            Build Time
          </div>
          <div className="text-sm text-[var(--text-primary)] font-mono">
            {buildTime}
          </div>
        </div>

        {isCapacitor && (
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-secondary)] mb-1">
              OTA Bundle Version
            </div>
            <div className="text-sm text-[var(--text-primary)] font-mono">
              {bundleVersion || "builtin (no OTA applied)"}
            </div>
            {bundleVersion && bundleVersion !== __APP_VERSION__ && (
              <div className="text-xs text-yellow-400 mt-1">
                OTA version differs from app version
              </div>
            )}
          </div>
        )}

        <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
          <div className="text-xs text-[var(--text-secondary)] mb-1">
            Mode
          </div>
          <div className="text-sm text-[var(--text-primary)] font-mono">
            {import.meta.env.MODE}
          </div>
        </div>

        {isCapacitor && (
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-secondary)] mb-1">
              Platform
            </div>
            <div className="text-sm text-[var(--text-primary)] font-mono">
              Capacitor (iOS/Android)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OTAUpdateSection() {
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentBundle, setCurrentBundle] = useState<any>(null);
  const [bundles, setBundles] = useState<any[]>([]);
  const [checkResult, setCheckResult] = useState<CheckUpdateResult | null>(
    null,
  );
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    hasUpdate: false,
  });
  const [error, setError] = useState<string | null>(null);

  const loadBundleInfo = useCallback(async () => {
    const current = await getCurrentBundle();
    const allBundles = await listBundles();
    setCurrentBundle(current);
    setBundles(allBundles);
  }, []);

  useEffect(() => {
    loadBundleInfo();

    // Subscribe to update status from the auto-updater
    const unsubscribe = onUpdateStatus((status) => {
      setUpdateStatus(status);
      if (status.error) {
        setError(status.error);
      }
    });

    return () => unsubscribe();
  }, [loadBundleInfo]);

  const handleCheckForUpdates = async () => {
    setIsChecking(true);
    setError(null);
    try {
      const result = await checkForUpdates();
      setCheckResult(result);
      if (!result.hasUpdate) {
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to check for updates");
    } finally {
      setIsChecking(false);
    }
  };

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    setError(null);
    try {
      await checkAndApplyUpdate();
      // App will reload if update is applied
    } catch (err: any) {
      setError(err.message || "Failed to apply update");
      setIsUpdating(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    try {
      await resetToBuiltin();
      // App will reload
    } catch (err: any) {
      setError(err.message || "Failed to reset");
    }
  };

  const currentVersion = currentBundle?.bundle?.version || "builtin";
  const isDownloading = updateStatus.downloading || isUpdating;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-[var(--text-primary)]">
        OTA Updates
      </h2>

      {/* Current Bundle Info */}
      <div className="bg-[var(--bg-secondary)] rounded-lg p-3 space-y-2">
        <div className="text-xs text-[var(--text-secondary)]">
          Current Bundle
        </div>
        <div className="text-sm text-[var(--text-primary)] font-mono">
          v{currentVersion}
        </div>
        {bundles.length > 0 && (
          <div className="text-xs text-[var(--text-secondary)]">
            Downloaded bundles: {bundles.length}
          </div>
        )}
      </div>

      {/* Update Status */}
      {isDownloading && (
        <div className="bg-blue-500/10 rounded-lg p-3 space-y-2">
          <div className="text-xs text-blue-400 font-medium">
            Downloading update
            {updateStatus.version ? ` v${updateStatus.version}` : ""}...
          </div>
          {updateStatus.progress !== undefined && (
            <div className="w-full bg-[var(--bg-primary)] rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${updateStatus.progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Check Result */}
      {checkResult && !isDownloading && (
        <div
          className={`rounded-lg p-3 ${checkResult.hasUpdate ? "bg-green-500/10" : "bg-[var(--bg-secondary)]"}`}
        >
          {checkResult.hasUpdate && checkResult.updateInfo ? (
            <div className="space-y-2">
              <div className="text-xs text-green-400 font-medium">
                Update available: v{checkResult.updateInfo.version}
              </div>
              {checkResult.updateInfo.releaseNotes && (
                <div className="text-xs text-[var(--text-secondary)]">
                  {checkResult.updateInfo.releaseNotes}
                </div>
              )}
              {checkResult.updateInfo.fileSize && (
                <div className="text-xs text-[var(--text-secondary)]">
                  Size:{" "}
                  {(checkResult.updateInfo.fileSize / 1024 / 1024).toFixed(2)}{" "}
                  MB
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-[var(--text-secondary)]">
              You're on the latest version.
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {checkResult?.hasUpdate && !isDownloading ? (
          <button
            onClick={handleApplyUpdate}
            disabled={isUpdating}
            className="flex-1 px-3 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? "Applying..." : "Update Now"}
          </button>
        ) : (
          <button
            onClick={handleCheckForUpdates}
            disabled={isChecking || isDownloading}
            className="flex-1 px-3 py-2 text-sm font-medium rounded-md bg-[var(--app-accent)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChecking ? "Checking..." : "Check for Updates"}
          </button>
        )}
        <button
          onClick={handleReset}
          disabled={isDownloading}
          className="px-3 py-2 text-sm font-medium rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      {/* Error */}
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  );
}
