import { useEffect, useRef } from "react";
import { useBeeper } from "@/lib/contexts/BeeperContext";
import { MessageBubble } from "./MessageBubble";
import { Users, User, MessageSquare } from "lucide-react";

export function ConversationView() {
  const { selectedThread, conversation, isLoadingConversation } = useBeeper();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when conversation loads
  useEffect(() => {
    if (scrollRef.current && conversation.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation]);

  // No thread selected
  if (!selectedThread) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Select a conversation to view messages</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoadingConversation) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b p-4 flex items-center gap-3 flex-shrink-0">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              selectedThread.thread_type === "group"
                ? "bg-green-500/10 text-green-500"
                : "bg-blue-500/10 text-blue-500"
            }`}
          >
            {selectedThread.thread_type === "group" ? (
              <Users className="w-5 h-5" />
            ) : (
              <User className="w-5 h-5" />
            )}
          </div>
          <div>
            <h2 className="font-semibold">{selectedThread.name}</h2>
            <p className="text-sm text-muted-foreground">
              {selectedThread.thread_type === "group"
                ? `${selectedThread.participant_count} members`
                : "Direct message"}
            </p>
          </div>
        </div>

        {/* Loading */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="spinner mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading messages...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center gap-3 flex-shrink-0">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            selectedThread.thread_type === "group"
              ? "bg-green-500/10 text-green-500"
              : "bg-blue-500/10 text-blue-500"
          }`}
        >
          {selectedThread.thread_type === "group" ? (
            <Users className="w-5 h-5" />
          ) : (
            <User className="w-5 h-5" />
          )}
        </div>
        <div>
          <h2 className="font-semibold">{selectedThread.name}</h2>
          <p className="text-sm text-muted-foreground">
            {selectedThread.thread_type === "group"
              ? `${selectedThread.participant_count} members · ${conversation.length} messages`
              : `${conversation.length} messages`}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {conversation.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-muted-foreground">No messages in this thread</p>
          </div>
        ) : (
          <div className="space-y-3">
            {conversation.map((message, index) => (
              <MessageBubble
                key={`${message.sender}-${message.timestamp_readable}-${index}`}
                message={message}
                isGroup={selectedThread.thread_type === "group"}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
