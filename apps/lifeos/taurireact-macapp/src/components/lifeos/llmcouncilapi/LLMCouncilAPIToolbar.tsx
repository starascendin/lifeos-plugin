import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Square,
  Columns2,
  Columns3,
  LayoutGrid,
  RefreshCw,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useLLMCouncilAPI,
  type ViewMode,
  type LayoutType,
  type Tier,
} from "@/lib/contexts/LLMCouncilAPIContext";
import { LLMCouncilAPISettings } from "./LLMCouncilAPISettings";

const LAYOUT_OPTIONS: { value: LayoutType; icon: React.ReactNode; label: string }[] = [
  { value: 1, icon: <Square className="h-4 w-4" />, label: "1 Panel" },
  { value: 2, icon: <Columns2 className="h-4 w-4" />, label: "2 Panels" },
  { value: 3, icon: <Columns3 className="h-4 w-4" />, label: "3 Panels" },
  { value: 4, icon: <LayoutGrid className="h-4 w-4" />, label: "4 Panels" },
];

const TIER_OPTIONS: { value: Tier; label: string; color: string }[] = [
  { value: "mini", label: "Mini", color: "bg-green-500" },
  { value: "normal", label: "Normal", color: "bg-blue-500" },
  { value: "pro", label: "Pro", color: "bg-purple-500" },
];

export function LLMCouncilAPIToolbar() {
  const {
    viewMode,
    setViewMode,
    currentLayout,
    setCurrentLayout,
    currentTier,
    setCurrentTier,
    isHealthy,
    checkHealth,
    authStatus,
    isCheckingAuth,
    checkAuthStatus,
    baseUrl,
    apiKey,
    saveSettings,
  } = useLLMCouncilAPI();

  return (
    <div className="flex items-center justify-between gap-4 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left: Mode Toggle + Layout (if multichat) */}
      <div className="flex items-center gap-3">
        {/* Mode Toggle */}
        <div className="flex items-center rounded-lg bg-muted p-1">
          <Button
            variant={viewMode === "council" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("council")}
            className="h-7 px-3 text-xs"
          >
            Council
          </Button>
          <Button
            variant={viewMode === "multichat" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("multichat")}
            className="h-7 px-3 text-xs"
          >
            Multi-Chat
          </Button>
        </div>

        {/* Layout Selector (only in multichat mode) */}
        {viewMode === "multichat" && (
          <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
            {LAYOUT_OPTIONS.map((option) => (
              <Tooltip key={option.value}>
                <TooltipTrigger asChild>
                  <Button
                    variant={currentLayout === option.value ? "default" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentLayout(option.value)}
                  >
                    {option.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{option.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>

      {/* Right: Status + Tier + Settings */}
      <div className="flex items-center gap-3">
        {/* Connection Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                checkHealth();
                checkAuthStatus();
              }}
              disabled={isCheckingAuth}
              className="h-7 gap-1.5 px-2"
            >
              {isCheckingAuth ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : isHealthy ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-red-500" />
              )}
              <span className="text-xs">{isHealthy ? "Connected" : "Offline"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">LLM Status</p>
              <div className="flex flex-wrap gap-1.5">
                {(["chatgpt", "claude", "gemini", "xai"] as const).map((llm) => (
                  <Badge
                    key={llm}
                    variant={authStatus[llm] ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {llm === "chatgpt" && "GPT"}
                    {llm === "claude" && "Claude"}
                    {llm === "gemini" && "Gemini"}
                    {llm === "xai" && "Grok"}
                    {authStatus[llm] ? " ✓" : " ✗"}
                  </Badge>
                ))}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Tier Selector */}
        <Select value={currentTier} onValueChange={(v) => setCurrentTier(v as Tier)}>
          <SelectTrigger className="h-7 w-24 text-xs">
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  TIER_OPTIONS.find((t) => t.value === currentTier)?.color
                )}
              />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {TIER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", option.color)} />
                  {option.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Settings Dialog */}
        <LLMCouncilAPISettings
          baseUrl={baseUrl}
          apiKey={apiKey}
          onSave={saveSettings}
        />
      </div>
    </div>
  );
}
