import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useCatGirl } from "@/lib/contexts/CatGirlContext";
import { cn } from "@/lib/utils";

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function CatGirlThreadList() {
  const {
    threads,
    threadId: currentThreadId,
    isThreadListOpen,
    isLoading,
    setThreadListOpen,
    loadThread,
    deleteThread,
    createThread,
  } = useCatGirl();

  return (
    <Sheet open={isThreadListOpen} onOpenChange={setThreadListOpen}>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="p-4 pb-2 border-b">
          <SheetTitle className="text-base">Conversations</SheetTitle>
          <SheetDescription className="sr-only">Your chat history</SheetDescription>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={async () => {
              await createThread();
              setThreadListOpen(false);
            }}
            disabled={isLoading}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(100vh-120px)]">
          <div className="p-2">
            {threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              threads.map((thread) => (
                <div
                  key={thread._id}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer hover:bg-muted transition-colors",
                    thread._id === currentThreadId && "bg-muted"
                  )}
                  onClick={() => loadThread(thread._id)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {thread.title || "New Chat"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeDate(thread._creationTime)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await deleteThread(thread._id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
