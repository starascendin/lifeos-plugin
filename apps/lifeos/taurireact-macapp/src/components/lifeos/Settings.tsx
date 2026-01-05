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
import { useUser } from "@clerk/clerk-react";
import { api } from "@holaai/convex";
import { useAction, useQuery } from "convex/react";
import { Check, CheckCircle, Eye, EyeOff, ExternalLink, Key, Loader2, Mic, Monitor, Moon, Settings2, Sun, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useConfig } from "@/lib/config";

export function LifeOSSettings() {
  return (
    <AppShell>
      <SettingsContent />
    </AppShell>
  );
}

function SettingsContent() {
  const { user } = useUser();
  const { theme, setTheme } = useTheme();
  const currentUser = useQuery(api.common.users.currentUser);
  const [connectionStatus, setConnectionStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  const testConnection = useAction(api.common.dev.testConvexConnection);

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
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="font-bold text-3xl">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and application preferences.
        </p>
      </div>

      {/* Profile Settings - Clerk User */}
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

      {/* Convex User Record */}
      <Card>
        <CardHeader>
          <CardTitle>Convex User Record</CardTitle>
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

      {/* Environment Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Environment Configuration
          </CardTitle>
          <CardDescription>
            Runtime configuration loaded from environment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnvironmentConfigSection />
        </CardContent>
      </Card>

      {/* Convex Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Backend Configuration</CardTitle>
          <CardDescription>
            Convex backend connection settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Convex URL</Label>
            <code className="block rounded bg-muted px-3 py-2 text-sm">
              {import.meta.env.VITE_CONVEX_URL || "Not configured"}
            </code>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Package:</span>
            <Badge variant="secondary">@holaai/convex (workspace)</Badge>
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

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About LifeOS</CardTitle>
          <CardDescription>Application information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            <span className="font-medium">Version:</span> 0.1.0
          </p>
          <p className="text-sm">
            <span className="font-medium">Platform:</span> Tauri Desktop App
          </p>
          <p className="text-sm text-muted-foreground">
            LifeOS is a personal productivity and life management application.
          </p>
        </CardContent>
      </Card>
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

function EnvironmentConfigSection() {
  const { config, isLoading, error } = useConfig();

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

  return (
    <div className="space-y-4">
      {/* Runtime Badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Runtime:</span>
        <Badge variant={config?.runtime === "tauri" ? "default" : "secondary"}>
          {config?.runtime === "tauri" ? "Desktop (Tauri)" : "Web"}
        </Badge>
      </div>

      {/* LiveKit Voice Agent */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">LiveKit Voice Agent</span>
          </div>
          <div className="flex items-center gap-1">
            {config?.livekit.is_configured ? (
              <>
                <CheckCircle className="h-3 w-3 text-green-600" />
                <span className="text-xs text-green-600">Configured</span>
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 text-amber-600" />
                <span className="text-xs text-amber-600">Not Configured</span>
              </>
            )}
          </div>
        </div>

        <div className="space-y-2 text-sm rounded-lg border bg-muted/30 p-3">
          <EnvVarRow
            name="LIVEKIT_URL"
            value={config?.livekit.server_url}
            isSensitive={false}
          />
          <EnvVarRow
            name="LIVEKIT_API_KEY"
            value={config?.livekit.is_configured ? "••••••••" : undefined}
            isSensitive={true}
            isSet={config?.livekit.is_configured}
          />
          <EnvVarRow
            name="LIVEKIT_API_SECRET"
            value={config?.livekit.is_configured ? "••••••••" : undefined}
            isSensitive={true}
            isSet={config?.livekit.is_configured}
          />
        </div>

        {!config?.livekit.is_configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-3 text-sm text-amber-800 dark:text-amber-200">
            <p>
              To enable voice agent, set these environment variables in your
              Convex dashboard.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function EnvVarRow({
  name,
  value,
  isSensitive,
  isSet,
}: {
  name: string;
  value?: string;
  isSensitive: boolean;
  isSet?: boolean;
}) {
  const hasValue = isSensitive ? isSet : !!value;

  return (
    <div className="flex justify-between items-center gap-4">
      <code className="text-xs font-mono text-muted-foreground">{name}</code>
      {hasValue ? (
        <code className="text-xs font-mono truncate max-w-[200px]">
          {isSensitive ? "••••••••" : value}
        </code>
      ) : (
        <span className="text-xs text-muted-foreground italic">Not set</span>
      )}
    </div>
  );
}
