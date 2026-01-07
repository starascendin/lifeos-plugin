import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  AlertCircle,
  User,
  Bot,
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
} from "@/lib/contexts/LLMCouncilAPIContext";

// Markdown renderer component
function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-pre:bg-muted prose-pre:p-3 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-table:w-full prose-table:border-collapse prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-th:text-left prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
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
    <div className="flex flex-col items-center gap-0.5 py-2 sm:gap-1">
      {stages.map((stage, idx) => (
        <div key={stage.num} className="flex flex-col items-center">
          {/* Stage indicator */}
          <button
            onClick={() => scrollToStage(stage.num)}
            disabled={!stage.available}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-all sm:h-8 sm:w-8 sm:text-xs",
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
                "h-3 w-0.5 sm:h-4",
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
          {/* Not configured message */}
          {!isConfigured && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Click the <strong>Settings</strong> icon (gear) in the toolbar to configure your API URL and Key.
              </p>
            </div>
          )}

          {/* Messages */}
          {councilMessages.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-2">
                <CardTitle className="text-sm">Conversation</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
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

          {/* Empty state */}
          {isConfigured && councilMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <MessageSquare className="h-12 w-12 opacity-30" />
              <p className="text-sm">Send a message to start a council deliberation</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
