import { ChatMessage as ChatMessageType } from "@/lib/services/livekit";
import { formatMessageTime } from "@/lib/services/livekit";
import { cn } from "@/lib/utils";
import { User, Bot } from "lucide-react";

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
        <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
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
