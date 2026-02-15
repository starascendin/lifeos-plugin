import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useVoiceAgent, ChatMessage as ChatMessageType } from "@/lib/contexts/VoiceAgentContext";
import { formatMessageTime } from "@/lib/services/livekit";
import { cn } from "@/lib/utils";
import { User, Bot, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface CompactMessageProps {
  message: ChatMessageType;
  showSender?: boolean;
}

function CompactMessage({ message, showSender = true }: CompactMessageProps) {
  const isUser = message.sender === "user";

  return (
    <div
      className={cn(
        "flex gap-1.5 mb-2",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar - smaller for compact view */}
      {showSender && (
        <div
          className={cn(
            "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
            isUser ? "bg-primary" : "bg-green-600"
          )}
        >
          {isUser ? (
            <User className="h-3 w-3 text-primary-foreground" />
          ) : (
            <Bot className="h-3 w-3 text-white" />
          )}
        </div>
      )}

      {/* Message bubble - compact */}
      <div
        className={cn(
          "max-w-[85%] rounded-md px-2 py-1.5",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <div
          className={cn(
            "text-xs break-words",
            "prose prose-xs dark:prose-invert max-w-none",
            "prose-p:my-0.5 prose-p:leading-relaxed",
            "prose-ul:my-0.5 prose-ol:my-0.5 prose-li:my-0",
            "prose-headings:my-1 prose-headings:text-xs prose-headings:font-semibold",
            "prose-code:text-[11px] prose-code:bg-black/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none",
            "prose-pre:my-1 prose-pre:text-[11px]",
            "prose-a:underline",
            isUser
              ? "prose-p:text-primary-foreground prose-headings:text-primary-foreground prose-strong:text-primary-foreground prose-a:text-primary-foreground prose-code:text-primary-foreground"
              : "prose-p:text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary"
          )}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.text}
          </ReactMarkdown>
        </div>
        <p
          className={cn(
            "text-[10px] mt-0.5 opacity-70",
            isUser ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {formatMessageTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

interface FloatingChatPanelProps {
  maxMessages?: number;
}

export function FloatingChatPanel({ maxMessages = 50 }: FloatingChatPanelProps) {
  const { messages } = useVoiceAgent();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get last N messages
  const displayMessages = messages.slice(-maxMessages);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <ScrollArea className="flex-1 h-full" ref={scrollRef}>
      <div className="p-2">
        {displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <MessageSquare className="h-6 w-6 mb-1 opacity-50" />
            <p className="text-xs">No messages yet</p>
            <p className="text-[10px] mt-0.5 opacity-70">
              Speak or type to chat
            </p>
          </div>
        ) : (
          displayMessages.map((message, index) => {
            const showSender =
              index === 0 || displayMessages[index - 1].sender !== message.sender;
            return (
              <CompactMessage
                key={message.id}
                message={message}
                showSender={showSender}
              />
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}
