import { AppShell } from "./AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/lib/contexts/ThemeContext";
import { useApiKeys } from "@/lib/hooks/useApiKeys";
import { useUser } from "@/lib/auth/platformClerk";
import { api } from "@holaai/convex";
import { useAction, useMutation, useQuery } from "convex/react";
import { Bot, Check, CheckCircle, Clock, Coins, Database, Eye, EyeOff, ExternalLink, History, Infinity, Key, Loader2, Mic, Monitor, Moon, Send, Shield, Sparkles, Sun, Trash2, XCircle } from "lucide-react";
import { CoderIntegrationSettings } from "@/components/pm/settings/CoderIntegrationSettings";
import { useEffect, useState } from "react";
import { useConfig } from "@/lib/config";
import {
  downloadAndApplyUpdate,
  getCurrentBundle,
  listBundles,
  resetToBuiltin,
} from "@/lib/capacitorUpdater";

export function LifeOSSettings() {
  return (
    <AppShell>
      <SettingsContent />
    </AppShell>
  );
}

// Helper to detect environment from Convex URL
function getEnvironmentInfo(convexUrl: string | undefined): {
  name: string;
  badge: "default" | "secondary" | "destructive" | "outline";
  description: string;
} {
  if (!convexUrl) {
    return { name: "Unknown", badge: "destructive", description: "Not configured" };
  }

  // Extract deployment name from URL
  // Format: https://<deployment-name>.convex.cloud
  const match = convexUrl.match(/https:\/\/([^.]+)\.convex\.(cloud|site)/);
  const deploymentName = match?.[1] || "";

  // Known environments
  if (deploymentName === "keen-nightingale-310") {
    return { name: "Development", badge: "secondary", description: "Dev environment" };
  }
  if (deploymentName === "agreeable-ibex-949") {
    return { name: "Production", badge: "default", description: "Production environment" };
  }

  // Preview deployment (random name)
  return { name: "Preview", badge: "outline", description: `Preview: ${deploymentName}` };
}

