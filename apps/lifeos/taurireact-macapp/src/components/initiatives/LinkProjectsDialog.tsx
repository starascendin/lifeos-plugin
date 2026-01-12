import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Id, Doc } from "@holaai/convex";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Check, FolderKanban } from "lucide-react";

// Note: These API paths will be available after running `convex codegen`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pmProjectsApi = (api as any).lifeos.pm_projects;

const COLORS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
];

interface LinkProjectsDropdownProps {
  initiativeId: Id<"lifeos_yearlyInitiatives">;
  initiativeColor?: string;
  currentlyLinkedIds: Id<"lifeos_pmProjects">[];
}

export function LinkProjectsDropdown({
  initiativeId,
  initiativeColor = "#6366f1",
  currentlyLinkedIds,
}: LinkProjectsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Create project form state
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectColor, setNewProjectColor] = useState(COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  // Get all user's projects
  const allProjects = useQuery(pmProjectsApi.getProjects, {});
  const updateProject = useMutation(pmProjectsApi.updateProject);
  const createProject = useMutation(pmProjectsApi.createProject);

  const linkedSet = useMemo(
    () => new Set(currentlyLinkedIds),
    [currentlyLinkedIds],
  );

  const handleToggle = async (project: Doc<"lifeos_pmProjects">) => {
    const isCurrentlyLinked = linkedSet.has(project._id);

    try {
      await updateProject({
        projectId: project._id,
        initiativeId: isCurrentlyLinked ? null : initiativeId,
      });
    } catch (error) {
      console.error("Failed to update project link:", error);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      await createProject({
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined,
        color: newProjectColor,
        initiativeId, // Auto-link to current initiative
      });
      // Reset form and close dialog
      setNewProjectName("");
      setNewProjectDescription("");
      setNewProjectColor(COLORS[0]);
      setShowCreateDialog(false);
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsCreating(false);
    }
  };

  // Separate linked and available projects
  const { linkedProjects, availableProjects } = useMemo(() => {
    if (!allProjects) return { linkedProjects: [], availableProjects: [] };

    const linked: Doc<"lifeos_pmProjects">[] = [];
    const available: Doc<"lifeos_pmProjects">[] = [];

    for (const project of allProjects) {
      if (linkedSet.has(project._id)) {
        linked.push(project);
      } else if (!project.initiativeId) {
        // Only show unlinked projects as available
        available.push(project);
      }
    }

    return { linkedProjects: linked, availableProjects: available };
  }, [allProjects, linkedSet]);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-3 w-3 mr-1" />
            Link Project
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="end">
          <Command>
            <CommandInput placeholder="Search projects..." />
            <CommandList>
              <CommandEmpty>
                <div className="py-4 text-center text-sm text-muted-foreground">
                  <FolderKanban className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  No projects found
                </div>
              </CommandEmpty>

              {linkedProjects.length > 0 && (
                <CommandGroup heading="Linked">
                  {linkedProjects.map((project) => (
                    <CommandItem
                      key={project._id}
                      value={project.name}
                      onSelect={() => handleToggle(project)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div
                          className="w-2 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: initiativeColor }}
                        />
                        <span className="truncate">{project.name}</span>
                        <Badge
                          variant="secondary"
                          className="ml-auto text-[10px]"
                        >
                          {project.completedIssueCount ?? 0}/
                          {project.issueCount ?? 0}
                        </Badge>
                      </div>
                      <Check className="h-4 w-4 text-primary ml-2" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {availableProjects.length > 0 && (
                <CommandGroup heading="Available">
                  {availableProjects.map((project) => (
                    <CommandItem
                      key={project._id}
                      value={project.name}
                      onSelect={() => handleToggle(project)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div
                          className="w-2 h-4 rounded-full shrink-0"
                          style={{
                            backgroundColor: project.color || "#6366f1",
                          }}
                        />
                        <span className="truncate">{project.name}</span>
                        <Badge
                          variant="secondary"
                          className="ml-auto text-[10px]"
                        >
                          {project.completedIssueCount ?? 0}/
                          {project.issueCount ?? 0}
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setShowCreateDialog(true);
                  }}
                  className="cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  <span>Create new project</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Create Project Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateProject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="My Project"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-description">
                Description (optional)
              </Label>
              <Textarea
                id="project-description"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="What is this project about?"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewProjectColor(c)}
                    className={`h-8 w-8 rounded-full transition-transform ${
                      newProjectColor === c
                        ? "scale-110 ring-2 ring-offset-2 ring-primary"
                        : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newProjectName.trim() || isCreating}
              >
                {isCreating ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Keep old export name for backward compatibility, but it's now a dropdown
export { LinkProjectsDropdown as LinkProjectsDialog };
