import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Tags, X } from "lucide-react";

interface LabelFilterSidebarProps {
  labels: { label: string; count: number }[];
  selectedLabels: string[];
  onLabelToggle: (label: string) => void;
  onClearFilters: () => void;
}

export function LabelFilterSidebar({
  labels,
  selectedLabels,
  onLabelToggle,
  onClearFilters,
}: LabelFilterSidebarProps) {
  const hasFilters = selectedLabels.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Tags className="h-4 w-4" />
          Labels
        </h3>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onClearFilters}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {labels.length === 0 ? (
            <p className="text-sm text-muted-foreground px-2 py-4 text-center">
              No labels found. Extract insights from voice memos to see labels here.
            </p>
          ) : (
            labels.map(({ label, count }) => {
              const isSelected = selectedLabels.includes(label);
              return (
                <button
                  key={label}
                  onClick={() => onLabelToggle(label)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <span className="truncate capitalize">{label}</span>
                  <Badge
                    variant={isSelected ? "secondary" : "outline"}
                    className={cn(
                      "ml-2 min-w-[24px] justify-center",
                      isSelected && "bg-primary-foreground/20 text-primary-foreground"
                    )}
                  >
                    {count}
                  </Badge>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>

      {hasFilters && (
        <div className="p-3 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground">
            {selectedLabels.length} label{selectedLabels.length !== 1 ? "s" : ""} selected
          </p>
        </div>
      )}
    </div>
  );
}
