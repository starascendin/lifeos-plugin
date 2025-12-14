import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { ChevronLeft, CheckCircle2, XCircle, Loader2, Key } from "lucide-react";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { useChatNexusSettings } from "../../lib/hooks/useChatNexusSettings";
import { MODELS_BY_PROVIDER, PROVIDER_NAMES } from "../../lib/constants/models";

interface ModelSettingsViewProps {
  onClose: () => void;
}

type ApiKeyStatus = "idle" | "testing" | "success" | "error";

interface ApiKeyTestResult {
  status: ApiKeyStatus;
  message?: string;
  model?: string;
}

export function ModelSettingsView({ onClose }: ModelSettingsViewProps) {
  const { getToken } = useAuth();
  const { toggleModel, enableAllModels, disableAllModels, isModelEnabled, enabledModelIds } =
    useChatNexusSettings();

  const [apiKeyTest, setApiKeyTest] = useState<ApiKeyTestResult>({ status: "idle" });

  const enabledCount = enabledModelIds.length;
  const totalCount = Object.values(MODELS_BY_PROVIDER).flat().length;

  const testApiKey = async () => {
    setApiKeyTest({ status: "testing" });

    try {
      const token = await getToken({ template: "convex" });
      if (!token) {
        setApiKeyTest({ status: "error", message: "Not authenticated" });
        return;
      }

      const convexUrl = import.meta.env.VITE_CONVEX_URL;
      const siteUrl = convexUrl.replace(".cloud", ".site");

      const response = await fetch(`${siteUrl}/chatnexus/test-api-key`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        setApiKeyTest({
          status: "success",
          message: data.message,
          model: data.model,
        });
      } else {
        setApiKeyTest({
          status: "error",
          message: data.error || "API key validation failed",
        });
      }
    } catch (error) {
      setApiKeyTest({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to test API key",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-medium">Model Settings</h3>
      </div>

      {/* API Key Test Section */}
      <div className="p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium">Vercel AI Gateway</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={testApiKey}
            disabled={apiKeyTest.status === "testing"}
          >
            {apiKeyTest.status === "testing" ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Testing...
              </>
            ) : (
              "Test API Key"
            )}
          </Button>

          {apiKeyTest.status === "success" && (
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Valid</span>
            </div>
          )}

          {apiKeyTest.status === "error" && (
            <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <XCircle className="h-3.5 w-3.5" />
              <span className="truncate max-w-[120px]" title={apiKeyTest.message}>
                {apiKeyTest.message}
              </span>
            </div>
          )}
        </div>

        {apiKeyTest.status === "success" && apiKeyTest.model && (
          <div className="mt-1.5 text-xs text-muted-foreground">
            Tested with: {apiKeyTest.model}
          </div>
        )}
      </div>

      {/* Bulk actions */}
      <div className="p-2 flex items-center justify-between border-b border-border">
        <span className="text-xs text-muted-foreground">
          {enabledCount} of {totalCount} enabled
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">All</span>
          <Switch
            checked={enabledCount === totalCount}
            onCheckedChange={(checked) => {
              if (checked) {
                enableAllModels();
              } else {
                disableAllModels();
              }
            }}
          />
        </div>
      </div>

      {/* Model list by provider */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(MODELS_BY_PROVIDER).map(([provider, models]) => (
          <div key={provider} className="border-b border-border last:border-b-0">
            <div className="px-3 py-2 bg-muted/50">
              <h4 className="text-xs font-medium text-muted-foreground">
                {PROVIDER_NAMES[provider] || provider}
              </h4>
            </div>
            <div className="divide-y divide-border">
              {models.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-muted/30"
                >
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-2">
                    <span className="text-sm truncate">{model.name}</span>
                    {model.description && (
                      <span className="text-xs text-muted-foreground truncate">
                        {model.description}
                      </span>
                    )}
                  </div>
                  <Switch
                    checked={isModelEnabled(model.id)}
                    onCheckedChange={() => toggleModel(model.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
