import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Id } from "@holaai/convex";
import { X, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { usePM, IssueStatus, Priority } from "@/lib/contexts/PMContext";
import { IssueHeader } from "./IssueHeader";
import { IssueDescription } from "./IssueDescription";
import { IssueProperties } from "./IssueProperties";

export function IssueDetailPanel() {
  const { selectedIssueId, setSelectedIssueId, deleteIssue } = usePM();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const issue = useQuery(
    api.lifeos.pm_issues.getIssue,
    selectedIssueId ? { issueId: selectedIssueId } : "skip"
  );

  const updateIssue = useMutation(api.lifeos.pm_issues.updateIssue);
  const updateIssueStatus = useMutation(api.lifeos.pm_issues.updateIssueStatus);
  const moveIssueToProject = useMutation(api.lifeos.pm_issues.moveIssueToProject);
  const moveIssueToCycle = useMutation(api.lifeos.pm_issues.moveIssueToCycle);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedIssueId(null);
      }
    };

    if (selectedIssueId) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [selectedIssueId, setSelectedIssueId]);

  const handleClose = () => {
    setSelectedIssueId(null);
  };

  const handleUpdateTitle = async (title: string) => {
    if (!selectedIssueId) return;
    await updateIssue({ issueId: selectedIssueId, title });
  };

  const handleUpdateDescription = async (description: string) => {
    if (!selectedIssueId) return;
    await updateIssue({ issueId: selectedIssueId, description });
  };

  const handleStatusChange = async (status: IssueStatus) => {
    if (!selectedIssueId) return;
    await updateIssueStatus({ issueId: selectedIssueId, status });
  };

  const handleUpdate = async (updates: {
    status?: IssueStatus;
    priority?: Priority;
    dueDate?: number;
    estimate?: number;
    labelIds?: Id<"lifeos_pmLabels">[];
    projectId?: Id<"lifeos_pmProjects">;
    cycleId?: Id<"lifeos_pmCycles">;
  }) => {
    if (!selectedIssueId) return;

    // Handle project change with dedicated mutation
    if ("projectId" in updates) {
      await moveIssueToProject({ issueId: selectedIssueId, projectId: updates.projectId });
      return;
    }

    // Handle cycle change with dedicated mutation
    if ("cycleId" in updates) {
      await moveIssueToCycle({ issueId: selectedIssueId, cycleId: updates.cycleId });
      return;
    }

    // Handle other updates
    const { projectId, cycleId, ...otherUpdates } = updates;
    await updateIssue({ issueId: selectedIssueId, ...otherUpdates });
  };

  const handleDeleteClick = () => {
    if (!selectedIssueId) return;
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedIssueId) return;

    setIsDeleting(true);
    try {
      await deleteIssue({ issueId: selectedIssueId });
      setShowDeleteDialog(false);
      setSelectedIssueId(null);
    } catch (error) {
      console.error("Failed to delete issue:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
    <Sheet open={!!selectedIssueId} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent className="w-[600px] sm:max-w-[600px] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <SheetTitle className="text-sm font-normal text-muted-foreground">
            Issue Details
          </SheetTitle>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={handleDeleteClick}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Content */}
        {issue === undefined ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-muted-foreground">Loading...</span>
          </div>
        ) : issue === null ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-muted-foreground">Issue not found</span>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 overflow-auto p-4 space-y-6">
              <IssueHeader issue={issue} onUpdateTitle={handleUpdateTitle} />
              <IssueDescription
                description={issue.description}
                onSave={handleUpdateDescription}
              />
            </div>

            {/* Properties Sidebar */}
            <IssueProperties
              issue={issue}
              onUpdate={handleUpdate}
              onStatusChange={handleStatusChange}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Issue</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this issue? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
