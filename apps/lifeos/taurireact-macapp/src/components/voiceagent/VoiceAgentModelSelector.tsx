import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  useVoiceAgent,
  VOICE_AGENT_MODELS,
  VoiceAgentModelId,
} from "@/lib/contexts/VoiceAgentContext";

interface VoiceAgentModelSelectorProps {
  disabled?: boolean;
}

export function VoiceAgentModelSelector({ disabled = false }: VoiceAgentModelSelectorProps) {
  const { selectedModelId, setSelectedModelId, connectionState } = useVoiceAgent();

  const selectedModel = VOICE_AGENT_MODELS.find((m) => m.id === selectedModelId);
  const isDisabled = disabled || connectionState !== "disconnected";

  const handleSelectModel = (modelId: VoiceAgentModelId) => {
    setSelectedModelId(modelId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isDisabled}>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-8"
          disabled={isDisabled}
        >
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-xs font-medium truncate max-w-[140px]">
            {selectedModel?.name || "Select Model"}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {VOICE_AGENT_MODELS.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => handleSelectModel(model.id)}
            className="gap-2 cursor-pointer"
          >
            <div className="w-3 h-3 rounded-full bg-green-500" />
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
