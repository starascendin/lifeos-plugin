import { useChatNexus } from "../../lib/contexts/ChatNexusContext";
import { MODEL_TIERS, TIER_INFO, ModelTier } from "../../lib/constants/models";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check } from "lucide-react";

// Color badges for each tier level
const TIER_COLORS: Record<ModelTier, string> = {
  mini: "bg-green-500",
  normal: "bg-blue-500",
  pro: "bg-purple-500",
};

export function TierSelector() {
  const { currentTier, applyTierToAllPanels, isAnyPanelStreaming } =
    useChatNexus();

  const handleSelectTier = (tier: ModelTier) => {
    applyTierToAllPanels(tier);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isAnyPanelStreaming}>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-8"
          disabled={isAnyPanelStreaming}
        >
          <div className={`w-2.5 h-2.5 rounded-full ${TIER_COLORS[currentTier]}`} />
          <span className="text-xs font-medium">
            {TIER_INFO[currentTier].name}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {MODEL_TIERS.map((tier) => (
          <DropdownMenuItem
            key={tier}
            onClick={() => handleSelectTier(tier)}
            className="gap-2 cursor-pointer"
          >
            <div className={`w-3 h-3 rounded-full ${TIER_COLORS[tier]}`} />
            <div className="flex-1">
              <div className="font-medium text-sm">{TIER_INFO[tier].name}</div>
              <div className="text-xs text-muted-foreground">
                {TIER_INFO[tier].description}
              </div>
            </div>
            {currentTier === tier && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
