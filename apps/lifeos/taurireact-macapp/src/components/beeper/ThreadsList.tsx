import { useBeeper } from "@/lib/contexts/BeeperContext";
import type { BeeperThread, BeeperMessage } from "@/lib/services/beeper";
import { Users, User, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThreadsListProps {
  threads: BeeperThread[];
  searchResults: BeeperMessage[];
  isLoading: boolean;
  isSearchMode: boolean;
}

export function ThreadsList({
  threads,
  searchResults,
  isLoading,
  isSearchMode,
}: ThreadsListProps) {
  const { selectedThread, selectThread } = useBeeper();

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffDays = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) {
        return date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
      } else if (diffDays === 1) {
        return "Yesterday";
      } else if (diffDays < 7) {
        return date.toLocaleDateString("en-US", { weekday: "short" });
      } else {
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }
    } catch {
      return timestamp;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {isSearchMode ? "Searching..." : "Loading threads..."}
          </p>
        </div>
      </div>
    );
  }

  // Search results mode
  if (isSearchMode) {
    if (searchResults.length === 0) {
      return (
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No messages found</p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full overflow-y-auto">
        <div className="p-3 border-b sticky top-0 bg-background">
          <p className="text-sm text-muted-foreground">
            {searchResults.length} message{searchResults.length !== 1 ? "s" : ""}{" "}
            found
          </p>
        </div>
        <div className="divide-y">
          {searchResults.map((message, index) => (
            <div
              key={`${message.thread_name}-${message.timestamp_readable}-${index}`}
              className="p-3 hover:bg-muted/50 cursor-pointer"
              onClick={() => {
                // Find and select the thread using thread_id for unique identification
                if (message.thread_id) {
                  const thread: BeeperThread = {
                    thread_id: message.thread_id,
                    name: message.thread_name || "Unknown",
                    thread_type: "dm",
                    participant_count: 2,
                    message_count: 0,
                    last_message_at: message.timestamp_readable,
                  };
                  selectThread(thread);
                }
              }}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">
                      {message.thread_name || "Unknown"}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatTimestamp(message.timestamp_readable)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {message.sender}:
                  </p>
                  <p className="text-sm line-clamp-2">{message.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (threads.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center">
          <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No threads found</p>
        </div>
      </div>
    );
  }

  // Threads list
  return (
    <div className="h-full overflow-y-auto">
      <div className="divide-y">
        {threads.map((thread) => (
          <div
            key={thread.name}
            className={cn(
              "p-3 hover:bg-muted/50 cursor-pointer transition-colors",
              selectedThread?.name === thread.name && "bg-muted"
            )}
            onClick={() => selectThread(thread)}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                  thread.thread_type === "group"
                    ? "bg-green-500/10 text-green-500"
                    : "bg-blue-500/10 text-blue-500"
                )}
              >
                {thread.thread_type === "group" ? (
                  <Users className="w-5 h-5" />
                ) : (
                  <User className="w-5 h-5" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">
                    {thread.name}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatTimestamp(thread.last_message_at)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {thread.message_count.toLocaleString()} messages
                  {thread.thread_type === "group" &&
                    ` · ${thread.participant_count} members`}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
