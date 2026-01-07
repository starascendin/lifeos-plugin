import { useState } from "react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Square,
  Columns2,
  Columns3,
  LayoutGrid,
  RefreshCw,
  CheckCircle,
  XCircle,
  History,
  Clock,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useLLMCouncilAPI,
  LLM_INFO,
  type ViewMode,
  type LayoutType,
  type Tier,
  type LLMType,
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

const LLM_TYPES: LLMType[] = ["chatgpt", "claude", "gemini", "xai"];

// History Popover Component
function HistoryPopover() {
  const {
    conversations,
    isLoadingConversations,
    fetchConversations,
    loadConversation,
    currentConversationId,
    isCouncilLoading,
  } = useLLMCouncilAPI();
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = (open: boolean) => {
    setIsOpen(open);
    if (open && conversations.length === 0) {
      fetchConversations();
    }
  };

  const handleSelect = async (id: string) => {
    await loadConversation(id);
    setIsOpen(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={isCouncilLoading}
        >
          <History className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Recent Conversations</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => fetchConversations()}
              disabled={isLoadingConversations}
            >
              {isLoadingConversations ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </div>
        </div>
        <ScrollArea className="h-64">
          {isLoadingConversations && conversations.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-50" />
              <span className="text-sm">No conversations yet</span>
            </div>
          ) : (
            <div className="divide-y">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelect(conv.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 px-3 py-2 text-left transition-colors hover:bg-muted/50",
                    currentConversationId === conv.id && "bg-primary/5"
                  )}
                >
                  <span className="line-clamp-2 text-sm">{conv.query}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDate(conv.createdAt)}
                    {conv.tier && (
                      <Badge variant="outline" className="h-4 px-1 text-[10px]">
                        {conv.tier}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

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
    isConfigured,
    selectedLLMs,
    toggleLLM,
  } = useLLMCouncilAPI();

  return (
    <div className="flex items-center justify-between gap-4 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left: Mode Toggle + Layout/Models */}
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

        {/* Model Selector (only in council mode) */}
        {viewMode === "council" && isConfigured && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1">
              {LLM_TYPES.map((llm) => {
                const info = LLM_INFO[llm];
                const isSelected = selectedLLMs.includes(llm);
                const isOnline = authStatus[llm];

                return (
                  <Tooltip key={llm}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => toggleLLM(llm)}
                        disabled={!isOnline}
                        className={cn(
                          "relative flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white transition-all",
                          info.bgColor.replace("100", "500"),
                          isSelected && isOnline
                            ? "ring-2 ring-primary ring-offset-1"
                            : "opacity-50",
                          !isOnline && "cursor-not-allowed grayscale"
                        )}
                      >
                        {llm === "chatgpt" && "G"}
                        {llm === "claude" && "A"}
                        {llm === "gemini" && "+"}
                        {llm === "xai" && "X"}
                        {/* Status indicator */}
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-background",
                            isOnline ? "bg-green-500" : "bg-red-500"
                          )}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>
                        {info.name} - {isOnline ? (isSelected ? "Selected" : "Click to select") : "Offline"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            <div className="h-4 w-px bg-border" />
            <HistoryPopover />
          </>
        )}
      </div>

      {/* Right: Tier + Settings */}
      <div className="flex items-center gap-3">
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
