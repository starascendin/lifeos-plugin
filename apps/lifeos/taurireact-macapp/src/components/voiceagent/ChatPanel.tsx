import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useVoiceAgent } from "@/lib/contexts/VoiceAgentContext";
import { ChatMessage } from "./ChatMessage";
import { MessageSquare } from "lucide-react";

export function ChatPanel() {
  const { messages } = useVoiceAgent();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <ScrollArea className="flex-1 h-full" ref={scrollRef}>
      <div className="p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">
              Connect and start speaking to chat with the agent
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            // Show sender if first message or different sender from previous
            const showSender =
              index === 0 || messages[index - 1].sender !== message.sender;
            return (
              <ChatMessage
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
