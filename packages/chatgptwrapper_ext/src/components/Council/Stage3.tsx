import { useState } from 'react';
import { marked } from 'marked';
import type { Stage3Result } from '../../store/councilStore';
import { LLM_CONFIG } from '../../config/llm';

interface Stage3Props {
  responses: Stage3Result[];
}

export function Stage3({ responses }: Stage3Props) {
  const [activeTab, setActiveTab] = useState(0);

  // Handle both old single-object format and new array format (backward compatibility)
  const rawResponses = Array.isArray(responses) ? responses : (responses ? [responses] : []);
  const validResponses = rawResponses.filter(
    (r): r is Stage3Result => r != null && r.llmType != null
  );

  if (validResponses.length === 0) {
    return null;
  }

  // Clamp activeTab to valid range
  const safeActiveTab = Math.min(Math.max(0, activeTab), validResponses.length - 1);
  const activeResponse = validResponses[safeActiveTab];
  const config = LLM_CONFIG[activeResponse.llmType];

  return (
    <div className="council-stage stage3">
      <h3 className="stage-title">Stage 3: Final Council Answers</h3>

      <div className="stage-tabs">
        {validResponses.map((resp, index) => {
          const tabConfig = LLM_CONFIG[resp.llmType];
          return (
            <button
              key={resp.llmType}
              className={`stage-tab ${safeActiveTab === index ? 'active' : ''}`}
              style={{ '--tab-color': tabConfig.color } as React.CSSProperties}
              onClick={() => setActiveTab(index)}
            >
              <span className="tab-icon">{tabConfig.icon}</span>
              {tabConfig.name}
            </button>
          );
        })}
      </div>

      <div className="stage-content" style={{ borderTopColor: config.color }}>
        <div className="chairman-label">
          <span className="chairman-icon">{config.icon}</span>
          Chairman: {config.name}
        </div>
        <div
          className="markdown-content"
          dangerouslySetInnerHTML={{ __html: marked(activeResponse.response) }}
        />
      </div>
    </div>
  );
}
