import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Doc, Id } from "@holaai/convex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Plus,
  Building2,
  FileText,
  AlertCircle,
  LayoutList,
} from "lucide-react";
import { ProjectView } from "./ProjectView";

type Client = Doc<"lifeos_projClients">;
type Project = Doc<"lifeos_projProjects">;

export function ClientProjectsTab() {
  const [selectedProject, setSelectedProject] = useState<Id<"lifeos_projProjects"> | null>(null);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectClientId, setNewProjectClientId] = useState<Id<"lifeos_projClients"> | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const groupedData = useQuery(api.lifeos.proj_projects.getProjectsGroupedByClient);
  const createClient = useMutation(api.lifeos.proj_clients.createClient);
  const createProject = useMutation(api.lifeos.proj_projects.createProject);

  const toggleClient = (clientId: string) => {
    setExpandedClients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    await createClient({ name: newClientName.trim() });
    setNewClientName("");
    setShowNewClientDialog(false);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    await createProject({
      name: newProjectName.trim(),
      clientId: newProjectClientId ?? undefined,
    });
    setNewProjectName("");
    setNewProjectClientId(null);
    setShowNewProjectDialog(false);
  };

  const openNewProjectDialog = (clientId: Id<"lifeos_projClients"> | null = null) => {
    setNewProjectClientId(clientId);
    setShowNewProjectDialog(true);
  };

  if (!groupedData) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Client Projects</h2>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowNewClientDialog(true)}
              title="Add Client"
            >
              <Building2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => openNewProjectDialog(null)}
              title="Add Project"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {groupedData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No projects yet</p>
                <p className="text-xs mt-1">Create a client or project to get started</p>
              </div>
            ) : (
              groupedData.map((group) => (
                <ClientGroup
                  key={group.client?._id ?? "personal"}
                  client={group.client}
                  projects={group.projects}
                  isExpanded={expandedClients.has(group.client?._id ?? "personal")}
                  onToggle={() => toggleClient(group.client?._id ?? "personal")}
                  selectedProjectId={selectedProject}
                  onSelectProject={setSelectedProject}
                  onAddProject={() => openNewProjectDialog(group.client?._id ?? null)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {selectedProject ? (
          <ProjectView
            projectId={selectedProject}
            onBack={() => setSelectedProject(null)}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <LayoutList className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg">Select a project</p>
            <p className="text-sm mt-1">Or create a new one from the sidebar</p>
          </div>
        )}
      </div>

      {/* New Client Dialog */}
      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Client</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Client name"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateClient()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewClientDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateClient} disabled={!newClientName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Project Dialog */}
      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Input
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              autoFocus
            />
            {newProjectClientId && (
              <p className="text-sm text-muted-foreground">
                Creating under client: {groupedData.find(g => g.client?._id === newProjectClientId)?.client?.name}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProjectDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={!newProjectName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ClientGroupProps {
  client: Client | null;
  projects: Project[];
  isExpanded: boolean;
  onToggle: () => void;
  selectedProjectId: Id<"lifeos_projProjects"> | null;
  onSelectProject: (id: Id<"lifeos_projProjects">) => void;
  onAddProject: () => void;
}

function ClientGroup({
  client,
  projects,
  isExpanded,
  onToggle,
  selectedProjectId,
  onSelectProject,
  onAddProject,
}: ClientGroupProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm",
          "hover:bg-muted transition-colors",
          "text-left"
        )}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 truncate font-medium">
          {client?.name ?? "Personal Projects"}
        </span>
        <span className="text-xs text-muted-foreground">{projects.length}</span>
      </button>

      {isExpanded && (
        <div className="ml-4 mt-1 space-y-0.5">
          {projects.map((project) => (
            <button
              key={project._id}
              onClick={() => onSelectProject(project._id)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm",
                "hover:bg-muted transition-colors text-left",
                selectedProjectId === project._id && "bg-muted"
              )}
            >
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{project.name}</span>
              <StatusBadge status={project.status} />
            </button>
          ))}
          <button
            onClick={onAddProject}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add project</span>
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-500/20 text-green-600",
    on_hold: "bg-yellow-500/20 text-yellow-600",
    completed: "bg-blue-500/20 text-blue-600",
    archived: "bg-gray-500/20 text-gray-600",
  };

  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded text-xs font-medium",
        colors[status] ?? "bg-gray-500/20 text-gray-600"
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
