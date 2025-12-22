import { marked } from 'marked';
import type { Stage3Result } from '../../store/councilStore';
import { LLM_CONFIG } from '../../config/llm';

interface Stage3Props {
  finalResponse: Stage3Result;
}

export function Stage3({ finalResponse }: Stage3Props) {
  if (!finalResponse) {
    return null;
  }

  const config = LLM_CONFIG[finalResponse.llmType];

  return (
    <div className="council-stage stage3">
      <h3 className="stage-title">Stage 3: Final Council Answer</h3>

      <div className="final-response">
        <div className="chairman-label">
          <span className="chairman-icon">{config.icon}</span>
          Chairman: {config.name}
        </div>
        <div
          className="markdown-content"
          dangerouslySetInnerHTML={{ __html: marked(finalResponse.response) }}
        />
      </div>
    </div>
  );
}
