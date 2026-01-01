import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Supported models for AI Gateway (must match backend)
export const SUPPORTED_MODELS = [
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "Google",
  },
  {
    id: "xai/grok-4.1-fast-non-reasoning",
    name: "Grok 4.1 Fast",
    provider: "xAI",
  },
] as const;

export type SupportedModelId = (typeof SUPPORTED_MODELS)[number]["id"];

interface ModelSelectorProps {
  value: SupportedModelId;
  onChange: (model: SupportedModelId) => void;
  disabled?: boolean;
}

export function ModelSelector({
  value,
  onChange,
  disabled = false,
}: ModelSelectorProps) {
  const selectedModel = SUPPORTED_MODELS.find((m) => m.id === value);

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as SupportedModelId)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[200px] h-8 text-xs">
        <SelectValue placeholder="Select model">
          {selectedModel && (
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">
                {selectedModel.provider}:
              </span>
              <span>{selectedModel.name}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_MODELS.map((model) => (
          <SelectItem key={model.id} value={model.id} className="text-xs">
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{model.provider}:</span>
              <span>{model.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Usage display component
interface UsageDisplayProps {
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  model?: string | null;
}

export function UsageDisplay({ usage, model }: UsageDisplayProps) {
  if (!usage) return null;

  const modelDisplay = model
    ? SUPPORTED_MODELS.find((m) => m.id === model)?.name || model
    : null;

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      {modelDisplay && (
        <span className="bg-muted px-2 py-0.5 rounded">{modelDisplay}</span>
      )}
      <span title="Prompt tokens">↑ {usage.promptTokens}</span>
      <span title="Completion tokens">↓ {usage.completionTokens}</span>
      <span title="Total tokens" className="font-medium">
        Σ {usage.totalTokens}
      </span>
    </div>
  );
}
