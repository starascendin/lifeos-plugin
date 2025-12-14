import { useMemo } from "react";
import { useChatNexus } from "../../lib/contexts/ChatNexusContext";
import { useChatNexusSettings } from "../../lib/hooks/useChatNexusSettings";
import {
  MODELS_BY_PROVIDER,
  PROVIDER_NAMES,
  ModelOption,
} from "../../lib/constants/models";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check } from "lucide-react";

interface ModelSelectorProps {
  panelId: string;
}

export function ModelSelector({ panelId }: ModelSelectorProps) {
  const { panelConfigs, updatePanelModel, isAnyPanelStreaming } = useChatNexus();
  const { isModelEnabled } = useChatNexusSettings();

  const config = panelConfigs.find((p) => p.panelId === panelId);

  // Filter models to only show enabled ones
  const filteredModelsByProvider = useMemo(() => {
    return Object.entries(MODELS_BY_PROVIDER).reduce(
      (acc, [provider, models]) => {
        const enabledModels = models.filter((m) => isModelEnabled(m.id));
        if (enabledModels.length > 0) {
          acc[provider] = enabledModels;
        }
        return acc;
      },
      {} as Record<string, ModelOption[]>
    );
  }, [isModelEnabled]);

  const handleSelectModel = (model: ModelOption) => {
    updatePanelModel(panelId, model);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isAnyPanelStreaming}>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          disabled={isAnyPanelStreaming}
        >
          <ProviderIcon provider={config?.modelProvider || ""} />
          <span className="text-foreground">
            {config?.modelDisplayName || "Select Model"}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
        {Object.entries(filteredModelsByProvider).map(([provider, models], index) => (
          <div key={provider}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {PROVIDER_NAMES[provider] || provider}
            </DropdownMenuLabel>
            {models.map((model) => (
              <DropdownMenuItem
                key={model.id}
                onClick={() => handleSelectModel(model)}
                className="gap-2"
              >
                <ProviderIcon provider={model.provider} />
                <div className="flex-1">
                  <div className="font-medium">{model.name}</div>
                  {model.description && (
                    <div className="text-xs text-muted-foreground">
                      {model.description}
                    </div>
                  )}
                </div>
                {config?.modelId === model.id && (
                  <Check className="h-4 w-4" />
                )}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProviderIcon({ provider }: { provider: string }) {
  // Simple colored circles for different providers
  const colors: Record<string, string> = {
    openai: "bg-green-500",
    anthropic: "bg-orange-500",
    google: "bg-blue-500",
    meta: "bg-blue-600",
    mistral: "bg-indigo-500",
    xai: "bg-gray-700 dark:bg-gray-300",
    deepseek: "bg-teal-500",
    cohere: "bg-purple-500",
    perplexity: "bg-cyan-500",
  };

  return (
    <div
      className={`w-4 h-4 rounded-full ${colors[provider] || "bg-muted-foreground"}`}
    />
  );
}
