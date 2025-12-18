import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface DayCheckboxProps {
  checked: boolean;
  scheduled: boolean;
  onToggle: () => void;
}

export function DayCheckbox({ checked, scheduled, onToggle }: DayCheckboxProps) {
  if (!scheduled) {
    // Render a disabled/greyed out circle for non-scheduled days
    return (
      <div className="w-7 h-7 rounded-full bg-muted/30 flex items-center justify-center">
        <span className="text-muted-foreground/30 text-xs">-</span>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all",
        checked
          ? "bg-primary border-primary text-primary-foreground"
          : "border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/10"
      )}
    >
      {checked && <Check className="h-4 w-4" />}
    </button>
  );
}
