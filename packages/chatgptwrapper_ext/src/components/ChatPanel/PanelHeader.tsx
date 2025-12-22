import { LLM_CONFIG, getModelsForProvider, LLM_PROVIDERS } from '../../config/llm';
import { useAppStore } from '../../store/appStore';
import { usePanelsStore } from '../../store/panelsStore';
import type { LLMType } from '../../config/llm';

interface PanelHeaderProps {
  panelId: number;
  llmType: LLMType;
  model: string;
}

export function PanelHeader({ panelId, llmType, model }: PanelHeaderProps) {
  const currentTier = useAppStore((state) => state.currentTier);
  const setLLMType = usePanelsStore((state) => state.setLLMType);
  const updatePanel = usePanelsStore((state) => state.updatePanel);
  const clearPanel = usePanelsStore((state) => state.clearPanel);

  const config = LLM_CONFIG[llmType];
  const models = getModelsForProvider(llmType);

  const handleLLMChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLLMType(panelId, e.target.value as LLMType, currentTier);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    updatePanel(panelId, {
      model: newModel,
      conversationId: llmType === 'claude' ? null : undefined
    });
  };

  return (
    <div className="panel-header">
      <div className="panel-icon">{config.icon}</div>
      <select className="llm-selector" value={llmType} onChange={handleLLMChange}>
        {LLM_PROVIDERS.map((provider) => (
          <option key={provider} value={provider}>
            {LLM_CONFIG[provider].name}
          </option>
        ))}
      </select>
      <select className="model-selector" value={model} onChange={handleModelChange}>
        {models.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <div className="panel-actions">
        <button
          className="panel-btn clear-btn"
          title="Clear conversation"
          onClick={() => clearPanel(panelId)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
