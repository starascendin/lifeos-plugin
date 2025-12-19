import type { Doc } from "@holaai/convex";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = Doc<"lifeos_chatnexusMessages">;

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-2",
          isUser
            ? "bg-secondary text-secondary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {/* Message content */}
        {isUser ? (
          <div className="whitespace-pre-wrap break-words text-sm">
            {message.content}
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Error indicator */}
        {message.error && (
          <div className="mt-2 text-xs text-destructive">{message.error}</div>
        )}

        {/* Timestamp */}
        <div
          className={cn(
            "text-xs mt-1",
            isUser ? "text-secondary-foreground/60" : "text-muted-foreground"
          )}
        >
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
