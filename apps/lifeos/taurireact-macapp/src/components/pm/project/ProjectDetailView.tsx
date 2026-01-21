import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Id } from "@holaai/convex";
import { ProjectHeader } from "./ProjectHeader";
import { ProjectProperties } from "./ProjectProperties";
import { ProjectIssuesList } from "./ProjectIssuesList";
import { PhasesSection } from "./PhasesSection";
import { ProjectStatus, Priority } from "@/lib/contexts/PMContext";
import { PomodoroWidget, PomodoroStatsMini } from "../pomodoro";
import { DescriptionEditor } from "@/components/shared/DescriptionEditor";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Circle, Activity, Flag, Target, Calendar, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "../shared";

type ProjectHealth = "on_track" | "at_risk" | "off_track";

const STATUS_OPTIONS: { value: ProjectStatus; label: string; color: string }[] = [
  { value: "planned", label: "Planned", color: "bg-gray-500" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-500" },
  { value: "paused", label: "Paused", color: "bg-yellow-500" },
  { value: "completed", label: "Completed", color: "bg-green-500" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-500" },
];

const HEALTH_OPTIONS: { value: ProjectHealth; label: string; color: string }[] = [
  { value: "on_track", label: "On Track", color: "bg-green-500" },
  { value: "at_risk", label: "At Risk", color: "bg-yellow-500" },
  { value: "off_track", label: "Off Track", color: "bg-red-500" },
];

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: "none", label: "None", color: "text-gray-400" },
  { value: "low", label: "Low", color: "text-gray-500" },
  { value: "medium", label: "Medium", color: "text-yellow-500" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "urgent", label: "Urgent", color: "text-red-500" },
];

interface ProjectDetailViewProps {
  projectId: Id<"lifeos_pmProjects">;
}

export function ProjectDetailView({ projectId }: ProjectDetailViewProps) {
  const project = useQuery(api.lifeos.pm_projects.getProject, { projectId });
  const client = useQuery(
    api.lifeos.pm_clients.getClient,
    project?.clientId ? { clientId: project.clientId } : "skip"
  );
  const issues = useQuery(api.lifeos.pm_issues.getIssues, { projectId });
  const updateProject = useMutation(api.lifeos.pm_projects.updateProject);

  const handleSaveDescription = async (value: string) => {
    await updateProject({
      projectId,
      description: value || undefined,
    });
  };

  if (project === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Project not found</div>
      </div>
    );
  }

  const handleUpdateName = async (name: string) => {
    await updateProject({ projectId, name });
  };

  const handleUpdateProperties = async (updates: {
    status?: ProjectStatus;
    health?: ProjectHealth;
    priority?: Priority;
    targetDate?: number | null;
    startDate?: number | null;
  }) => {
    await updateProject({ projectId, ...updates });
  };

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Pomodoro Status Bar */}
        <div className="mb-4 flex items-center justify-end gap-3">
          <PomodoroWidget />
          <PomodoroStatsMini />
        </div>

        <ProjectHeader project={project} client={client} onUpdateName={handleUpdateName} />

        {/* Project Overview Section */}
        <div className="mt-8 space-y-6">
          {/* Project Details Card */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Project Details</h3>

            {/* Properties Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Circle className="h-3 w-3" />
                  Status
                </label>
                <Select
                  value={project.status}
                  onValueChange={(value) => handleUpdateProperties({ status: value as ProjectStatus })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue>
                      <span className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", STATUS_OPTIONS.find(s => s.value === project.status)?.color)} />
                        {STATUS_OPTIONS.find(s => s.value === project.status)?.label}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", option.color)} />
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Health */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Activity className="h-3 w-3" />
                  Health
                </label>
                <Select
                  value={project.health}
                  onValueChange={(value) => handleUpdateProperties({ health: value as ProjectHealth })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue>
                      <span className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", HEALTH_OPTIONS.find(h => h.value === project.health)?.color)} />
                        {HEALTH_OPTIONS.find(h => h.value === project.health)?.label}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {HEALTH_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", option.color)} />
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Flag className="h-3 w-3" />
                  Priority
                </label>
                <Select
                  value={project.priority}
                  onValueChange={(value) => handleUpdateProperties({ priority: value as Priority })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue>
                      {PRIORITY_OPTIONS.find(p => p.value === project.priority)?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className={option.color}>{option.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Start Date
                </label>
                <DatePickerInput
                  value={project.startDate}
                  onChange={(startDate) => handleUpdateProperties({ startDate })}
                  placeholder="Set start"
                />
              </div>

              {/* Target Date */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Target className="h-3 w-3" />
                  Target Date
                </label>
                <DatePickerInput
                  value={project.targetDate}
                  onChange={(targetDate) => handleUpdateProperties({ targetDate })}
                  placeholder="Set target"
                />
              </div>

              {/* Progress */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <BarChart3 className="h-3 w-3" />
                  Progress
                </label>
                <div className="h-9 flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <Progress
                      value={project.issueCount > 0 ? (project.completedIssueCount / project.issueCount) * 100 : 0}
                      className="h-2 flex-1"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {project.completedIssueCount}/{project.issueCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Description
            </h3>

            <DescriptionEditor
              value={project.description ?? ""}
              onSave={handleSaveDescription}
              placeholder="Add a description... (type **bold**, *italic*, - [ ] for checkboxes)"
            />
          </div>

          {/* Phases */}
          <PhasesSection projectId={projectId} issues={issues} />

          {/* Issues List (unassigned to phases) */}
          <div>
            <ProjectIssuesList projectId={projectId} issues={issues} />
          </div>
        </div>
      </div>

      {/* Properties Sidebar */}
      <ProjectProperties project={project} client={client} onUpdate={handleUpdateProperties} />
    </div>
  );
}
