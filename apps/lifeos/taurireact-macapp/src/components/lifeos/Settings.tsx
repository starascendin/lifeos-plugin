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
import { Check, Eye, EyeOff, ExternalLink, Key, Loader2, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

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

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="font-bold text-3xl">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and application preferences.
        </p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your profile information from Clerk (read-only)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
