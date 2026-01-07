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

  // Grid class based on layout - stack on mobile
  const gridClass = cn(
    "grid gap-2 p-2",
    // Mobile: always single column with auto rows
    "grid-cols-1 auto-rows-[minmax(250px,1fr)]",
    // Desktop: use layout setting
    currentLayout === 1 && "sm:grid-cols-1 sm:h-full",
    currentLayout === 2 && "sm:grid-cols-2 sm:h-full",
    currentLayout === 3 && "sm:grid-cols-3 sm:h-full",
    currentLayout === 4 && "sm:grid-cols-2 sm:grid-rows-2 sm:h-full"
  );

  return (
    <div className={cn("h-full overflow-auto sm:overflow-hidden", gridClass)}>
      {panels.map((panel) => (
        <ChatPanel key={panel.id} panel={panel} />
      ))}
    </div>
  );
}
