import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Loader2, MessageSquare, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useLLMCouncilAPI,
  LLM_INFO,
  MODEL_TIERS,
  type LLMType,
  type PanelState,
} from "@/lib/contexts/LLMCouncilAPIContext";

const ALL_LLMS: LLMType[] = ["chatgpt", "claude", "gemini", "xai"];

interface ChatPanelProps {
  panel: PanelState;
}

export function ChatPanel({ panel }: ChatPanelProps) {
  const { setPanelLLM, clearPanel, currentTier, authStatus } =
    useLLMCouncilAPI();

  const info = LLM_INFO[panel.llmType];
  const isOnline = authStatus[panel.llmType];

  return (
    <Card className="flex h-full flex-col">
      {/* Panel Header */}
      <CardHeader className="flex flex-row items-center gap-1.5 space-y-0 border-b p-1.5 sm:gap-2 sm:p-2">
        {/* LLM Icon */}
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white sm:h-7 sm:w-7 sm:text-xs",
            info.bgColor.replace("100", "500")
          )}
        >
          {panel.llmType === "chatgpt" && "G"}
          {panel.llmType === "claude" && "A"}
          {panel.llmType === "gemini" && "+"}
          {panel.llmType === "xai" && "X"}
        </div>

        {/* LLM Selector */}
        <Select
          value={panel.llmType}
          onValueChange={(v) => setPanelLLM(panel.id, v as LLMType)}
        >
          <SelectTrigger className="h-6 w-20 text-[10px] sm:h-7 sm:w-28 sm:text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_LLMS.map((llm) => (
              <SelectItem
                key={llm}
                value={llm}
                disabled={!authStatus[llm]}
              >
                <div className="flex items-center gap-2">
                  {LLM_INFO[llm].name}
                  {!authStatus[llm] && (
                    <span className="text-muted-foreground">(offline)</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Model Display - hide on mobile */}
        <span className="hidden flex-1 truncate text-xs text-muted-foreground sm:block">
          {MODEL_TIERS[currentTier][panel.llmType]}
        </span>
        <span className="flex-1 sm:hidden" />

        {/* Clear Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 sm:h-7 sm:w-7"
          onClick={() => clearPanel(panel.id)}
          disabled={panel.messages.length === 0}
        >
          <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        </Button>
      </CardHeader>

      {/* Messages Area */}
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          {panel.messages.length === 0 ? (
            <div className="flex h-full min-h-[150px] flex-col items-center justify-center gap-2 text-muted-foreground sm:min-h-[200px]">
              <MessageSquare className="h-6 w-6 opacity-50 sm:h-8 sm:w-8" />
              <span className="text-xs sm:text-sm">Send a message to start</span>
            </div>
          ) : (
            <div className="space-y-2 p-2 sm:space-y-3 sm:p-3">
              {panel.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-1.5 sm:gap-2",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white sm:h-6 sm:w-6",
                        info.bgColor.replace("100", "500")
                      )}
                    >
                      <Bot className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[90%] rounded-lg px-2 py-1.5 text-xs sm:max-w-[85%] sm:px-3 sm:py-2 sm:text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:bg-background/50 prose-pre:p-2 prose-code:bg-background/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-table:w-full prose-table:border-collapse prose-table:text-xs prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-2 prose-th:py-1 prose-th:text-left prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground sm:h-6 sm:w-6">
                      <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {panel.isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                  <span className="text-[10px] sm:text-xs">Thinking...</span>
                </div>
              )}

              {/* Error display */}
              {panel.error && (
                <div className="rounded-lg bg-destructive/10 p-1.5 text-[10px] text-destructive sm:p-2 sm:text-xs">
                  {panel.error}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
