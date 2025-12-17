import {
  Circle,
  Target,
  Calendar,
  BarChart3,
  Flag,
  Activity,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { PropertyRow, DatePickerInput, PrioritySelect } from "../shared";
import { ProjectStatus, Priority } from "@/lib/contexts/PMContext";
import { cn } from "@/lib/utils";
import type { Doc } from "@holaai/convex";

type ProjectHealth = "on_track" | "at_risk" | "off_track";

interface ProjectPropertiesProps {
  project: Doc<"lifeos_pmProjects">;
  onUpdate: (updates: {
    status?: ProjectStatus;
    health?: ProjectHealth;
    priority?: Priority;
    targetDate?: number;
    startDate?: number;
  }) => Promise<void>;
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const HEALTH_OPTIONS: {
  value: ProjectHealth;
  label: string;
  color: string;
  bg: string;
}[] = [
  { value: "on_track", label: "On Track", color: "text-green-500", bg: "bg-green-500" },
  { value: "at_risk", label: "At Risk", color: "text-yellow-500", bg: "bg-yellow-500" },
  { value: "off_track", label: "Off Track", color: "text-red-500", bg: "bg-red-500" },
];

export function ProjectProperties({ project, onUpdate }: ProjectPropertiesProps) {
  const progress =
    project.issueCount > 0
      ? Math.round((project.completedIssueCount / project.issueCount) * 100)
      : 0;

  const currentHealth = HEALTH_OPTIONS.find((h) => h.value === project.health) || HEALTH_OPTIONS[0];

  return (
    <div className="w-72 shrink-0 border-l border-border bg-muted/30 p-4">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">Properties</h3>

      <div className="space-y-1">
        {/* Status */}
        <PropertyRow label="Status" icon={Circle}>
          <Select
            value={project.status}
            onValueChange={(value) => onUpdate({ status: value as ProjectStatus })}
          >
            <SelectTrigger className="h-8 w-32 border-none bg-transparent shadow-none text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyRow>

        {/* Health */}
        <PropertyRow label="Health" icon={Activity}>
          <Select
            value={project.health}
            onValueChange={(value) => onUpdate({ health: value as ProjectHealth })}
          >
            <SelectTrigger className="h-8 w-32 border-none bg-transparent shadow-none text-sm">
              <SelectValue>
                <span className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", currentHealth.bg)} />
                  <span className={currentHealth.color}>{currentHealth.label}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {HEALTH_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", option.bg)} />
                    {option.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyRow>

        {/* Priority */}
        <PropertyRow label="Priority" icon={Flag}>
          <PrioritySelect
            value={project.priority as Priority}
            onChange={(priority) => onUpdate({ priority })}
            size="sm"
          />
        </PropertyRow>

        {/* Target Date */}
        <PropertyRow label="Target" icon={Target}>
          <DatePickerInput
            value={project.targetDate}
            onChange={(targetDate) => onUpdate({ targetDate })}
            placeholder="Set target"
          />
        </PropertyRow>

        {/* Start Date */}
        <PropertyRow label="Start" icon={Calendar}>
          <DatePickerInput
            value={project.startDate}
            onChange={(startDate) => onUpdate({ startDate })}
            placeholder="Set start"
          />
        </PropertyRow>

        {/* Progress */}
        <div className="pt-4 border-t border-border mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Progress
            </span>
            <span className="text-sm font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="mt-1 text-xs text-muted-foreground text-right">
            {project.completedIssueCount} of {project.issueCount} issues
          </div>
        </div>
      </div>
    </div>
  );
}
