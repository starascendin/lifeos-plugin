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
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, FolderKanban } from "lucide-react";

// Note: These API paths will be available after running `convex codegen`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pmProjectsApi = (api as any).lifeos.pm_projects;

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

  // Get all user's projects
  const allProjects = useQuery(pmProjectsApi.getProjects, {});
  const updateProject = useMutation(pmProjectsApi.updateProject);

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
                        style={{ backgroundColor: project.color || "#6366f1" }}
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Keep old export name for backward compatibility, but it's now a dropdown
export { LinkProjectsDropdown as LinkProjectsDialog };
