import { useState } from 'react';
import { usePanelsStore } from '../../store/panelsStore';
import { PanelHeader } from './PanelHeader';
import { MessageList } from './MessageList';
import { PanelInputBar } from './PanelInputBar';
import { PanelInputToggle } from './PanelInputToggle';

interface ChatPanelProps {
  panelId: number;
}

export function ChatPanel({ panelId }: ChatPanelProps) {
  const [isInputOpen, setIsInputOpen] = useState(false);
  const panel = usePanelsStore((state) => state.panels.find((p) => p.id === panelId));

  if (!panel) return null;

  return (
    <div className={`panel ${panel.llmType}`} id={`panel-${panelId}`}>
      <PanelHeader panelId={panelId} llmType={panel.llmType} model={panel.model} />
      <MessageList messages={panel.messages} llmType={panel.llmType} />
      {(panel.status || panel.error) && (
        <div className={`panel-status ${panel.error ? 'error' : 'loading'}`}>
          {panel.error || panel.status}
        </div>
      )}
      <div className="panel-footer">
        <PanelInputToggle
          isOpen={isInputOpen}
          onToggle={() => setIsInputOpen(!isInputOpen)}
        />
        {isInputOpen && (
          <PanelInputBar panelId={panelId} llmType={panel.llmType} />
        )}
      </div>
    </div>
  );
}
