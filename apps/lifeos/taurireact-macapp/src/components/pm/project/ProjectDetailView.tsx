import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Id } from "@holaai/convex";
import { ProjectHeader } from "./ProjectHeader";
import { ProjectProperties } from "./ProjectProperties";
import { ProjectIssuesList } from "./ProjectIssuesList";
import { ProjectStatus, Priority } from "@/lib/contexts/PMContext";
import { PomodoroWidget, PomodoroStatsMini } from "../pomodoro";

type ProjectHealth = "on_track" | "at_risk" | "off_track";

interface ProjectDetailViewProps {
  projectId: Id<"lifeos_pmProjects">;
}

export function ProjectDetailView({ projectId }: ProjectDetailViewProps) {
  const project = useQuery(api.lifeos.pm_projects.getProject, { projectId });
  const issues = useQuery(api.lifeos.pm_issues.getIssues, { projectId });
  const updateProject = useMutation(api.lifeos.pm_projects.updateProject);

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
    targetDate?: number;
    startDate?: number;
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

        <ProjectHeader project={project} onUpdateName={handleUpdateName} />

        {/* Issues List */}
        <div className="mt-6">
          <ProjectIssuesList projectId={projectId} issues={issues} />
        </div>
      </div>

      {/* Properties Sidebar */}
      <ProjectProperties project={project} onUpdate={handleUpdateProperties} />
    </div>
  );
}
