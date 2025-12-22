import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { usePanelsStore } from '../store/panelsStore';
import { ChatPanel } from './ChatPanel/ChatPanel';

export function PanelsContainer() {
  const currentLayout = useAppStore((state) => state.currentLayout);
  const currentTier = useAppStore((state) => state.currentTier);
  const panels = usePanelsStore((state) => state.panels);
  const setPanelCount = usePanelsStore((state) => state.setPanelCount);

  useEffect(() => {
    setPanelCount(currentLayout, currentTier);
  }, [currentLayout, currentTier, setPanelCount]);

  return (
    <div className="panels-container" data-layout={currentLayout}>
      {panels.map((panel) => (
        <ChatPanel key={panel.id} panelId={panel.id} />
      ))}
    </div>
  );
}
