import { renderMarkdown } from '../../utils/markdown';
import { LLM_CONFIG } from '../../config/llm';
import type { LLMType } from '../../config/llm';

interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  llmType: LLMType;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function Message({ role, content, llmType }: MessageProps) {
  const llmName = LLM_CONFIG[llmType].name;

  return (
    <div className={`message ${role}`}>
      <div className="message-role">{role === 'user' ? 'You' : llmName}</div>
      <div
        className="message-content"
        dangerouslySetInnerHTML={{
          __html: role === 'user' ? escapeHtml(content) : renderMarkdown(content)
        }}
      />
    </div>
  );
}
