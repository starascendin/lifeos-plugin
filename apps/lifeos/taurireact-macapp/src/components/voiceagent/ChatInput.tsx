import { useState, useCallback, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useVoiceAgent } from "@/lib/contexts/VoiceAgentContext";
import { Send, Loader2 } from "lucide-react";

interface ChatInputProps {
  compact?: boolean;
}

export function ChatInput({ compact }: ChatInputProps) {
  const { sendMessage, connectionState } = useVoiceAgent();
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const isDisabled = connectionState !== "connected" || isSending;

  const handleSend = useCallback(async () => {
    if (!text.trim() || isDisabled) return;

    setIsSending(true);
    try {
      await sendMessage(text);
      setText("");
    } finally {
      setIsSending(false);
    }
  }, [text, isDisabled, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className={compact ? "flex gap-1.5 p-2 border-t" : "flex gap-2 p-4 border-t"}>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          connectionState === "connected"
            ? "Type a message..."
            : "Connect to send messages"
        }
        disabled={isDisabled}
        className={compact ? "flex-1 h-8 text-xs" : "flex-1"}
      />
      <Button
        onClick={handleSend}
        disabled={isDisabled || !text.trim()}
        size="icon"
        className={compact ? "h-8 w-8" : undefined}
      >
        {isSending ? (
          <Loader2 className={compact ? "h-3.5 w-3.5 animate-spin" : "h-4 w-4 animate-spin"} />
        ) : (
          <Send className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        )}
      </Button>
    </div>
  );
}
