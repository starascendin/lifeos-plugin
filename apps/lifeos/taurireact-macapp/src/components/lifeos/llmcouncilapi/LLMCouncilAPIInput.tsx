import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { useLLMCouncilAPI } from "@/lib/contexts/LLMCouncilAPIContext";

export function LLMCouncilAPIInput() {
  const {
    viewMode,
    isConfigured,
    isHealthy,
    isCouncilLoading,
    selectedLLMs,
    sendCouncilQuery,
    sendChatMessage,
    panels,
  } = useLLMCouncilAPI();

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if any panel is loading (for multi-chat)
  const isAnyPanelLoading = panels.some((p) => p.isLoading);

  // Determine if we can send
  const isLoading = viewMode === "council" ? isCouncilLoading : isAnyPanelLoading;
  const canSend =
    input.trim().length > 0 &&
    isConfigured &&
    isHealthy &&
    !isLoading &&
    (viewMode === "council" ? selectedLLMs.length >= 2 : true);

  // Placeholder text
  const placeholder =
    viewMode === "council"
      ? "Ask the council a question..."
      : "Type a message to send to all panels...";

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [input]);

  // Handle submit
  const handleSubmit = async () => {
    if (!canSend) return;

    const message = input.trim();
    setInput("");

    if (viewMode === "council") {
      await sendCouncilQuery(message);
    } else {
      await sendChatMessage(message);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t bg-background p-4">
      <div className="mx-auto flex max-w-4xl items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={!isConfigured || !isHealthy || isLoading}
          className="min-h-[44px] max-h-[150px] resize-none"
          rows={1}
        />
        <Button
          onClick={handleSubmit}
          disabled={!canSend}
          size="icon"
          className="h-11 w-11 shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Status messages */}
      {!isConfigured && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Configure your Proxy Council settings to get started.
        </p>
      )}
      {isConfigured && !isHealthy && (
        <p className="mt-2 text-center text-xs text-destructive">
          Not connected to council server. Check your settings.
        </p>
      )}
      {viewMode === "council" && selectedLLMs.length < 2 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Select at least 2 models to use the council.
        </p>
      )}
    </div>
  );
}
