import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import { AppShell } from "./AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronUp,
  Settings,
  Eye,
  EyeOff,
  RotateCcw,
  Loader2,
  Save,
} from "lucide-react";

export function LifeOSProxyLLMCouncil() {
  return (
    <AppShell>
      <ProxyCouncilContent />
    </AppShell>
  );
}

function ProxyCouncilContent() {
  // Convex query and mutations
  const settings = useQuery(
    api.lifeos.proxy_council_settings.getProxyCouncilSettings
  );
  const updateSettings = useMutation(
    api.lifeos.proxy_council_settings.updateProxyCouncilSettings
  );
  const resetSettings = useMutation(
    api.lifeos.proxy_council_settings.resetProxyCouncilSettings
  );

  // Local form state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Sync form state with loaded settings
  // Using password field as token for backwards compatibility
  useEffect(() => {
    if (settings) {
      setUrl(settings.url);
      setToken(settings.password); // password field stores the token
    }
  }, [settings]);

  // Construct iframe URL with token query param
  const iframeUrl = useMemo(() => {
    if (!settings) return "";

    try {
      const urlObj = new URL(settings.url);
      if (settings.password) {
        urlObj.searchParams.set("token", settings.password);
      }
      return urlObj.toString();
    } catch {
      return settings.url;
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Store token in password field, username empty
      await updateSettings({ url, username: "", password: token });
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetSettings();
    } catch (error) {
      console.error("Failed to reset settings:", error);
    } finally {
      setIsResetting(false);
    }
  };

  // Check if form has unsaved changes
  const hasChanges =
    settings &&
    (url !== settings.url || token !== settings.password);

  if (settings === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Settings Panel */}
      <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <div className="border-b bg-muted/30">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between px-4 py-3 rounded-none"
            >
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="font-medium">Proxy Council Settings</span>
                {settings.isDefault && (
                  <span className="text-xs text-muted-foreground">
                    (using defaults)
                  </span>
                )}
              </div>
              {isSettingsOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="p-4 space-y-4 border-t">
              {/* URL */}
              <div className="space-y-2">
                <Label htmlFor="proxy-url">Server URL</Label>
                <Input
                  id="proxy-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://council-proxy.example.com/"
                />
              </div>

              {/* Token */}
              <div className="space-y-2">
                <Label htmlFor="proxy-token">Auth Token</Label>
                <div className="relative">
                  <Input
                    id="proxy-token"
                    type={showToken ? "text" : "password"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="secret123"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Token is passed as ?token=xxx in the URL
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Settings
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={isResetting || settings.isDefault}
                  className="gap-2"
                >
                  {isResetting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Reset to Defaults
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Iframe */}
      <div className="flex-1 min-h-0">
        {iframeUrl ? (
          <iframe
            src={iframeUrl}
            className="h-full w-full border-0"
            title="Proxy LLM Council"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Configure settings to load Proxy Council
          </div>
        )}
      </div>
    </div>
  );
}
