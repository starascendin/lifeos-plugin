import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { InlineEditableText } from "../shared";
import type { Doc } from "@holaai/convex";

interface ProjectHeaderProps {
  project: Doc<"lifeos_pmProjects">;
  onUpdateName: (name: string) => Promise<void>;
}

export function ProjectHeader({ project, onUpdateName }: ProjectHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 gap-1"
          onClick={() => navigate("/lifeos/pm/projects")}
        >
          <ChevronLeft className="h-4 w-4" />
          Projects
        </Button>
        <span>/</span>
        <span className="text-foreground">{project.name}</span>
      </div>

      {/* Project Title with Icon */}
      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-lg text-2xl"
          style={{ backgroundColor: project.color + "20" }}
        >
          {project.icon || project.key[0]}
        </div>
        <div className="flex-1">
          <InlineEditableText
            value={project.name}
            onSave={onUpdateName}
            className="text-2xl font-semibold"
            inputClassName="text-2xl font-semibold"
          />
          <div className="text-sm text-muted-foreground">{project.key}</div>
        </div>
      </div>
    </div>
  );
}
