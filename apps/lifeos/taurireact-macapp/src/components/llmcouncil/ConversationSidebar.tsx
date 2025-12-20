import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLLMCouncil } from "@/lib/contexts/LLMCouncilContext";
import { cn } from "@/lib/utils";
import {
  Plus,
  MessageSquare,
  MoreHorizontal,
  Archive,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Id } from "@holaai/convex";

export function ConversationSidebar() {
  const {
    conversations,
    currentConversationId,
    createConversation,
    loadConversation,
    archiveConversation,
    deleteConversation,
    updateConversationTitle,
    isDeliberating,
    sidebarCollapsed,
    toggleSidebar,
  } = useLLMCouncil();

  const [editingId, setEditingId] = useState<Id<"lifeos_llmcouncilConversations"> | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const handleNewConversation = async () => {
    await createConversation();
  };

  const handleStartEdit = (
    id: Id<"lifeos_llmcouncilConversations">,
    title: string
  ) => {
    setEditingId(id);
    setEditingTitle(title);
  };

  const handleSaveEdit = async () => {
    if (editingId && editingTitle.trim()) {
      await updateConversationTitle(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Today
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    // Yesterday
    if (diff < 48 * 60 * 60 * 1000) {
      return "Yesterday";
    }

    // This week
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString([], { weekday: "short" });
    }

    // Older
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Collapsed view - narrow icon-only sidebar
  if (sidebarCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <div className="w-12 border-r flex flex-col bg-muted/30 transition-all duration-300">
          {/* Header with expand button and new conversation button */}
          <div className="p-2 border-b flex flex-col items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={toggleSidebar}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleNewConversation}
                  disabled={isDeliberating}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">New Council</TooltipContent>
            </Tooltip>
          </div>

          {/* Conversations icon - expands sidebar when clicked */}
          <div className="p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 w-full hover:bg-accent/50"
                  onClick={toggleSidebar}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div className="font-medium">Conversations</div>
                {conversations && conversations.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // Expanded view - full sidebar
  return (
    <div className="w-64 border-r flex flex-col bg-muted/30 transition-all duration-300">
      {/* Header with collapse button and new conversation button */}
      <div className="p-3 border-b">
        <div className="flex items-center gap-2 mb-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleSidebar}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">Conversations</span>
        </div>
        <Button
          onClick={handleNewConversation}
          disabled={isDeliberating}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          New Council
        </Button>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations?.map((conversation) => (
            <div
              key={conversation._id}
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors",
                currentConversationId === conversation._id
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
              onClick={() => loadConversation(conversation._id)}
            >
              <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />

              {editingId === conversation._id ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                  className="flex-1 bg-transparent border-none outline-none text-sm"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="truncate">{conversation.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(conversation.updatedAt)}
                  </div>
                </div>
              )}

              {/* Actions dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(conversation._id, conversation.title);
                    }}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      archiveConversation(conversation._id);
                    }}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conversation._id);
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {conversations?.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No conversations yet
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
