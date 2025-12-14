import { useChatNexus } from "../../lib/contexts/ChatNexusContext";
import { LayoutType } from "../../lib/constants/models";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const LAYOUTS: { type: LayoutType; icon: React.ReactNode; label: string }[] = [
  {
    type: "single",
    label: "Single panel",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    ),
  },
  {
    type: "two-column",
    label: "Two panels",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="12" y1="3" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    type: "three-column",
    label: "Three panels",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
      </svg>
    ),
  },
  {
    type: "grid-2x2",
    label: "Four panels (2x2)",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="3" y1="12" x2="21" y2="12" />
      </svg>
    ),
  },
];

export function LayoutSelector() {
  const { layoutType, setLayoutType } = useChatNexus();

  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      {LAYOUTS.map((layout) => (
        <Tooltip key={layout.type}>
          <TooltipTrigger asChild>
            <Button
              variant={layoutType === layout.type ? "default" : "ghost"}
              size="icon"
              className={cn(
                "h-7 w-7",
                layoutType !== layout.type && "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setLayoutType(layout.type)}
            >
              {layout.icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {layout.label}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
