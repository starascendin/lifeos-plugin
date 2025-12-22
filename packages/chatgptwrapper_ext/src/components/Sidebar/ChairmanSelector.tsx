import { useCouncilStore } from '../../store/councilStore';
import { LLM_CONFIG, LLM_PROVIDERS } from '../../config/llm';

export function ChairmanSelector() {
  const chairman = useCouncilStore((state) => state.chairman);
  const setChairman = useCouncilStore((state) => state.setChairman);

  return (
    <div className="sidebar-section chairman-selector">
      <div className="sidebar-title">Chairman</div>
      <div className="chairman-options">
        {LLM_PROVIDERS.map((llmType) => {
          const config = LLM_CONFIG[llmType];
          const isActive = chairman === llmType;

          return (
            <button
              key={llmType}
              className={`chairman-option ${isActive ? 'active' : ''}`}
              style={{
                '--chairman-color': config.color
              } as React.CSSProperties}
              onClick={() => setChairman(llmType)}
              title={`Set ${config.name} as chairman`}
            >
              <span className="chairman-icon">{config.icon}</span>
              <span className="chairman-name">{config.name}</span>
            </button>
          );
        })}
      </div>
      <p className="chairman-hint">
        The chairman synthesizes the final answer in Stage 3.
      </p>
    </div>
  );
}
