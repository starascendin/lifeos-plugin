import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITY_CONFIG, Priority } from "@/lib/contexts/PMContext";
import { cn } from "@/lib/utils";

interface PrioritySelectProps {
  value: Priority;
  onChange: (priority: Priority) => void;
  size?: "sm" | "default";
  disabled?: boolean;
}

const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low", "none"];

export function PrioritySelect({
  value,
  onChange,
  size = "default",
  disabled = false,
}: PrioritySelectProps) {
  const config = PRIORITY_CONFIG[value];

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={cn(
          "border-none bg-transparent shadow-none",
          size === "sm" ? "h-7 text-xs px-2" : "h-9"
        )}
      >
        <SelectValue>
          <span className={cn("flex items-center gap-1.5 text-sm", config.color)}>
            <span className="font-bold">{config.icon}</span>
            {config.label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PRIORITIES.map((priority) => {
          const priorityConfig = PRIORITY_CONFIG[priority];
          return (
            <SelectItem key={priority} value={priority}>
              <span className={cn("flex items-center gap-2", priorityConfig.color)}>
                <span className="w-4 font-bold">{priorityConfig.icon}</span>
                {priorityConfig.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
