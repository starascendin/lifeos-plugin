import type { BeeperMessage } from "@/lib/services/beeper";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: BeeperMessage;
  isGroup: boolean;
}

export function MessageBubble({ message, isGroup }: MessageBubbleProps) {
  // Determine if this is a sent message (from "You" or "Me")
  const isSent =
    message.sender.toLowerCase() === "you" ||
    message.sender.toLowerCase() === "me";

  // Format timestamp
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  // Format date for date separators (if needed)
  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffDays = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) {
        return "Today";
      } else if (diffDays === 1) {
        return "Yesterday";
      } else if (diffDays < 7) {
        return date.toLocaleDateString("en-US", { weekday: "long" });
      } else {
        return date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year:
            date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        });
      }
    } catch {
      return timestamp;
    }
  };

  return (
    <div
      className={cn("flex", isSent ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2",
          isSent
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted rounded-bl-md"
        )}
      >
        {/* Sender name for group chats (only for received messages) */}
        {isGroup && !isSent && (
          <p className="text-xs font-medium mb-1 opacity-75">{message.sender}</p>
        )}

        {/* Message text */}
        <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>

        {/* Timestamp */}
        <p
          className={cn(
            "text-xs mt-1",
            isSent ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {formatTime(message.timestamp_readable)}
        </p>
      </div>
    </div>
  );
}
