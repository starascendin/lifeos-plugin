import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLLMCouncil } from "@/lib/contexts/LLMCouncilContext";
import { Send, Loader2 } from "lucide-react";

export function CouncilInput() {
  const { sendQuery, isDeliberating, councilModels } = useLLMCouncil();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = async () => {
    if (!input.trim() || isDeliberating) return;

    const query = input.trim();
    setInput("");
    await sendQuery(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t p-4">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isDeliberating
                ? "Council is deliberating..."
                : `Ask the council (${councilModels.length} models)...`
            }
            disabled={isDeliberating}
            className="resize-none min-h-[44px] max-h-[200px] pr-12"
            rows={1}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isDeliberating}
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8"
          >
            {isDeliberating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Hint text */}
      <div className="text-xs text-muted-foreground text-center mt-2">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}
