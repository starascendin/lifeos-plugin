import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";

interface PromptInputProps {
  onSubmit: (prompt: string) => Promise<unknown>;
  isExecuting: boolean;
  disabled?: boolean;
}

export function PromptInput({
  onSubmit,
  isExecuting,
  disabled,
}: PromptInputProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = async () => {
    if (!prompt.trim() || isExecuting || disabled) return;
    await onSubmit(prompt.trim());
    setPrompt("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Cmd/Ctrl + Enter
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t p-4 flex-shrink-0">
      <div className="flex gap-2">
        <Textarea
          placeholder="Enter your prompt... (Cmd+Enter to submit)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[60px] max-h-[200px] resize-y"
          disabled={disabled || isExecuting}
        />
        <Button
          onClick={handleSubmit}
          disabled={!prompt.trim() || isExecuting || disabled}
          className="self-end"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Running
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Execute
            </>
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Press Cmd+Enter (or Ctrl+Enter) to submit
      </p>
    </div>
  );
}
