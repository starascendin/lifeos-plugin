import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Id } from "@holaai/convex";
import { ProjectHeader } from "./ProjectHeader";
import { ProjectProperties } from "./ProjectProperties";
import { ProjectIssuesList } from "./ProjectIssuesList";
import { ProjectSettingsTab } from "./ProjectSettingsTab";
import { ProjectStatus, Priority } from "@/lib/contexts/PMContext";
import { Button } from "@/components/ui/button";
import { ListTodo, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { PomodoroWidget, PomodoroStatsMini } from "../pomodoro";

type ProjectHealth = "on_track" | "at_risk" | "off_track";
type ProjectTab = "issues" | "settings";

interface ProjectDetailViewProps {
  projectId: Id<"lifeos_pmProjects">;
}

export function ProjectDetailView({ projectId }: ProjectDetailViewProps) {
  const [activeTab, setActiveTab] = useState<ProjectTab>("issues");
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

        {/* Tab Navigation */}
        <div className="mt-6 flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
          <Button
            variant={activeTab === "issues" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("issues")}
            className={cn(
              "gap-2",
              activeTab !== "issues" && "text-muted-foreground"
            )}
          >
            <ListTodo className="h-4 w-4" />
            Issues
          </Button>
          <Button
            variant={activeTab === "settings" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("settings")}
            className={cn(
              "gap-2",
              activeTab !== "settings" && "text-muted-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === "issues" && (
            <ProjectIssuesList projectId={projectId} issues={issues} />
          )}
          {activeTab === "settings" && (
            <ProjectSettingsTab project={project} />
          )}
        </div>
      </div>

      {/* Properties Sidebar - only show on Issues tab */}
      {activeTab === "issues" && (
        <ProjectProperties project={project} onUpdate={handleUpdateProperties} />
      )}
    </div>
  );
}
