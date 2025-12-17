import { useNavigate } from "react-router-dom";
import { usePM, ProjectStatus } from "@/lib/contexts/PMContext";
import { cn } from "@/lib/utils";
import { FolderKanban, MoreHorizontal, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";

type ProjectHealth = "on_track" | "at_risk" | "off_track";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

const HEALTH_CONFIG: Record<ProjectHealth, { label: string; color: string; bg: string }> = {
  on_track: { label: "On Track", color: "text-green-500", bg: "bg-green-500" },
  at_risk: { label: "At Risk", color: "text-yellow-500", bg: "bg-yellow-500" },
  off_track: { label: "Off Track", color: "text-red-500", bg: "bg-red-500" },
};

export function ProjectList() {
  const navigate = useNavigate();
  const { projects, isLoadingProjects, archiveProject, setFilters } = usePM();

  if (isLoadingProjects) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading projects...</div>
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <FolderKanban className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h3 className="font-medium">No projects yet</h3>
          <p className="text-sm text-muted-foreground">
            Create your first project to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Table Header */}
      <div className="mb-2 grid grid-cols-[1fr,120px,120px,100px,100px,40px] gap-4 px-4 text-xs font-medium text-muted-foreground">
        <div>Name</div>
        <div>Status</div>
        <div>Health</div>
        <div>Progress</div>
        <div>Issues</div>
        <div></div>
      </div>

      {/* Project Rows */}
      <div className="space-y-2">
        {projects.map((project) => {
          const progress =
            project.issueCount > 0
              ? Math.round(
                  (project.completedIssueCount / project.issueCount) * 100
                )
              : 0;
          const healthConfig = HEALTH_CONFIG[project.health as ProjectHealth];

          return (
            <div
              key={project._id}
              onClick={() => navigate(`/lifeos/pm/projects/${project._id}`)}
              className="grid grid-cols-[1fr,120px,120px,100px,100px,40px] items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50 cursor-pointer"
            >
              {/* Name */}
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded text-lg"
                  style={{ backgroundColor: project.color + "20" }}
                >
                  {project.icon || project.key[0]}
                </div>
                <div>
                  <div className="font-medium">{project.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {project.key}
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="text-sm">
                {STATUS_LABELS[project.status as ProjectStatus]}
              </div>

              {/* Health */}
              <div className="flex items-center gap-2">
                <div
                  className={cn("h-2 w-2 rounded-full", healthConfig.bg)}
                />
                <span className={cn("text-sm", healthConfig.color)}>
                  {healthConfig.label}
                </span>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-2">
                <Progress value={progress} className="h-1.5 w-16" />
                <span className="text-xs text-muted-foreground">
                  {progress}%
                </span>
              </div>

              {/* Issues */}
              <div className="text-sm text-muted-foreground">
                {project.completedIssueCount}/{project.issueCount}
              </div>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      setFilters({ projectId: project._id })
                    }
                  >
                    View Issues
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      archiveProject({ projectId: project._id })
                    }
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
    </div>
  );
}
