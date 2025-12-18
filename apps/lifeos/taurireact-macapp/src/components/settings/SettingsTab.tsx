import { useTheme } from "../../lib/contexts/ThemeContext";

const convexUrl = import.meta.env.VITE_CONVEX_URL || "";
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";

function getEnvironment(): "development" | "staging" | "production" {
  // Detect based on Clerk publishable key prefix
  if (clerkKey.startsWith("pk_test_")) {
    // Check Convex URL for staging vs dev
    if (convexUrl.includes("staging")) {
      return "staging";
    }
    return "development";
  }
  if (clerkKey.startsWith("pk_live_")) {
    return "production";
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
          <span className="text-sm text-[var(--text-secondary)]">Environment:</span>
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

        {/* App Info */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">
            App Info
          </h2>

          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-secondary)] mb-1">
              Mode
            </div>
            <div className="text-sm text-[var(--text-primary)] font-mono">
              {import.meta.env.MODE}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
