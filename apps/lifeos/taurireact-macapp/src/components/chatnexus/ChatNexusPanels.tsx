import { useChatNexus } from "../../lib/contexts/ChatNexusContext";
import { ChatPanel } from "./ChatPanel";

// Get grid class based on actual panel count
function getGridClass(panelCount: number): string {
  switch (panelCount) {
    case 1:
      return "grid grid-cols-1";
    case 2:
      return "grid grid-cols-2";
    case 3:
      return "grid grid-cols-3";
    case 4:
      return "grid grid-cols-2 grid-rows-2";
    default:
      // Fallback for any other count
      return panelCount <= 2 ? "grid grid-cols-2" : "grid grid-cols-3";
  }
}

export function ChatNexusPanels() {
  const { panelConfigs } = useChatNexus();

  const gridClass = getGridClass(panelConfigs.length);

  return (
    <div className={`h-full p-2 gap-2 ${gridClass}`}>
      {panelConfigs.map((config) => (
        <ChatPanel key={config.panelId} panelConfig={config} />
      ))}
    </div>
  );
}
