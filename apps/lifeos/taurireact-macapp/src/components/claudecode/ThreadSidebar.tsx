import { useClaudeCode } from "@/lib/contexts/ClaudeCodeContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MessageSquare,
  MoreVertical,
  Trash2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ThreadSidebar() {
  const {
    environment,
    activeThreadId,
    threads,
    isLoadingThreads,
    containerStatus,
    createThread,
    switchThread,
    deleteThread,
    refreshThreads,
  } = useClaudeCode();

  // Filter threads for current environment
  const envThreads = threads
    .filter((t) => t.environment === environment)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const handleCreateThread = async () => {
    await createThread();
  };

  const handleDeleteThread = async (
    e: React.MouseEvent,
    threadId: string
  ) => {
    e.stopPropagation();
    await deleteThread(threadId);
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    const days = diff / (1000 * 60 * 60 * 24);

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 1 ? "Just now" : `${minutes}m ago`;
    } else if (hours < 24) {
      return `${Math.floor(hours)}h ago`;
    } else if (days < 7) {
      return `${Math.floor(days)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="w-64 border-r flex flex-col bg-muted/30">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <h2 className="text-sm font-medium">Conversations</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={refreshThreads}
            disabled={!containerStatus?.running || isLoadingThreads}
            title="Refresh threads"
          >
            <RefreshCw
              className={cn("h-4 w-4", isLoadingThreads && "animate-spin")}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCreateThread}
            disabled={!containerStatus?.running}
            title="New conversation"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Thread list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoadingThreads && envThreads.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : envThreads.length === 0 ? (
            <div className="text-center py-8 px-4">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Start a new conversation to begin
              </p>
            </div>
          ) : (
            envThreads.map((thread) => (
              <div
                key={thread.id}
                className={cn(
                  "group flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors",
                  activeThreadId === thread.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                )}
                onClick={() => switchThread(thread.id)}
              >
                <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{thread.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatTimestamp(thread.updatedAt)}</span>
                    {thread.messageCount > 0 && (
                      <>
                        <span>·</span>
                        <span>{thread.messageCount} messages</span>
                      </>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => handleDeleteThread(e, thread.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer info */}
      {!containerStatus?.running && (
        <div className="p-3 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Start container to manage conversations
          </p>
        </div>
      )}
    </div>
  );
}