function SettingsContent() {
  const { user } = useUser();
  const { theme, setTheme } = useTheme();
  const { config } = useConfig();
  const currentUser = useQuery(api.common.users.currentUser);
  const [connectionStatus, setConnectionStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  const testConnection = useAction(api.common.dev.testConvexConnection);

  const convexUrl = import.meta.env.VITE_CONVEX_URL;
  const envInfo = getEnvironmentInfo(convexUrl);

  const handleTestConnection = async () => {
    setConnectionStatus({ loading: true });
    try {
      const result = await testConnection();
      setConnectionStatus({
        loading: false,
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      setConnectionStatus({
        loading: false,
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      });
    }
  };

  return (
    <div className="space-y-8 p-6">
      {/* Page Header */}
      <div>
        <h1 className="font-bold text-3xl">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and application preferences.
        </p>
      </div>

      {/* Environment Banner */}
      <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
        <Badge variant={envInfo.badge} className="text-sm px-3 py-1">
          {envInfo.name}
        </Badge>
        <span className="text-sm text-muted-foreground">{envInfo.description}</span>
      </div>

      {/* ==================== CLERK SECTION ==================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-xl">Authentication (Clerk)</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Your authentication profile from Clerk
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user && (
              <div className="flex items-center gap-4 mb-4">
                {user.imageUrl && (
                  <img
                    src={user.imageUrl}
                    alt="Profile"
                    className="h-16 w-16 rounded-full"
                  />
                )}
                <div className="space-y-1">
                  <p className="font-medium text-lg">{user.fullName || "Not set"}</p>
                  <p className="text-muted-foreground text-sm">
                    {user.primaryEmailAddress?.emailAddress || "No email"}
                  </p>
                </div>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={user?.fullName || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user?.primaryEmailAddress?.emailAddress || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
            {user && (
              <div className="pt-2">
                <Badge variant="secondary">Clerk ID: {user.id}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ==================== CONVEX SECTION ==================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-xl">Backend (Convex)</h2>
        </div>

        {/* Convex Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Connection</CardTitle>
            <CardDescription>
              Convex backend connection settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Convex URL</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 block rounded bg-muted px-3 py-2 text-sm font-mono">
                  {convexUrl || "Not configured"}
                </code>
                <Badge variant={envInfo.badge}>{envInfo.name}</Badge>
              </div>
            </div>

            {/* Connection Test */}
            <div className="pt-4 border-t">
              <Label className="mb-2 block">Connection Test</Label>
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleTestConnection}
                  disabled={connectionStatus.loading}
                  variant="outline"
                  size="sm"
                >
                  {connectionStatus.loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </Button>

                {connectionStatus.success !== undefined && (
                  <div
                    className={`flex items-center gap-2 text-sm ${
                      connectionStatus.success ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {connectionStatus.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <span>{connectionStatus.message}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Convex User Record */}
        <Card>
          <CardHeader>
            <CardTitle>User Record</CardTitle>
            <CardDescription>
              Your synced user data in Convex backend
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentUser === undefined ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading Convex user...
              </div>
            ) : currentUser === null ? (
              <p className="text-muted-foreground">
                No Convex user found (EnsureUser should create one)
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Convex ID:</span>{" "}
                  <code className="rounded bg-muted px-2 py-1">{currentUser._id}</code>
                </p>
                <p>
                  <span className="font-medium">Token Identifier:</span>{" "}
                  <code className="rounded bg-muted px-2 py-1 text-xs">{currentUser.tokenIdentifier}</code>
                </p>
                <p>
                  <span className="font-medium">Email:</span>{" "}
                  {currentUser.email || "Not set"}
                </p>
                <p>
                  <span className="font-medium">Name:</span>{" "}
                  {currentUser.name || "Not set"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ==================== LIVEKIT SECTION ==================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-xl">Voice Agent (LiveKit)</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>LiveKit Configuration</CardTitle>
            <CardDescription>
              Voice AI agent connection settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LiveKitConfigSection />
          </CardContent>
        </Card>
      </section>

      {/* ==================== INTEGRATIONS SECTION ==================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-xl">Integrations</h2>
        </div>

        {/* Coder Integration */}
        <Card>
          <CardHeader>
            <CardTitle>Coder Agent Delegation</CardTitle>
            <CardDescription>
              Connect your Coder account to delegate issues to AI coding agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CoderIntegrationSettings />
          </CardContent>
        </Card>
      </section>

      {/* ==================== OTHER SETTINGS ==================== */}
      <section className="space-y-4">
        <h2 className="font-semibold text-xl">Other Settings</h2>

        {/* AI Credits & Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Credits & Usage
            </CardTitle>
            <CardDescription>
              Monitor your AI credit balance and usage history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AICreditsSection />
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize how LifeOS looks on your device
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                onClick={() => setTheme("light")}
                className="flex items-center gap-2"
              >
                <Sun className="h-4 w-4" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                onClick={() => setTheme("dark")}
                className="flex items-center gap-2"
              >
                <Moon className="h-4 w-4" />
                Dark
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                onClick={() => setTheme("system")}
                className="flex items-center gap-2"
              >
                <Monitor className="h-4 w-4" />
                System
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* API Keys Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>
              Configure API keys for external services. Keys are stored securely
              in your local app data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApiKeysSection />
          </CardContent>
        </Card>

        {/* OTA Updates - for internal testing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              OTA Updates (Dev)
            </CardTitle>
            <CardDescription>
              Download and apply over-the-air updates for testing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OTAUpdateSection />
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>About LifeOS</CardTitle>
            <CardDescription>Application information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Version:</span> {__APP_VERSION__}
            </p>
            <p className="text-sm text-green-500 font-medium">
              OTA Update v1.0.2 - Test successful!
            </p>
            <p className="text-sm">
              <span className="font-medium">Runtime:</span>{" "}
              <Badge variant="secondary">
                {config?.runtime === "tauri" ? "Desktop (Tauri)" : "Web"}
              </Badge>
            </p>
            <p className="text-sm text-muted-foreground">
              LifeOS is a personal productivity and life management application.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function LiveKitConfigSection() {
  const { config, isLoading, error } = useConfig();
  const convexUrl = import.meta.env.VITE_CONVEX_URL;
  const envInfo = getEnvironmentInfo(convexUrl);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading configuration...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive">
        <XCircle className="h-4 w-4" />
        <span>{error}</span>
      </div>
    );
  }

  // Derive voice agent URL based on environment
  const getVoiceAgentUrl = () => {
    if (envInfo.name === "Development") {
      return "wss://livekit-dev.rocketjump.tech";
    }
    if (envInfo.name === "Production") {
      return "wss://livekit.rocketjump.tech";
    }
    // Preview - the voice agent URL is configured via Dokploy
    return config?.livekit.server_url || "Preview (via Dokploy)";
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Status</span>
        <div className="flex items-center gap-2">
          {config?.livekit.is_configured ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600">Configured</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-600">Not Configured</span>
            </>
          )}
        </div>
      </div>

      {/* Configuration Details */}
      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <div className="flex justify-between items-center gap-4">
          <span className="text-sm font-medium">LiveKit Server URL</span>
          <code className="text-xs font-mono bg-muted px-2 py-1 rounded truncate max-w-[250px]">
            {config?.livekit.server_url || "Not set"}
          </code>
        </div>

        <div className="flex justify-between items-center gap-4">
          <span className="text-sm font-medium">Voice Agent Backend</span>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono bg-muted px-2 py-1 rounded truncate max-w-[200px]">
              {convexUrl ? convexUrl.replace("https://", "").replace(".convex.cloud", "") : "Not set"}
            </code>
            <Badge variant={envInfo.badge} className="text-xs">
              {envInfo.name}
            </Badge>
          </div>
        </div>

        <div className="flex justify-between items-center gap-4">
          <span className="text-sm font-medium">API Key</span>
          <span className="text-xs text-muted-foreground">
            {config?.livekit.is_configured ? "••••••••" : "Not set"}
          </span>
        </div>

        <div className="flex justify-between items-center gap-4">
          <span className="text-sm font-medium">API Secret</span>
          <span className="text-xs text-muted-foreground">
            {config?.livekit.is_configured ? "••••••••" : "Not set"}
          </span>
        </div>
      </div>

      {/* Environment Info */}
      <div className="rounded-lg border p-3 bg-muted/20">
        <p className="text-sm text-muted-foreground">
          {envInfo.name === "Preview" ? (
            <>
              <strong>Preview Mode:</strong> The voice agent is using a preview Convex backend.
              This allows testing changes without affecting the production environment.
            </>
          ) : envInfo.name === "Development" ? (
            <>
              <strong>Development Mode:</strong> Connected to the dev Convex backend.
              The voice agent shares this connection.
            </>
          ) : (
            <>
              <strong>Production Mode:</strong> Connected to the production Convex backend.
            </>
          )}
        </p>
      </div>

      {!config?.livekit.is_configured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-3 text-sm text-amber-800 dark:text-amber-200">
          <p>
            To enable voice agent, set LiveKit environment variables in your
            Convex dashboard.
          </p>
        </div>
      )}
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

  // Initialize input with existing key
  useEffect(() => {
    if (groqApiKey) {
      setInputValue(groqApiKey);
    }
  }, [groqApiKey]);

  const openFullDiskAccessSettings = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_full_disk_access_settings");
    } catch (e) {
      console.error("Failed to open settings:", e);
    }
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading API keys...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Groq API Key */}
      <div className="space-y-2">
        <Label htmlFor="groq-api-key">Groq API Key</Label>
        <p className="text-sm text-muted-foreground">
          Required for voice memo transcription using Whisper. Get your key from{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            console.groq.com
          </a>
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="groq-api-key"
              type={showKey ? "text" : "password"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="gsk_..."
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          <Button onClick={handleSave} disabled={isSaving || !inputValue.trim()}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="h-4 w-4" />
            ) : (
              "Save"
            )}
          </Button>
          {hasGroqApiKey && (
            <Button variant="outline" onClick={handleDelete} disabled={isSaving}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        {hasGroqApiKey && (
          <p className="flex items-center gap-1 text-sm text-green-600">
            <Check className="h-3 w-3" />
            API key configured
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Full Disk Access */}
      <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
        <p className="text-sm text-muted-foreground">
          <strong>Note:</strong> Full Disk Access may be required for the app to
          save settings in production builds.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={openFullDiskAccessSettings}
          className="gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Open Full Disk Access Settings
        </Button>
      </div>
    </div>
  );
}

function AICreditsSection() {
  const credits = useQuery(api.common.credits.getMyCredits);
  const transactions = useQuery(api.common.credits.getMyTransactions, { limit: 20 });
  const pendingRequest = useQuery(api.common.credits.getMyPendingRequest);
  const requestCredits = useMutation(api.common.credits.requestCredits);

  const [requestMessage, setRequestMessage] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);

  const handleRequestCredits = async () => {
    if (!requestMessage.trim()) return;
    setIsRequesting(true);
    try {
      await requestCredits({ message: requestMessage.trim() });
      setRequestMessage("");
      setShowRequestForm(false);
    } catch (error) {
      console.error("Failed to request credits:", error);
    } finally {
      setIsRequesting(false);
    }
  };

  if (credits === undefined) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading credit info...</span>
      </div>
    );
  }

  // Format numbers for display
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toLocaleString();
  };

  // Format date for display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get feature display name
  const getFeatureDisplayName = (feature?: string) => {
    const featureNames: Record<string, string> = {
      agenda_daily_summary: "Daily Summary",
      agenda_weekly_summary: "Weekly Summary",
      pm_agent: "PM Agent",
      demo_agent: "Demo Agent",
      chatnexus: "Chat Nexus",
      llm_council: "LLM Council",
      holaai_lesson: "AI Lesson",
      holaai_conversation: "Conversation",
      holaai_suggestions: "Suggestions",
      holaai_voice: "Voice Agent",
    };
    return feature ? featureNames[feature] || feature : "Unknown";
  };

  return (
    <div className="space-y-6">
      {/* Credit Balance */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Coins className="h-4 w-4" />
            Current Balance
          </div>
          <div className="flex items-center gap-2">
            {credits?.hasUnlimitedAccess ? (
              <>
                <Infinity className="h-6 w-6 text-green-500" />
                <span className="text-2xl font-bold text-green-500">Unlimited</span>
              </>
            ) : (
              <span className={`text-2xl font-bold ${credits?.balance === 0 ? "text-red-500" : ""}`}>
                {formatNumber(credits?.balance || 0)}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <History className="h-4 w-4" />
            Total Used
          </div>
          <span className="text-2xl font-bold">
            {formatNumber(credits?.totalConsumed || 0)}
          </span>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Sparkles className="h-4 w-4" />
            Total Granted
          </div>
          <span className="text-2xl font-bold">
            {formatNumber(credits?.totalGranted || 0)}
          </span>
        </div>
      </div>

      {/* Pending Request Status */}
      {pendingRequest && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950 p-4">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
            <Clock className="h-4 w-4" />
            <span className="font-medium">Credit Request Pending</span>
          </div>
          <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
            Your request is being reviewed. Submitted on{" "}
            {new Date(pendingRequest.createdAt).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Request Credits Button (only show if not unlimited and no pending request) */}
      {!credits?.hasUnlimitedAccess && !pendingRequest && (
        <div className="space-y-3">
          {!showRequestForm ? (
            <Button
              variant="outline"
              onClick={() => setShowRequestForm(true)}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Request Credits
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border p-4">
              <Label htmlFor="request-message">Why do you need credits?</Label>
              <textarea
                id="request-message"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={3}
                placeholder="Tell us how you plan to use LifeOS AI features..."
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleRequestCredits}
                  disabled={isRequesting || !requestMessage.trim()}
                >
                  {isRequesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Request"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRequestForm(false);
                    setRequestMessage("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Usage History */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4" />
          Recent AI Usage
        </h4>

        {transactions === undefined ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading transactions...
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No AI usage recorded yet. Start using AI features to see your history here.
          </p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Time</th>
                    <th className="px-4 py-2 text-left font-medium">Feature</th>
                    <th className="px-4 py-2 text-left font-medium">Model</th>
                    <th className="px-4 py-2 text-right font-medium">Tokens</th>
                    <th className="px-4 py-2 text-right font-medium">Credits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatDate(tx.createdAt)}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="secondary" className="text-xs">
                          {getFeatureDisplayName(tx.feature)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground font-mono text-xs">
                        {tx.model || "-"}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {tx.tokenUsage?.totalTokens
                          ? formatNumber(tx.tokenUsage.totalTokens)
                          : "-"}
                      </td>
                      <td className={`px-4 py-2 text-right font-medium ${
                        tx.type === "deduction" ? "text-red-500" : "text-green-500"
                      }`}>
                        {tx.type === "deduction" ? "-" : "+"}
                        {formatNumber(Math.abs(tx.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
  const [status, setStatus] = useState<string | null>(null);
  const [currentBundle, setCurrentBundle] = useState<any>(null);
  const [bundles, setBundles] = useState<any[]>([]);
  const [availableUpdate, setAvailableUpdate] = useState<{
    version: string;
    bundleUrl: string;
    fileSize?: number;
  } | null>(null);

  useEffect(() => {
    loadBundleInfo();
  }, []);

  const loadBundleInfo = async () => {
    const current = await getCurrentBundle();
    const allBundles = await listBundles();
    setCurrentBundle(current);
    setBundles(allBundles);
  };

  const handleCheckForUpdates = async () => {
    setIsChecking(true);
    setStatus("Checking for updates...");
    try {
      const convexUrl = import.meta.env.VITE_CONVEX_URL;
      if (!convexUrl) {
        setStatus("Error: VITE_CONVEX_URL not configured");
        setIsChecking(false);
        return;
      }

      const response = await fetch(`${convexUrl}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "lifeos/ota:getLatestUpdate",
          args: {},
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to check: ${response.statusText}`);
      }

      const data = await response.json();
      const latestUpdate = data.value;

      if (!latestUpdate) {
        setStatus("No updates available");
        setAvailableUpdate(null);
      } else {
        setAvailableUpdate({
          version: latestUpdate.version,
          bundleUrl: latestUpdate.bundleUrl,
          fileSize: latestUpdate.fileSize,
        });
        const currentVersion = currentBundle?.bundle?.version || "builtin";
        if (latestUpdate.version === currentVersion) {
          setStatus(`Already on latest version (${latestUpdate.version})`);
        } else {
          setStatus(`Update available: v${latestUpdate.version}`);
        }
      }
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
      setAvailableUpdate(null);
    } finally {
      setIsChecking(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!availableUpdate) return;
    setIsUpdating(true);
    setStatus(`Downloading v${availableUpdate.version}...`);
    try {
      await downloadAndApplyUpdate(availableUpdate.bundleUrl, availableUpdate.version);
      setStatus("Update applied! App will reload.");
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
      setIsUpdating(false);
    }
  };

  const handleReset = async () => {
    try {
      setStatus("Resetting to builtin...");
      await resetToBuiltin();
      setStatus("Reset complete. App will reload.");
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
    }
  };

  const convexUrl = import.meta.env.VITE_CONVEX_URL;

  return (
    <div className="space-y-4">
      {/* Version Info */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">App Version</span>
          <Badge variant="outline">{__APP_VERSION__}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Build Time</span>
          <span className="text-xs text-muted-foreground font-mono">
            {new Date(__BUILD_TIMESTAMP__).toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Bundle Version</span>
          <Badge variant="secondary">
            {currentBundle?.bundle?.version || "builtin"}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Update Server</span>
          <code className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
            {convexUrl ? convexUrl.replace("https://", "").replace(".convex.cloud", "") : "Not set"}
          </code>
        </div>
        {bundles.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Downloaded bundles: {bundles.length}
          </p>
        )}
      </div>

      {/* Available Update Info */}
      {availableUpdate && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-4 space-y-2">
          <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">Update Available: v{availableUpdate.version}</span>
          </div>
          {availableUpdate.fileSize && (
            <p className="text-xs text-green-700 dark:text-green-300">
              Size: {(availableUpdate.fileSize / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={handleCheckForUpdates}
          disabled={isChecking || isUpdating}
          variant="outline"
          className="flex-1"
        >
          {isChecking ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            "Check for Updates"
          )}
        </Button>
        {availableUpdate && (
          <Button
            onClick={handleApplyUpdate}
            disabled={isUpdating}
            className="flex-1"
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              `Apply v${availableUpdate.version}`
            )}
          </Button>
        )}
        <Button variant="destructive" onClick={handleReset} disabled={isUpdating}>
          Reset
        </Button>
      </div>

      {status && (
        <p className={`text-sm ${status.startsWith("Error") ? "text-destructive" : "text-green-600"}`}>
          {status}
        </p>
      )}
    </div>
  );
}
