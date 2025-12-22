import { useState, useCallback, type KeyboardEvent, type FormEvent } from 'react';

interface CouncilInputBarProps {
  onSubmit: (query: string) => void;
  disabled?: boolean;
}

export function CouncilInputBar({ onSubmit, disabled }: CouncilInputBarProps) {
  const [input, setInput] = useState('');

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (input.trim() && !disabled) {
        onSubmit(input.trim());
        setInput('');
      }
    },
    [input, disabled, onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as FormEvent);
      }
    },
    [handleSubmit]
  );

  return (
    <form className="council-input-bar" onSubmit={handleSubmit}>
      <textarea
        className="council-input"
        placeholder="Ask the council a question... (Shift+Enter for new line)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={3}
      />
      <button
        type="submit"
        className="council-send-button"
        disabled={!input.trim() || disabled}
      >
        {disabled ? 'Consulting...' : 'Ask Council'}
      </button>
    </form>
  );
}
