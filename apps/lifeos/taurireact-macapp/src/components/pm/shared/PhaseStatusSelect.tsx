import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PHASE_STATUS_CONFIG, PhaseStatus } from "@/lib/contexts/PMContext";
import { cn } from "@/lib/utils";

interface PhaseStatusSelectProps {
  value: PhaseStatus;
  onChange: (status: PhaseStatus) => void;
  size?: "sm" | "default";
  disabled?: boolean;
}

const PHASE_STATUSES: PhaseStatus[] = ["not_started", "in_progress", "completed"];

export function PhaseStatusSelect({
  value,
  onChange,
  size = "default",
  disabled = false,
}: PhaseStatusSelectProps) {
  const config = PHASE_STATUS_CONFIG[value];

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={cn(
          "border-none bg-transparent shadow-none",
          size === "sm" ? "h-7 text-xs px-2" : "h-9"
        )}
      >
        <SelectValue>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
              config.bgColor,
              config.color
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 rounded-full", config.color.replace("text-", "bg-"))}
            />
            {config.label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PHASE_STATUSES.map((status) => {
          const statusConfig = PHASE_STATUS_CONFIG[status];
          return (
            <SelectItem key={status} value={status}>
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    statusConfig.color.replace("text-", "bg-")
                  )}
                />
                {statusConfig.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
