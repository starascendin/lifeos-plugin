import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  User,
  Bot,
  History,
  MessageSquare,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useLLMCouncilAPI,
  LLM_INFO,
  type LLMType,
  type CouncilMessage,
  type ConversationListItem,
} from "@/lib/contexts/LLMCouncilAPIContext";

// Markdown renderer component
function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-pre:bg-muted prose-pre:p-3 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-table:w-full prose-table:border-collapse prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-th:text-left prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

// ==================== CONVERSATION HISTORY ====================

function ConversationHistory() {
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
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          disabled={isCouncilLoading}
        >
          <History className="h-3.5 w-3.5" />
          History
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
                  <span className="line-clamp-2 text-sm">
                    {conv.query}
                  </span>
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

// ==================== MODEL SELECTOR ====================

function ModelSelector() {
  const { selectedLLMs, toggleLLM, authStatus } = useLLMCouncilAPI();

  const llmTypes: LLMType[] = ["chatgpt", "claude", "gemini", "xai"];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Models:</span>
      {llmTypes.map((llm) => {
        const info = LLM_INFO[llm];
        const isSelected = selectedLLMs.includes(llm);
        const isOnline = authStatus[llm];

        return (
          <button
            key={llm}
            onClick={() => toggleLLM(llm)}
            disabled={!isOnline}
            title={`${info.name} - ${isOnline ? (isSelected ? "Selected" : "Click to select") : "Offline"}`}
            className={cn(
              "flex items-center gap-1.5 rounded-full border-2 py-1 pl-1 pr-2 text-xs font-medium transition-all",
              isSelected && isOnline
                ? "border-primary bg-primary/10"
                : "border-transparent bg-muted/50",
              isOnline
                ? "cursor-pointer hover:bg-muted"
                : "cursor-not-allowed opacity-40"
            )}
          >
            <div
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white",
                info.bgColor.replace("100", "500")
              )}
            >
              {llm === "chatgpt" && "G"}
              {llm === "claude" && "A"}
              {llm === "gemini" && "+"}
              {llm === "xai" && "X"}
            </div>
            <span>{info.name}</span>
            {isOnline ? (
              isSelected ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-green-500" />
              )
            ) : (
              <XCircle className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ==================== COUNCIL STAGES ====================

interface StageSectionProps {
  message: CouncilMessage;
  stageId?: string;
}

function Stage1Section({ message, stageId }: StageSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!message.stage1 || message.stage1.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          id={stageId}
          variant="ghost"
          className="flex w-full items-center justify-between p-3 hover:bg-muted/50"
        >
          <span className="font-medium">Stage 1: Initial Responses</span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Tabs defaultValue={message.stage1[0]?.llmType} className="p-3 pt-0">
          <TabsList className="w-full justify-start">
            {message.stage1.map((result) => (
              <TabsTrigger key={result.llmType} value={result.llmType}>
                {LLM_INFO[result.llmType as LLMType]?.name || result.llmType}
              </TabsTrigger>
            ))}
          </TabsList>
          {message.stage1.map((result) => (
            <TabsContent key={result.llmType} value={result.llmType}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{result.model}</Badge>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <Markdown>{result.response}</Markdown>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Stage2Section({ message, stageId }: StageSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!message.stage2 || message.stage2.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          id={stageId}
          variant="ghost"
          className="flex w-full items-center justify-between p-3 hover:bg-muted/50"
        >
          <span className="font-medium">Stage 2: Rankings</span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 p-3 pt-0">
        {/* Aggregate Rankings */}
        {message.metadata?.aggregateRankings &&
          message.metadata.aggregateRankings.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium">Aggregate Ranking:</span>
              <div className="flex flex-wrap gap-2">
                {message.metadata.aggregateRankings.map((ranking, idx) => (
                  <Badge key={idx} variant="secondary">
                    #{idx + 1} {ranking.model} (avg:{" "}
                    {ranking.averageRank.toFixed(1)})
                  </Badge>
                ))}
              </div>
            </div>
          )}

        {/* Individual Rankings */}
        <Tabs defaultValue={message.stage2[0]?.llmType}>
          <TabsList className="w-full justify-start">
            {message.stage2.map((result) => (
              <TabsTrigger key={result.llmType} value={result.llmType}>
                {LLM_INFO[result.llmType as LLMType]?.name || result.llmType}
              </TabsTrigger>
            ))}
          </TabsList>
          {message.stage2.map((result) => (
            <TabsContent key={result.llmType} value={result.llmType}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{result.model}</Badge>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <Markdown>{result.ranking}</Markdown>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Stage3Section({ message, stageId }: StageSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!message.stage3 || message.stage3.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          id={stageId}
          variant="ghost"
          className="flex w-full items-center justify-between p-3 hover:bg-muted/50"
        >
          <span className="font-medium">Stage 3: Final Synthesis</span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Tabs defaultValue={message.stage3[0]?.llmType} className="p-3 pt-0">
          <TabsList className="w-full justify-start">
            {message.stage3.map((result) => (
              <TabsTrigger key={result.llmType} value={result.llmType}>
                Chairman: {LLM_INFO[result.llmType as LLMType]?.name || result.llmType}
              </TabsTrigger>
            ))}
          </TabsList>
          {message.stage3.map((result) => (
            <TabsContent key={result.llmType} value={result.llmType}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{result.model}</Badge>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <Markdown>{result.response}</Markdown>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ==================== STAGE NAVIGATION ====================

interface StageNavProps {
  message: CouncilMessage;
  messageId: string;
}

function StageNav({ message, messageId }: StageNavProps) {
  const hasStage1 = message.stage1 && message.stage1.length > 0;
  const hasStage2 = message.stage2 && message.stage2.length > 0;
  const hasStage3 = message.stage3 && message.stage3.length > 0;

  const scrollToStage = (stageNum: number) => {
    const element = document.getElementById(`${messageId}-stage-${stageNum}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const stages = [
    { num: 1, label: "Initial", available: hasStage1 },
    { num: 2, label: "Ranking", available: hasStage2 },
    { num: 3, label: "Synthesis", available: hasStage3 },
  ];

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      {stages.map((stage, idx) => (
        <div key={stage.num} className="flex flex-col items-center">
          {/* Stage indicator */}
          <button
            onClick={() => scrollToStage(stage.num)}
            disabled={!stage.available}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all",
              stage.available
                ? "cursor-pointer border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                : "cursor-not-allowed border-muted-foreground/30 bg-muted text-muted-foreground/50"
            )}
            title={stage.available ? `Jump to Stage ${stage.num}: ${stage.label}` : `Stage ${stage.num} not available`}
          >
            {stage.num}
          </button>
          {/* Connector line */}
          {idx < stages.length - 1 && (
            <div
              className={cn(
                "h-4 w-0.5",
                stage.available && stages[idx + 1].available
                  ? "bg-primary"
                  : "bg-muted-foreground/30"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ==================== MESSAGE DISPLAY ====================

function CouncilMessageDisplay({ message }: { message: CouncilMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <User className="h-4 w-4" />
        </div>
        <div className="flex-1 pt-1">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  const hasStages =
    (message.stage1 && message.stage1.length > 0) ||
    (message.stage2 && message.stage2.length > 0) ||
    (message.stage3 && message.stage3.length > 0);

  // Assistant message
  return (
    <div className="border-t">
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <Bot className="h-4 w-4" />
        </div>
        <div className="flex-1 pt-1">
          {message.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Council is deliberating... This may take 1-2 minutes.</span>
            </div>
          ) : message.error ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{message.error}</span>
            </div>
          ) : (
            <div className="space-y-1">
              {message.duration && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Completed in {Math.round(message.duration / 1000)}s
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stages with vertical navigation */}
      {!message.isLoading && !message.error && hasStages && (
        <div className="relative flex">
          {/* Vertical stage navigation bar - sticky */}
          <div className="sticky top-0 flex h-fit shrink-0 flex-col items-center self-start border-r bg-muted/30 px-2">
            <StageNav message={message} messageId={message.id} />
          </div>

          {/* Stage content */}
          <div className="flex-1 divide-y">
            <Stage1Section message={message} stageId={`${message.id}-stage-1`} />
            <Stage2Section message={message} stageId={`${message.id}-stage-2`} />
            <Stage3Section message={message} stageId={`${message.id}-stage-3`} />
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== MAIN COUNCIL VIEW ====================

export function CouncilView() {
  const { councilMessages, clearCouncilMessages, isCouncilLoading, isConfigured } =
    useLLMCouncilAPI();

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-4xl space-y-4 p-4">
          {/* Header + Model Selector - Compact */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-primary">LLM Council</h1>
                <span className="text-xs text-muted-foreground">
                  Multi-model deliberation with ranking & synthesis
                </span>
                {isConfigured && <ConversationHistory />}
              </div>
              {isConfigured && <ModelSelector />}
            </div>

            {!isConfigured && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Click the <strong>Settings</strong> icon (gear) in the toolbar to configure your API URL and Key.
                </p>
              </div>
            )}
          </div>

          {/* Messages */}
          {councilMessages.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Conversation</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCouncilMessages}
                  disabled={isCouncilLoading}
                >
                  Clear
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {councilMessages.map((message) => (
                    <CouncilMessageDisplay key={message.id} message={message} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
