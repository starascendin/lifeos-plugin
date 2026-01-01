import { useEffect, useRef } from "react";
import { User, Bot, Wrench, CheckCircle2, Coins } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AIAgentMessage, TokenUsage } from "@/lib/contexts/AIAgentContext";

interface AIAgentChatProps {
  messages: AIAgentMessage[];
  isLoading: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function ToolCallDisplay({ toolCalls, toolResults }: {
  toolCalls?: { name: string; args: unknown }[];
  toolResults?: { name: string; result: unknown }[];
}) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {toolCalls.map((tc, i) => {
        const result = toolResults?.find((tr) => tr.name === tc.name);
        const argsStr = tc.args !== undefined ? JSON.stringify(tc.args) : "(no args)";
        const resultStr = result?.result !== undefined ? JSON.stringify(result.result) : "(no result)";

        return (
          <Card key={i} className="p-2 bg-muted/50 border-dashed">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wrench className="h-3 w-3" />
              <span className="font-mono font-medium">{tc.name}</span>
              {result && <CheckCircle2 className="h-3 w-3 text-green-500" />}
            </div>
            <div className="mt-1 text-xs">
              <span className="text-muted-foreground">Args: </span>
              <code className="text-xs bg-background rounded px-1">
                {argsStr}
              </code>
            </div>
            {result && (
              <div className="mt-1 text-xs">
                <span className="text-muted-foreground">Result: </span>
                <code className="text-xs bg-background rounded px-1 break-all">
                  {resultStr}
                </code>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function MessageTokenUsage({ usage }: { usage?: TokenUsage }) {
  if (!usage || usage.totalTokens === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 mt-0.5">
          <Coins className="h-2.5 w-2.5" />
          <span>{usage.totalTokens.toLocaleString()}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <div className="space-y-0.5">
          <div>Prompt: {usage.promptTokens.toLocaleString()}</div>
          <div>Completion: {usage.completionTokens.toLocaleString()}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function MessageBubble({ message }: { message: AIAgentMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 mb-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message content */}
      <div
        className={cn(
          "flex flex-col max-w-[80%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <Card
          className={cn(
            "px-4 py-2",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          <ToolCallDisplay
            toolCalls={message.toolCalls}
            toolResults={message.toolResults}
          />
        </Card>
        <div className={cn(
          "flex items-center gap-2 mt-1",
          isUser ? "flex-row-reverse" : "flex-row"
        )}>
          <span className="text-xs text-muted-foreground">
            {formatTime(message.timestamp)}
          </span>
          {!isUser && <MessageTokenUsage usage={message.usage} />}
        </div>
      </div>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex gap-3 mb-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="h-4 w-4" />
      </div>
      <Card className="px-4 py-2 bg-muted">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
            <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
            <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
          </div>
          <span className="text-xs text-muted-foreground">Thinking...</span>
        </div>
      </Card>
    </div>
  );
}

export function AIAgentChat({ messages, isLoading }: AIAgentChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">Start a conversation with the AI Agent</p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <Badge variant="outline">get_weather</Badge>
            <Badge variant="outline">get_time</Badge>
            <Badge variant="outline">calculate</Badge>
          </div>
          <p className="text-xs mt-2 opacity-75">Available tools</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
      <div className="py-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isLoading && <LoadingIndicator />}
      </div>
    </ScrollArea>
  );
}
