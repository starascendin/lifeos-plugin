import { useState, useRef, useEffect } from "react";
import { useChatNexus } from "../../lib/contexts/ChatNexusContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";

export function ChatInput() {
  const [message, setMessage] = useState("");
  const { sendMessage, isAnyPanelStreaming, panelConfigs } = useChatNexus();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activePanels = panelConfigs.filter((p) => p.isActive);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isAnyPanelStreaming) return;

    const content = message.trim();
    setMessage("");
    await sendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-border p-3 bg-background"
    >
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activePanels.length > 1
                ? `Message ${activePanels.length} models...`
                : "Type your message..."
            }
            disabled={isAnyPanelStreaming}
            rows={1}
            className="min-h-[40px] resize-none"
          />
        </div>

        <Button
          type="submit"
          size="icon"
          disabled={!message.trim() || isAnyPanelStreaming}
        >
          {isAnyPanelStreaming ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Active models indicator */}
      {activePanels.length > 1 && (
        <div className="mt-2 text-xs text-muted-foreground text-center">
          Sending to:{" "}
          {activePanels.map((p) => p.modelDisplayName).join(", ")}
        </div>
      )}
    </form>
  );
}
