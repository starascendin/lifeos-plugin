import { ChatNexusProvider } from "../../lib/contexts/ChatNexusContext";
import { ChatNexusHeader } from "./ChatNexusHeader";
import { ChatNexusPanels } from "./ChatNexusPanels";
import { ChatInput } from "./ChatInput";
import { ConversationSidebar } from "./ConversationSidebar";

export function ChatNexusTab() {
  return (
    <ChatNexusProvider>
      <div className="flex h-full">
        {/* Conversation sidebar */}
        <ConversationSidebar />

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header with layout selector */}
          <ChatNexusHeader />

          {/* Panel area */}
          <div className="flex-1 overflow-hidden">
            <ChatNexusPanels />
          </div>

          {/* Unified input bar */}
          <ChatInput />
        </div>
      </div>
    </ChatNexusProvider>
  );
}
