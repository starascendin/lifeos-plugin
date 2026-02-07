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
  useCatGirl,
  CATGIRL_MODELS,
  CatGirlModelId,
} from "@/lib/contexts/CatGirlContext";

// Provider display names
const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  google: "Google",
};

// Provider colors for visual distinction
const PROVIDER_COLORS: Record<string, string> = {
  openai: "bg-green-500",
  google: "bg-blue-500",
};

function ProviderIcon({ provider }: { provider: string }) {
  return (
    <div
      className={`w-3 h-3 rounded-full ${PROVIDER_COLORS[provider] || "bg-muted-foreground"}`}
    />
  );
}

interface CatGirlModelSelectorProps {
  disabled?: boolean;
}

export function CatGirlModelSelector({ disabled = false }: CatGirlModelSelectorProps) {
  const { selectedModelId, setSelectedModelId, isLoading } = useCatGirl();

  const selectedModel = CATGIRL_MODELS.find((m) => m.id === selectedModelId);

  // Group models by provider
  const modelsByProvider = CATGIRL_MODELS.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    },
    {} as Record<string, typeof CATGIRL_MODELS[number][]>
  );

  const handleSelectModel = (modelId: CatGirlModelId) => {
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
      <DropdownMenuContent align="start" className="w-56">
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
