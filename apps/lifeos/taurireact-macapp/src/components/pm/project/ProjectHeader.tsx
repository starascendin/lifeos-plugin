import { ChevronLeft, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { InlineEditableText } from "../shared";
import type { Doc } from "@holaai/convex";

interface ProjectHeaderProps {
  project: Doc<"lifeos_pmProjects">;
  client?: Doc<"lifeos_pmClients"> | null;
  onUpdateName: (name: string) => Promise<void>;
}

export function ProjectHeader({ project, client, onUpdateName }: ProjectHeaderProps) {
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
        {client && (
          <>
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {client.name}
            </span>
            <span>/</span>
          </>
        )}
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{project.key}</span>
            {client && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {client.name}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
