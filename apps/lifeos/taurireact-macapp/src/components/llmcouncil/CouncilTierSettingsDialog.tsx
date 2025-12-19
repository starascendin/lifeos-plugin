import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Zap, Sparkles, Crown, RotateCcw } from "lucide-react";
import {
  DEFAULT_TIER_CONFIG,
  WHITELISTED_MODELS,
  MODELS_BY_PROVIDER,
  ALL_PROVIDERS,
  PROVIDER_NAMES,
  MODEL_TIERS,
  TIER_INFO,
  type TierConfiguration,
  type ModelTier,
} from "@/lib/constants/models";

// Default chairman model
const DEFAULT_CHAIRMAN_MODEL_ID = "google/gemini-2.5-pro";

interface CouncilTierSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tierConfig: TierConfiguration;
  chairmanModelId: string | null;
  onSave: (tierConfig: TierConfiguration, chairmanModelId: string) => void;
}

export function CouncilTierSettingsDialog({
  open,
  onOpenChange,
  tierConfig,
  chairmanModelId,
  onSave,
}: CouncilTierSettingsDialogProps) {
  const [localConfig, setLocalConfig] = useState<TierConfiguration>(tierConfig);
  const [localChairmanModelId, setLocalChairmanModelId] = useState<string>(
    chairmanModelId ?? DEFAULT_CHAIRMAN_MODEL_ID
  );

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalConfig(tierConfig);
      setLocalChairmanModelId(chairmanModelId ?? DEFAULT_CHAIRMAN_MODEL_ID);
    }
  }, [open, tierConfig, chairmanModelId]);

  const handleModelChange = (provider: string, tier: ModelTier, modelId: string | null) => {
    setLocalConfig((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [tier]: modelId,
      },
    }));
  };

  const handleSave = () => {
    onSave(localConfig, localChairmanModelId);
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalConfig(DEFAULT_TIER_CONFIG);
    setLocalChairmanModelId(DEFAULT_CHAIRMAN_MODEL_ID);
  };

  // Get the display name for the selected chairman model
  const getChairmanModelName = () => {
    const model = WHITELISTED_MODELS.find((m) => m.id === localChairmanModelId);
    return model?.name ?? localChairmanModelId;
  };

  const getTierIcon = (tier: ModelTier) => {
    switch (tier) {
      case "mini":
        return <Zap className="h-3 w-3" />;
      case "normal":
        return <Sparkles className="h-3 w-3" />;
      case "pro":
        return <Crown className="h-3 w-3" />;
    }
  };

  const getTierColor = (tier: ModelTier) => {
    switch (tier) {
      case "mini":
        return "text-green-500";
      case "normal":
        return "text-blue-500";
      case "pro":
        return "text-purple-500";
    }
  };

  // Get available models for a provider
  const getModelsForProvider = (provider: string) => {
    return WHITELISTED_MODELS.filter((m) => m.provider === provider);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Council Tier Settings</DialogTitle>
          <DialogDescription>
            Configure which models are used for each tier level. Each tier selects one model from
            each provider to form the council.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Chairman Model Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Chairman Model</Label>
            <p className="text-xs text-muted-foreground mb-2">
              The chairman synthesizes all responses into a final answer
            </p>
            <Select
              value={localChairmanModelId}
              onValueChange={(value) => setLocalChairmanModelId(value)}
            >
              <SelectTrigger className="w-64">
                <div className="flex items-center gap-2">
                  <Crown className="h-3 w-3 text-yellow-500" />
                  <SelectValue>{getChairmanModelName()}</SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent>
                {ALL_PROVIDERS.map((provider) => (
                  <SelectGroup key={provider}>
                    <SelectLabel>{PROVIDER_NAMES[provider]}</SelectLabel>
                    {MODELS_BY_PROVIDER[provider]?.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4" />

          {/* Tier Configuration Grid */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Label className="text-sm font-medium">Model Configuration</Label>
            </div>

            {/* Header row with tier names */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              <div className="font-medium text-sm">Provider</div>
              {MODEL_TIERS.map((tier) => (
                <div key={tier} className="flex items-center gap-1 font-medium text-sm">
                  <span className={getTierColor(tier)}>{getTierIcon(tier)}</span>
                  <span>{TIER_INFO[tier].name}</span>
                </div>
              ))}
            </div>

            {/* Provider rows */}
            {ALL_PROVIDERS.map((provider) => {
              const providerModels = getModelsForProvider(provider);
              const providerConfig = localConfig[provider] ?? {
                mini: null,
                normal: null,
                pro: null,
              };

              return (
                <div key={provider} className="grid grid-cols-4 gap-2 items-center">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-medium">
                      {PROVIDER_NAMES[provider]}
                    </Badge>
                  </div>

                  {MODEL_TIERS.map((tier) => (
                    <Select
                      key={`${provider}-${tier}`}
                      value={providerConfig[tier] ?? "none"}
                      onValueChange={(value) =>
                        handleModelChange(provider, tier, value === "none" ? null : value)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">None</span>
                        </SelectItem>
                        {providerModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            <span className="truncate">{model.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Info about current selection */}
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p>
              When you select a tier, the council will use the corresponding model from each
              provider. The chairman uses the selected provider's model at the current tier to
              synthesize the final answer.
            </p>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1">
            <RotateCcw className="h-3 w-3" />
            Reset to Defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Settings</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
