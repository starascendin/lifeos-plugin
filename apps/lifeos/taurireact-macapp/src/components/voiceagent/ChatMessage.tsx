import { ChatMessage as ChatMessageType } from "@/lib/services/livekit";
import { formatMessageTime } from "@/lib/services/livekit";
import { cn } from "@/lib/utils";
import { User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
  message: ChatMessageType;
  showSender?: boolean;
}

export function ChatMessage({ message, showSender = true }: ChatMessageProps) {
  const isUser = message.sender === "user";

  return (
    <div
      className={cn(
        "flex gap-2 mb-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      {showSender && (
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            isUser ? "bg-primary" : "bg-green-600"
          )}
        >
          {isUser ? (
            <User className="h-4 w-4 text-primary-foreground" />
          ) : (
            <Bot className="h-4 w-4 text-white" />
          )}
        </div>
      )}

      {/* Message bubble */}
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <div
          className={cn(
            "text-sm break-words",
            "prose prose-sm dark:prose-invert max-w-none",
            "prose-p:my-1 prose-p:leading-relaxed",
            "prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
            "prose-headings:my-1.5 prose-headings:text-sm prose-headings:font-semibold",
            "prose-code:text-xs prose-code:bg-black/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none",
            "prose-pre:my-1 prose-pre:text-xs",
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
            "text-xs mt-1",
            isUser ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {formatMessageTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
