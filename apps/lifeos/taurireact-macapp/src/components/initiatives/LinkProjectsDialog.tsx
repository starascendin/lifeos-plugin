import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Id, Doc } from "@holaai/convex";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Check, Loader2 } from "lucide-react";

// Note: These API paths will be available after running `convex codegen`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pmProjectsApi = (api as any).lifeos.pm_projects;

interface LinkProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initiativeId: Id<"lifeos_yearlyInitiatives">;
  initiativeColor?: string;
  currentlyLinkedIds: Id<"lifeos_pmProjects">[];
}

export function LinkProjectsDialog({
  open,
  onOpenChange,
  initiativeId,
  initiativeColor = "#6366f1",
  currentlyLinkedIds,
}: LinkProjectsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<Id<"lifeos_pmProjects">>>(
    new Set(currentlyLinkedIds),
  );
  const [isSaving, setIsSaving] = useState(false);

  // Get all user's projects
  const allProjects = useQuery(pmProjectsApi.getProjects, {});
  const updateProject = useMutation(pmProjectsApi.updateProject);

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(currentlyLinkedIds));
    }
  }, [open, currentlyLinkedIds]);

  const handleToggle = (projectId: Id<"lifeos_pmProjects">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const currentSet = new Set(currentlyLinkedIds);
      const newSet = selectedIds;

      // Find projects to link (in newSet but not in currentSet)
      const toLink = [...newSet].filter((id) => !currentSet.has(id));

      // Find projects to unlink (in currentSet but not in newSet)
      const toUnlink = [...currentSet].filter((id) => !newSet.has(id));

      // Perform updates
      await Promise.all([
        ...toLink.map((projectId) =>
          updateProject({ projectId, initiativeId }),
        ),
        ...toUnlink.map((projectId) =>
          updateProject({ projectId, initiativeId: null }),
        ),
      ]);

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update project links:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = () => {
    const currentSet = new Set(currentlyLinkedIds);
    if (currentSet.size !== selectedIds.size) return true;
    for (const id of selectedIds) {
      if (!currentSet.has(id)) return true;
    }
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            Link Projects
          </DialogTitle>
          <DialogDescription>
            Select projects to link to this initiative. Linked projects
            contribute to the initiative&apos;s progress.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          {allProjects === undefined ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : allProjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No projects found</p>
              <p className="text-xs">Create a project first to link it here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allProjects.map((project: Doc<"lifeos_pmProjects">) => {
                const isSelected = selectedIds.has(project._id);
                const isLinkedToOther =
                  project.initiativeId && project.initiativeId !== initiativeId;

                return (
                  <button
                    key={project._id}
                    onClick={() =>
                      !isLinkedToOther && handleToggle(project._id)
                    }
                    disabled={isLinkedToOther}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      isLinkedToOther
                        ? "opacity-50 cursor-not-allowed bg-muted/30"
                        : isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent/50"
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isLinkedToOther}
                      className="pointer-events-none"
                    />
                    <div
                      className="w-2 h-8 rounded-full shrink-0"
                      style={{
                        backgroundColor: isSelected
                          ? initiativeColor
                          : project.color || "#6366f1",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {project.name}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>
                          {project.completedIssueCount ?? 0}/
                          {project.issueCount ?? 0} tasks
                        </span>
                        {isLinkedToOther && (
                          <Badge variant="secondary" className="text-[10px]">
                            Linked to another
                          </Badge>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges()}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save Changes
                {hasChanges() && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {selectedIds.size}
                  </Badge>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
