import type { Doc } from "@holaai/convex";
import { MessageBubble } from "./MessageBubble";

type Message = Doc<"lifeos_chatnexusMessages">;

interface MessageListProps {
  messages: Message[];
  panelId: string;
}

export function MessageList({ messages, panelId }: MessageListProps) {
  // Group messages by broadcastId to show user message once followed by assistant response
  const groupedMessages: { userMessage: Message; assistantMessage?: Message }[] = [];
  const processedBroadcastIds = new Set<string>();

  for (const message of messages) {
    if (message.role === "user" && message.broadcastId) {
      if (!processedBroadcastIds.has(message.broadcastId)) {
        processedBroadcastIds.add(message.broadcastId);

        // Find the assistant response for this panel and broadcastId
        const assistantMessage = messages.find(
          (m) =>
            m.role === "assistant" &&
            m.broadcastId === message.broadcastId &&
            m.panelId === panelId
        );

        groupedMessages.push({
          userMessage: message,
          assistantMessage,
        });
      }
    }
  }

  return (
    <div className="space-y-4">
      {groupedMessages.map(({ userMessage, assistantMessage }) => (
        <div key={userMessage._id} className="space-y-3">
          <MessageBubble message={userMessage} />
          {assistantMessage && <MessageBubble message={assistantMessage} />}
        </div>
      ))}
    </div>
  );
}
