import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import type { Id, Doc } from "@holaai/convex";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PHASE_STATUS_CONFIG, PhaseStatus } from "@/lib/contexts/PMContext";
import { cn } from "@/lib/utils";
import { Layers } from "lucide-react";

interface PhaseSelectProps {
  projectId: Id<"lifeos_pmProjects">;
  value?: Id<"lifeos_pmPhases">;
  onChange: (phaseId: Id<"lifeos_pmPhases"> | undefined) => void;
  size?: "sm" | "default";
  disabled?: boolean;
}

export function PhaseSelect({
  projectId,
  value,
  onChange,
  size = "default",
  disabled = false,
}: PhaseSelectProps) {
  const phases = useQuery(api.lifeos.pm_phases.getPhases, { projectId });

  if (!phases || phases.length === 0) {
    return null;
  }

  const selectedPhase = phases.find((p) => p._id === value);

  const handleChange = (val: string) => {
    if (val === "none") {
      onChange(undefined);
    } else {
      onChange(val as Id<"lifeos_pmPhases">);
    }
  };

  return (
    <Select value={value ?? "none"} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger
        className={cn(
          "border-none bg-transparent shadow-none",
          size === "sm" ? "h-7 text-xs px-2" : "h-9"
        )}
      >
        <SelectValue>
          {selectedPhase ? (
            <span className="flex items-center gap-1.5 text-sm">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              {selectedPhase.name}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              No phase
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <span className="flex items-center gap-2 text-muted-foreground">
            No phase
          </span>
        </SelectItem>
        {phases.map((phase) => {
          const statusConfig = PHASE_STATUS_CONFIG[phase.status as PhaseStatus];
          return (
            <SelectItem key={phase._id} value={phase._id}>
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    statusConfig.color.replace("text-", "bg-")
                  )}
                />
                {phase.name}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
