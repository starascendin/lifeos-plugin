import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Doc, Id } from "@holaai/convex";
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Progress } from "@/components/ui/progress";
import { DescriptionEditor } from "@/components/shared/DescriptionEditor";
import { PhaseStatusSelect } from "../shared";
import { PhaseIssuesList } from "./PhaseIssuesList";
import { PHASE_STATUS_CONFIG, PhaseStatus } from "@/lib/contexts/PMContext";

interface PhaseCardProps {
  phase: Doc<"lifeos_pmPhases">;
  issues: Doc<"lifeos_pmIssues">[];
  onAddIssue?: (phaseId: Id<"lifeos_pmPhases">) => void;
}

export function PhaseCard({ phase, issues, onAddIssue }: PhaseCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const updatePhase = useMutation(api.lifeos.pm_phases.updatePhase);
  const deletePhase = useMutation(api.lifeos.pm_phases.deletePhase);

  // Calculate progress
  const totalIssues = issues.length;
  const completedIssues = issues.filter((i) => i.status === "done").length;
  const progressPercent = totalIssues > 0 ? (completedIssues / totalIssues) * 100 : 0;

  const handleSaveDescription = async (value: string) => {
    await updatePhase({
      phaseId: phase._id,
      description: value || undefined,
    });
  };

  const handleStatusChange = async (status: PhaseStatus) => {
    await updatePhase({ phaseId: phase._id, status });
  };

  const handleDelete = async () => {
    await deletePhase({ phaseId: phase._id });
    setShowDeleteDialog(false);
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>

          <Layers className="h-4 w-4 text-muted-foreground" />

          <span className="font-medium flex-1">{phase.name}</span>

          {/* Status */}
          <div onClick={(e) => e.stopPropagation()}>
            <PhaseStatusSelect
              value={phase.status as PhaseStatus}
              onChange={handleStatusChange}
              size="sm"
            />
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 w-32">
            <Progress value={progressPercent} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {completedIssues}/{totalIssues}
            </span>
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete phase
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="px-4 py-3 space-y-4">
            {/* Description */}
            <DescriptionEditor
              value={phase.description ?? ""}
              onSave={handleSaveDescription}
              placeholder="Add phase description, goals, or notes..."
            />

            {/* Issues */}
            <PhaseIssuesList
              issues={issues}
              onAddIssue={onAddIssue ? () => onAddIssue(phase._id) : undefined}
            />
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Phase</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{phase.name}"? Issues in this phase will
              be unlinked but not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
