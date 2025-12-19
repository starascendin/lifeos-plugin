import { useState } from "react";
import { useChatNexus } from "../../lib/contexts/ChatNexusContext";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Copy, Check, X } from "lucide-react";

interface PanelActionsProps {
  panelId: string;
}

export function PanelActions({ panelId }: PanelActionsProps) {
  const { messages, panelConfigs, removePanel, streamState } = useChatNexus();
  const [copied, setCopied] = useState(false);

  const config = panelConfigs.find((p) => p.panelId === panelId);
  const canRemovePanel = panelConfigs.length > 1;
  const panelStream = streamState[panelId];
  const isStreaming = panelStream?.status === "pending" || panelStream?.status === "streaming";

  // Get all assistant messages for this panel
  const panelMessages = messages?.filter(
    (m) => m.role === "assistant" && m.panelId === panelId && m.isComplete
  );

  const handleCopyLast = async () => {
    const lastMessage = panelMessages?.[panelMessages.length - 1];
    if (!lastMessage) return;

    try {
      await navigator.clipboard.writeText(lastMessage.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Copy last response */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopyLast}
            disabled={!panelMessages?.length}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy last response</TooltipContent>
      </Tooltip>

      {/* Remove panel */}
      {canRemovePanel && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => removePanel(panelId)}
              disabled={isStreaming}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove panel</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
