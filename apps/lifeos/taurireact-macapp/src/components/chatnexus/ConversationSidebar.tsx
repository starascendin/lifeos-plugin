import { useState } from "react";
import { useChatNexus } from "../../lib/contexts/ChatNexusContext";
import { useChatNexusSettings } from "../../lib/hooks/useChatNexusSettings";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, MessageSquare, Trash2, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { ModelSettingsView } from "./ModelSettingsView";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ConversationSidebar() {
  const {
    conversations,
    currentConversationId,
    loadConversation,
    createConversation,
    archiveConversation,
  } = useChatNexus();

  const { sidebarCollapsed, setSidebarCollapsed } = useChatNexusSettings();
  const [showSettings, setShowSettings] = useState(false);

  const handleNewChat = async () => {
    await createConversation();
  };

  // Collapsed state: narrow bar with icon buttons
  if (sidebarCollapsed) {
    return (
      <div className="w-12 border-r border-border flex flex-col items-center py-2 gap-2 bg-muted/50">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(false)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Expand sidebar</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleNewChat}>
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">New chat</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSidebarCollapsed(false);
                setShowSettings(true);
              }}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Model settings</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // Show settings view
  if (showSettings) {
    return (
      <div className="w-56 border-r border-border flex flex-col bg-muted/50">
        <ModelSettingsView onClose={() => setShowSettings(false)} />
      </div>
    );
  }

  // Normal expanded sidebar
  return (
    <div className="w-56 border-r border-border flex flex-col bg-muted/50">
      {/* Header with collapse + settings buttons */}
      <div className="flex items-center justify-between p-2 border-b border-border">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSidebarCollapsed(true)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Collapse sidebar</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Model settings</TooltipContent>
        </Tooltip>
      </div>

      {/* New chat button */}
      <div className="p-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleNewChat}
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {conversations?.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
            No conversations yet
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations?.map((conversation) => (
              <ConversationItem
                key={conversation._id}
                conversation={conversation}
                isActive={conversation._id === currentConversationId}
                onSelect={() => loadConversation(conversation._id)}
                onArchive={() => archiveConversation(conversation._id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  conversation: {
    _id: string;
    title: string;
    updatedAt: number;
  };
  isActive: boolean;
  onSelect: () => void;
  onArchive: () => void;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onArchive,
}: ConversationItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-foreground hover:bg-accent"
      )}
      onClick={onSelect}
    >
      <MessageSquare className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1 text-sm truncate">{conversation.title}</span>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
          "hover:bg-muted"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onArchive();
        }}
        title="Archive conversation"
      >
        <Trash2 className="h-3 w-3 text-muted-foreground" />
      </Button>
    </div>
  );
}
