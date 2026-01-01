import { useState, useCallback, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AIAgentInputProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function AIAgentInput({
  onSend,
  disabled = false,
  placeholder = "Type a message... (Enter to send, Shift+Enter for new line)",
}: AIAgentInputProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = useCallback(async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending || disabled) return;

    setIsSending(true);
    setMessage("");

    try {
      await onSend(trimmedMessage);
    } finally {
      setIsSending(false);
    }
  }, [message, isSending, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex gap-2 items-end">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isSending}
        className="min-h-[60px] max-h-[200px] resize-none"
        rows={2}
      />
      <Button
        onClick={handleSend}
        disabled={!message.trim() || disabled || isSending}
        size="icon"
        className="h-[60px] w-[60px] shrink-0"
      >
        <Send className="h-5 w-5" />
      </Button>
    </div>
  );
}
