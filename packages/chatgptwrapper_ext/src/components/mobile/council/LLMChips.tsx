import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCouncilStore } from '../../../store/councilStore';
import { useAppStore } from '../../../store/appStore';
import { LLM_CONFIG, LLM_PROVIDERS, type LLMType } from '../../../config/llm';

export function LLMChips() {
  const selectedLLMs = useCouncilStore((state) => state.selectedLLMs);
  const toggleLLM = useCouncilStore((state) => state.toggleLLM);
  const isLoading = useCouncilStore((state) => state.isLoading);
  const authStatus = useAppStore((state) => state.authStatus);

  const handleToggle = (llm: LLMType) => {
    if (authStatus[llm] && !isLoading) {
      toggleLLM(llm);
    }
  };

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
      {LLM_PROVIDERS.map((llm) => {
        const config = LLM_CONFIG[llm];
        const isOnline = authStatus[llm];
        const isSelected = selectedLLMs.includes(llm);

        return (
          <Badge
            key={llm}
            variant={isSelected ? "default" : "outline"}
            className={cn(
              "shrink-0 cursor-pointer h-9 px-3 gap-1.5 text-sm",
              "touch-manipulation transition-all",
              !isOnline && "opacity-40 cursor-not-allowed",
              isSelected && "ring-2 ring-offset-1 ring-offset-background"
            )}
            style={{
              backgroundColor: isSelected ? config.color : undefined,
              borderColor: config.color,
              color: isSelected ? 'white' : config.color
            }}
            onClick={() => handleToggle(llm)}
          >
            <span className="font-bold">{config.icon}</span>
            <span>{config.name}</span>
            {!isOnline && <span className="text-xs opacity-70">(off)</span>}
          </Badge>
        );
      })}
    </div>
  );
}
