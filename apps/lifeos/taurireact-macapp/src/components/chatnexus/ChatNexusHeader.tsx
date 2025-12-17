import { useChatNexus } from "../../lib/contexts/ChatNexusContext";
import { LayoutSelector } from "./LayoutSelector";
import { TierSelector } from "./TierSelector";

export function ChatNexusHeader() {
  const { currentConversationId, conversations } = useChatNexus();

  const currentConversation = conversations?.find(
    (c) => c._id === currentConversationId
  );

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-foreground">
          {currentConversation?.title || "Chat Nexus"}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <TierSelector />
        <LayoutSelector />
      </div>
    </div>
  );
}
