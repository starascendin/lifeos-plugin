import { useEffect, useRef } from 'react';
import { Message } from './Message';
import type { Message as MessageType } from '../../store/panelsStore';
import type { LLMType } from '../../config/llm';

interface MessageListProps {
  messages: MessageType[];
  llmType: LLMType;
}

export function MessageList({ messages, llmType }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="panel-messages" ref={containerRef}>
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <div className="empty-state-text">Send a message to start chatting</div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-messages" ref={containerRef}>
      {messages.map((msg, idx) => (
        <Message key={idx} role={msg.role} content={msg.content} llmType={llmType} />
      ))}
    </div>
  );
}
