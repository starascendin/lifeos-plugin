import { useChatNexus } from "../../lib/contexts/ChatNexusContext";
import { ChatPanel } from "./ChatPanel";
import { LAYOUT_CONFIGS } from "../../lib/constants/models";

export function ChatNexusPanels() {
  const { layoutType, panelConfigs } = useChatNexus();

  const gridConfig = LAYOUT_CONFIGS[layoutType];

  // For grid-2x2, we need special handling for 2 rows
  const gridClass =
    layoutType === "grid-2x2"
      ? "grid grid-cols-2 grid-rows-2"
      : `grid ${gridConfig.gridCols}`;

  return (
    <div className={`h-full p-2 gap-2 ${gridClass}`}>
      {panelConfigs.map((config) => (
        <ChatPanel key={config.panelId} panelConfig={config} />
      ))}
    </div>
  );
}
