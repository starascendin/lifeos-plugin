import { useState, useRef, useCallback } from 'react';
import { useChat } from '../../hooks/useChat';
import type { LLMType } from '../../config/llm';

interface PanelInputBarProps {
  panelId: number;
  llmType: LLMType;
}

export function PanelInputBar({ panelId, llmType }: PanelInputBarProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, panel } = useChat(panelId);

  const isLoading = panel?.isLoading ?? false;

  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
    }
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage(text);
    textareaRef.current?.focus();
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="panel-input-bar">
      <textarea
        ref={textareaRef}
        className="panel-input-textarea"
        placeholder={`Message ${llmType}...`}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          autoResize();
        }}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        rows={1}
      />
      <button
        className="panel-input-send"
        onClick={handleSend}
        disabled={isLoading || !input.trim()}
        title="Send message"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      </button>
    </div>
  );
}
