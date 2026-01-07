import { cn } from "@/lib/utils";
import { useLLMCouncilAPI } from "@/lib/contexts/LLMCouncilAPIContext";
import { ChatPanel } from "./ChatPanel";
import { Settings } from "lucide-react";

export function MultiChatView() {
  const { panels, currentLayout, isConfigured } = useLLMCouncilAPI();

  // Not configured - show message
  if (!isConfigured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <Settings className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-muted-foreground">
            Click the <strong>Settings</strong> icon (gear) in the toolbar
          </p>
          <p className="text-sm text-muted-foreground">
            to configure your API URL and Key.
          </p>
        </div>
      </div>
    );
  }

  // Grid class based on layout
  const gridClass = cn(
    "grid h-full gap-2 p-2",
    currentLayout === 1 && "grid-cols-1",
    currentLayout === 2 && "grid-cols-2",
    currentLayout === 3 && "grid-cols-3",
    currentLayout === 4 && "grid-cols-2 grid-rows-2"
  );

  return (
    <div className={gridClass}>
      {panels.map((panel) => (
        <ChatPanel key={panel.id} panel={panel} />
      ))}
    </div>
  );
}
