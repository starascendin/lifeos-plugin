import { useState, useRef, useCallback } from 'react';
import { usePanelsStore } from '../store/panelsStore';
import { useChat } from '../hooks/useChat';

export function InputBar() {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panels = usePanelsStore((state) => state.panels);

  // Create hooks for all panels
  const panel0 = useChat(0);
  const panel1 = useChat(1);
  const panel2 = useChat(2);
  const panel3 = useChat(3);

  const panelHooks = [panel0, panel1, panel2, panel3];

  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }
  }, []);

  const sendToAll = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const promises = panels.map((_, idx) => {
      const hook = panelHooks[idx];
      return hook?.sendMessage(text);
    });

    await Promise.allSettled(promises);
    setIsSending(false);
    textareaRef.current?.focus();
  }, [input, isSending, panels, panelHooks]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendToAll();
    }
  };

  return (
    <div className="input-bar">
      <textarea
        ref={textareaRef}
        id="global-input"
        placeholder="Type a message to send to all panels..."
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          autoResize();
        }}
        onKeyDown={handleKeyDown}
        disabled={isSending}
      />
      <button
        id="global-send"
        onClick={sendToAll}
        disabled={isSending || !input.trim()}
      >
        Send
      </button>
    </div>
  );
}
