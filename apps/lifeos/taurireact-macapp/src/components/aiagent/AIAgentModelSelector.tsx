import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  useAIAgent,
  AI_AGENT_MODELS,
  AIAgentModelId,
} from "@/lib/contexts/AIAgentContext";

// Provider display names
const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  google: "Google",
  anthropic: "Anthropic",
  xai: "xAI",
};

// Provider colors for visual distinction
const PROVIDER_COLORS: Record<string, string> = {
  openai: "bg-green-500",
  google: "bg-blue-500",
  anthropic: "bg-orange-500",
  xai: "bg-gray-700 dark:bg-gray-300",
};

function ProviderIcon({ provider }: { provider: string }) {
  return (
    <div
      className={`w-3 h-3 rounded-full ${PROVIDER_COLORS[provider] || "bg-muted-foreground"}`}
    />
  );
}

interface AIAgentModelSelectorProps {
  disabled?: boolean;
}

export function AIAgentModelSelector({ disabled = false }: AIAgentModelSelectorProps) {
  const { selectedModelId, setSelectedModelId, isLoading } = useAIAgent();

  const selectedModel = AI_AGENT_MODELS.find((m) => m.id === selectedModelId);

  // Group models by provider
  const modelsByProvider = AI_AGENT_MODELS.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    },
    {} as Record<string, typeof AI_AGENT_MODELS[number][]>
  );

  const handleSelectModel = (modelId: AIAgentModelId) => {
    setSelectedModelId(modelId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled || isLoading}>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-8"
          disabled={disabled || isLoading}
        >
          {selectedModel && <ProviderIcon provider={selectedModel.provider} />}
          <span className="text-xs font-medium truncate max-w-[140px]">
            {selectedModel?.name || "Select Model"}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
        {Object.entries(modelsByProvider).map(([provider, models], index) => (
          <div key={provider}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {PROVIDER_NAMES[provider] || provider}
            </DropdownMenuLabel>
            {models.map((model) => (
              <DropdownMenuItem
                key={model.id}
                onClick={() => handleSelectModel(model.id)}
                className="gap-2 cursor-pointer"
              >
                <ProviderIcon provider={model.provider} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{model.name}</div>
                  {model.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {model.description}
                    </div>
                  )}
                </div>
                {selectedModelId === model.id && (
                  <Check className="h-4 w-4 shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
