import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useLLMCouncil,
  MODEL_TIERS,
  TIER_INFO,
  type ModelTier,
} from "@/lib/contexts/LLMCouncilContext";
import { Users, ChevronDown, Zap, Sparkles, Crown, Settings } from "lucide-react";
import { CouncilTierSettingsDialog } from "./CouncilTierSettingsDialog";

export function CouncilHeader() {
  const {
    councilModels,
    chairmanModel,
    deliberationState,
    isDeliberating,
    currentTier,
    setTier,
    tierConfig,
    chairmanModelId,
    updateTierSettings,
  } = useLLMCouncil();

  const [settingsOpen, setSettingsOpen] = useState(false);

  const getStatusText = () => {
    switch (deliberationState.status) {
      case "stage1":
        return "Stage 1: Collecting Responses";
      case "stage2":
        return "Stage 2: Peer Evaluation";
      case "stage3":
        return "Stage 3: Chairman Synthesis";
      case "complete":
        return "Deliberation Complete";
      case "error":
        return "Error";
      default:
        return "Ready";
    }
  };

  const getStatusColor = () => {
    switch (deliberationState.status) {
      case "stage1":
      case "stage2":
      case "stage3":
        return "bg-blue-500";
      case "complete":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-muted";
    }
  };

  const getTierIcon = (tier: ModelTier) => {
    switch (tier) {
      case "mini":
        return <Zap className="h-4 w-4" />;
      case "normal":
        return <Sparkles className="h-4 w-4" />;
      case "pro":
        return <Crown className="h-4 w-4" />;
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

  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">LLM Council</h1>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${getStatusColor()} ${isDeliberating ? "animate-pulse" : ""}`}
          />
          <span className="text-sm text-muted-foreground">{getStatusText()}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Tier selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isDeliberating}
              className="gap-2"
            >
              <span className={getTierColor(currentTier)}>
                {getTierIcon(currentTier)}
              </span>
              <span>{TIER_INFO[currentTier].name}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {MODEL_TIERS.map((tier) => (
              <DropdownMenuItem
                key={tier}
                onClick={() => setTier(tier)}
                className="gap-2"
              >
                <span className={getTierColor(tier)}>{getTierIcon(tier)}</span>
                <div className="flex flex-col">
                  <span className="font-medium">{TIER_INFO[tier].name}</span>
                  <span className="text-xs text-muted-foreground">
                    {TIER_INFO[tier].description}
                  </span>
                </div>
                {tier === currentTier && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    Active
                  </Badge>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Council members badges */}
        <div className="hidden md:flex items-center gap-1">
          {councilModels.slice(0, 3).map((model) => (
            <Badge key={model.modelId} variant="secondary" className="text-xs">
              {model.modelName.split(" ")[0]}
            </Badge>
          ))}
          {councilModels.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{councilModels.length - 3}
            </Badge>
          )}
        </div>

        {/* Chairman badge */}
        <div className="hidden lg:flex items-center gap-1">
          <Crown className="h-3 w-3 text-yellow-500" />
          <Badge variant="outline" className="text-xs">
            {chairmanModel.modelName.split(" ")[0]}
          </Badge>
        </div>

        {/* Settings button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSettingsOpen(true)}
          disabled={isDeliberating}
          className="h-8 w-8"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Settings Dialog */}
      <CouncilTierSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        tierConfig={tierConfig}
        chairmanModelId={chairmanModelId}
        onSave={updateTierSettings}
      />
    </header>
  );
}
