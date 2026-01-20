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
      {/* Breadcrumb - clean minimal style */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/lifeos/pm/projects")}
        >
          <ChevronLeft className="h-4 w-4" />
          Projects
        </Button>
        {client && (
          <>
            <span className="text-muted-foreground/50">/</span>
            <span className="text-muted-foreground flex items-center gap-1.5 px-1">
              <Building2 className="h-3.5 w-3.5" />
              {client.name}
            </span>
          </>
        )}
        <span className="text-muted-foreground/50">/</span>
        <span className="font-medium text-foreground px-1">{project.name}</span>
      </nav>

      {/* Project Title with Icon */}
      <div className="flex items-center gap-4 pt-2">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl font-medium"
          style={{
            backgroundColor: project.color + "15",
            color: project.color
          }}
        >
          {project.icon || project.key[0]}
        </div>
        <div className="flex-1 min-w-0">
          <InlineEditableText
            value={project.name}
            onSave={onUpdateName}
            className="text-2xl font-semibold"
            inputClassName="text-2xl font-semibold"
          />
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{project.key}</span>
            {client && (
              <>
                <span className="text-muted-foreground/30">•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
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
