import { useState } from 'react';
import { marked } from 'marked';
import type { Stage1Result } from '../../store/councilStore';
import { LLM_CONFIG } from '../../config/llm';

interface Stage1Props {
  responses: Stage1Result[];
}

export function Stage1({ responses }: Stage1Props) {
  const [activeTab, setActiveTab] = useState(0);

  if (!responses || responses.length === 0) {
    return null;
  }

  const activeResponse = responses[activeTab];
  const config = LLM_CONFIG[activeResponse.llmType];

  return (
    <div className="council-stage stage1">
      <h3 className="stage-title">Stage 1: Individual Responses</h3>

      <div className="stage-tabs">
        {responses.map((resp, index) => {
          const tabConfig = LLM_CONFIG[resp.llmType];
          return (
            <button
              key={index}
              className={`stage-tab ${activeTab === index ? 'active' : ''}`}
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
        <div className="model-badge" style={{ backgroundColor: config.color }}>
          {config.name}
        </div>
        <div
          className="markdown-content"
          dangerouslySetInnerHTML={{ __html: marked(activeResponse.response) }}
        />
      </div>
    </div>
  );
}
