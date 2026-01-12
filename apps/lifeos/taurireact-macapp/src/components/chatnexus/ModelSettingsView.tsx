import { useState } from "react";
import { useAuth } from "@/lib/auth/platformClerk";
import { ChevronLeft, CheckCircle2, XCircle, Loader2, Key, Layers } from "lucide-react";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { useChatNexusSettings } from "../../lib/hooks/useChatNexusSettings";
import {
  MODELS_BY_PROVIDER,
  PROVIDER_NAMES,
  MODEL_TIERS,
  TIER_INFO,
  ALL_PROVIDERS,
  ModelTier,
  Provider,
} from "../../lib/constants/models";

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
  const {
    toggleModel,
    enableAllModels,
    disableAllModels,
    isModelEnabled,
    enabledModelIds,
    tierConfiguration,
    updateTierModel,
    panelProviders,
    setPanelProvider,
  } = useChatNexusSettings();

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

      {/* Settings Accordions */}
      <Accordion type="multiple" className="border-b border-border">
        {/* API Key Test Section */}
        <AccordionItem value="api-key" className="border-b-0">
          <AccordionTrigger className="px-3 py-2 hover:no-underline bg-muted/30">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">Vercel AI Gateway</span>
              {apiKeyTest.status === "success" && (
                <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
              )}
              {apiKeyTest.status === "error" && (
                <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3 pt-0">
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
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tier-config" className="border-b-0">
          <AccordionTrigger className="px-3 py-2 hover:no-underline bg-muted/30">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">Tier Configuration</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3 pt-0">
            <p className="text-xs text-muted-foreground mb-2">
              Assign models to tiers for quick switching.
            </p>
            <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
              {Object.entries(MODELS_BY_PROVIDER).map(([provider, models]) => {
                const enabledModels = models.filter((m) => isModelEnabled(m.id));
                const providerConfig = tierConfiguration[provider];

                return (
                  <div key={provider} className="space-y-1.5">
                    <div className="text-xs font-medium text-foreground">
                      {PROVIDER_NAMES[provider] || provider}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {MODEL_TIERS.map((tier) => (
                        <div key={tier} className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            {TIER_INFO[tier].name}
                          </label>
                          <Select
                            value={providerConfig?.[tier] || "none"}
                            onValueChange={(value: string) =>
                              updateTierModel(
                                provider,
                                tier,
                                value === "none" ? null : value
                              )
                            }
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">
                                None
                              </SelectItem>
                              {enabledModels.map((model) => (
                                <SelectItem
                                  key={model.id}
                                  value={model.id}
                                  className="text-xs"
                                >
                                  {model.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="panel-providers" className="border-b-0">
          <AccordionTrigger className="px-3 py-2 hover:no-underline bg-muted/30">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">Panel Providers</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3 pt-0">
            <p className="text-xs text-muted-foreground mb-2">
              Choose which LLM provider each panel position uses.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((panelIndex) => (
                <div key={panelIndex} className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Panel {panelIndex + 1}
                  </label>
                  <Select
                    value={panelProviders[panelIndex] || "anthropic"}
                    onValueChange={(value: string) =>
                      setPanelProvider(panelIndex, value as Provider)
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_PROVIDERS.map((provider) => (
                        <SelectItem
                          key={provider}
                          value={provider}
                          className="text-xs"
                        >
                          {PROVIDER_NAMES[provider] || provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Model List Accordion */}
      <div className="flex-1 overflow-y-auto">
        <Accordion type="multiple" className="border-b border-border">
          <AccordionItem value="model-list" className="border-b-0">
            <AccordionTrigger className="px-3 py-2 hover:no-underline bg-muted/30">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Model List</span>
                <span className="text-[10px] text-muted-foreground/70">
                  ({enabledCount}/{totalCount} enabled)
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              {/* Bulk actions */}
              <div className="p-2 flex items-center justify-between border-b border-border bg-background">
                <span className="text-xs text-muted-foreground">Toggle all models</span>
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

              {/* Provider accordions */}
              <Accordion type="multiple" defaultValue={Object.keys(MODELS_BY_PROVIDER)}>
                {Object.entries(MODELS_BY_PROVIDER).map(([provider, models]) => {
                  const enabledInProvider = models.filter((m) => isModelEnabled(m.id)).length;
                  return (
                    <AccordionItem key={provider} value={provider} className="border-b border-border last:border-b-0">
                      <AccordionTrigger className="px-3 py-2 hover:no-underline bg-muted/50">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            {PROVIDER_NAMES[provider] || provider}
                          </span>
                          <span className="text-[10px] text-muted-foreground/70">
                            ({enabledInProvider}/{models.length})
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-0">
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
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
