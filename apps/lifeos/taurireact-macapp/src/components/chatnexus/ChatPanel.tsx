import { useRef, useEffect } from "react";
import { useChatNexus, PanelConfig } from "../../lib/contexts/ChatNexusContext";
import { ModelSelector } from "./ModelSelector";
import { MessageList } from "./MessageList";
import { StreamingIndicator } from "./StreamingIndicator";
import { PanelActions } from "./PanelActions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface ChatPanelProps {
  panelConfig: PanelConfig;
}

export function ChatPanel({ panelConfig }: ChatPanelProps) {
  const { messages, streamState } = useChatNexus();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const panelStreamState = streamState[panelConfig.panelId];

  // Filter messages for this panel (user messages + this panel's assistant messages)
  const panelMessages = messages?.filter(
    (m) => m.role === "user" || m.panelId === panelConfig.panelId
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [panelMessages, panelStreamState?.partialContent]);

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      {/* Panel header with model selector */}
      <CardHeader className="flex flex-row items-center justify-between px-3 py-2 border-b border-border bg-muted/50 space-y-0">
        <ModelSelector panelId={panelConfig.panelId} />
        <PanelActions panelId={panelConfig.panelId} />
      </CardHeader>

      {/* Messages area */}
      <CardContent className="flex-1 overflow-y-auto p-3">
        {panelMessages && panelMessages.length > 0 ? (
          <MessageList messages={panelMessages} panelId={panelConfig.panelId} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            <div className="text-center">
              <p>No messages yet</p>
              <p className="text-xs mt-1">
                Send a message to start chatting with {panelConfig.modelDisplayName}
              </p>
            </div>
          </div>
        )}

        {/* Streaming indicator */}
        {panelStreamState &&
          (panelStreamState.status === "pending" ||
            panelStreamState.status === "streaming") && (
            <StreamingIndicator
              content={panelStreamState.partialContent}
              isLoading={panelStreamState.status === "pending"}
            />
          )}

        {/* Error display */}
        {panelStreamState?.status === "error" && panelStreamState.error && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{panelStreamState.error}</AlertDescription>
          </Alert>
        )}

        <div ref={messagesEndRef} />
      </CardContent>
    </Card>
  );
}
