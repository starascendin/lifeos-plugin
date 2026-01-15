import { useMemo } from "react";
import {
  Circle,
  Flag,
  Calendar,
  Hash,
  Tag,
  FolderKanban,
  RefreshCw,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  PropertyRow,
  StatusSelect,
  PrioritySelect,
  DatePickerInput,
  LabelPicker,
} from "../shared";
import { usePM, IssueStatus, Priority } from "@/lib/contexts/PMContext";
import type { Doc, Id } from "@holaai/convex";

interface IssuePropertiesProps {
  issue: Doc<"lifeos_pmIssues">;
  onUpdate: (updates: {
    status?: IssueStatus;
    priority?: Priority;
    dueDate?: number | null;
    estimate?: number;
    labelIds?: Id<"lifeos_pmLabels">[];
    projectId?: Id<"lifeos_pmProjects">;
    cycleId?: Id<"lifeos_pmCycles">;
  }) => Promise<void>;
  onStatusChange: (status: IssueStatus) => Promise<void>;
}

// Helper to format date range for cycles
function formatDateRange(startDate: number, endDate: number): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const formatOptions: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, formatOptions)} - ${end.toLocaleDateString(undefined, formatOptions)}`;
}

export function IssueProperties({ issue, onUpdate, onStatusChange }: IssuePropertiesProps) {
  const { projects, cycles } = usePM();

  // Filter cycles to show: current cycle, 1 previous, and 2 upcoming
  const filteredCycles = useMemo(() => {
    if (!cycles) return [];

    // Separate cycles by status
    const completed = cycles
      .filter((c) => c.status === "completed")
      .sort((a, b) => b.endDate - a.endDate); // Most recent first

    const active = cycles.filter((c) => c.status === "active");

    const upcoming = cycles
      .filter((c) => c.status === "upcoming")
      .sort((a, b) => a.startDate - b.startDate); // Earliest first

    // Combine: 1 previous + current + 2 upcoming
    const result = [
      ...completed.slice(0, 1), // 1 most recent completed
      ...active, // Current/active cycle(s)
      ...upcoming.slice(0, 2), // 2 upcoming
    ];

    // Sort by start date for consistent display order
    return result.sort((a, b) => a.startDate - b.startDate);
  }, [cycles]);

  return (
    <div className="w-60 shrink-0 border-l border-border bg-muted/30 p-4">
      <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Properties
      </h3>

      <div className="space-y-1">
        {/* Status */}
        <PropertyRow label="Status" icon={Circle}>
          <StatusSelect
            value={issue.status as IssueStatus}
            onChange={onStatusChange}
            size="sm"
          />
        </PropertyRow>

        {/* Priority */}
        <PropertyRow label="Priority" icon={Flag}>
          <PrioritySelect
            value={issue.priority as Priority}
            onChange={(priority) => onUpdate({ priority })}
            size="sm"
          />
        </PropertyRow>

        {/* Due Date */}
        <PropertyRow label="Due date" icon={Calendar}>
          <DatePickerInput
            value={issue.dueDate}
            onChange={(dueDate) => onUpdate({ dueDate })}
            placeholder="Set due date"
          />
        </PropertyRow>

        {/* Estimate */}
        <PropertyRow label="Estimate" icon={Hash}>
          <Input
            type="number"
            value={issue.estimate || ""}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value) : undefined;
              onUpdate({ estimate: val });
            }}
            placeholder="Points"
            className="h-8 w-20 text-sm"
            min={0}
          />
        </PropertyRow>

        {/* Project */}
        <PropertyRow label="Project" icon={FolderKanban}>
          <Select
            value={issue.projectId || "none"}
            onValueChange={(value) =>
              onUpdate({ projectId: value === "none" ? undefined : (value as Id<"lifeos_pmProjects">) })
            }
          >
            <SelectTrigger className="h-8 w-32 border-none bg-transparent shadow-none text-sm">
              <SelectValue placeholder="No project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {projects?.map((project) => (
                <SelectItem key={project._id} value={project._id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyRow>

        {/* Cycle */}
        <PropertyRow label="Cycle" icon={RefreshCw}>
          <Select
            value={issue.cycleId || "none"}
            onValueChange={(value) =>
              onUpdate({ cycleId: value === "none" ? undefined : (value as Id<"lifeos_pmCycles">) })
            }
          >
            <SelectTrigger className="h-8 w-40 border-none bg-transparent shadow-none text-sm">
              <SelectValue placeholder="No cycle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No cycle</SelectItem>
              {filteredCycles.map((cycle) => (
                <SelectItem key={cycle._id} value={cycle._id}>
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1.5">
                      {cycle.name || `Cycle ${cycle.number}`}
                      {cycle.status === "active" && (
                        <span className="text-[10px] font-medium text-green-500">(Current)</span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDateRange(cycle.startDate, cycle.endDate)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyRow>

        {/* Labels */}
        <div className="pt-3 border-t border-border mt-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Tag className="h-4 w-4" />
            <span>Labels</span>
          </div>
          <LabelPicker
            selectedIds={issue.labelIds as Id<"lifeos_pmLabels">[]}
            onChange={(labelIds) => onUpdate({ labelIds })}
            projectId={issue.projectId}
          />
        </div>
      </div>
    </div>
  );
}
