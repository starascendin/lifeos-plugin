import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Doc, Id } from "@holaai/convex";
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Edit2,
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
import { TiptapEditor } from "@/components/shared/TiptapEditor";
import { PhaseStatusSelect } from "../shared";
import { PhaseIssuesList } from "./PhaseIssuesList";
import { PHASE_STATUS_CONFIG, PhaseStatus } from "@/lib/contexts/PMContext";
import { cn } from "@/lib/utils";

interface PhaseCardProps {
  phase: Doc<"lifeos_pmPhases">;
  issues: Doc<"lifeos_pmIssues">[];
  onAddIssue?: (phaseId: Id<"lifeos_pmPhases">) => void;
}

export function PhaseCard({ phase, issues, onAddIssue }: PhaseCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(phase.description ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>(phase.description ?? "");

  const updatePhase = useMutation(api.lifeos.pm_phases.updatePhase);
  const deletePhase = useMutation(api.lifeos.pm_phases.deletePhase);

  // Calculate progress
  const totalIssues = issues.length;
  const completedIssues = issues.filter((i) => i.status === "done").length;
  const progressPercent = totalIssues > 0 ? (completedIssues / totalIssues) * 100 : 0;

  // Sync description when phase changes
  useEffect(() => {
    if (phase.description !== undefined && lastSavedRef.current !== phase.description) {
      setDescription(phase.description ?? "");
      lastSavedRef.current = phase.description ?? "";
    }
  }, [phase.description]);

  // Debounced auto-save for description
  useEffect(() => {
    if (!isEditing) return;
    if (description === lastSavedRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await updatePhase({
          phaseId: phase._id,
          description: description || undefined,
        });
        lastSavedRef.current = description;
      } finally {
        setIsSaving(false);
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [description, isEditing, phase._id, updatePhase]);

  const handleStatusChange = async (status: PhaseStatus) => {
    await updatePhase({ phaseId: phase._id, status });
  };

  const handleDelete = async () => {
    await deletePhase({ phaseId: phase._id });
    setShowDeleteDialog(false);
  };

  const statusConfig = PHASE_STATUS_CONFIG[phase.status as PhaseStatus];

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
              <DropdownMenuItem onClick={() => setIsEditing(!isEditing)}>
                <Edit2 className="h-4 w-4 mr-2" />
                {isEditing ? "Done editing" : "Edit description"}
              </DropdownMenuItem>
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
            {(isEditing || description) && (
              <div className="relative">
                {isEditing ? (
                  <>
                    <TiptapEditor
                      content={description}
                      onChange={setDescription}
                      placeholder="Add phase description, goals, or notes..."
                    />
                    {isSaving && (
                      <span className="absolute top-0 right-0 text-xs text-muted-foreground">
                        Saving...
                      </span>
                    )}
                  </>
                ) : (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground cursor-pointer hover:bg-muted/30 rounded-md p-2 -m-2"
                    onClick={() => setIsEditing(true)}
                    dangerouslySetInnerHTML={{ __html: description }}
                  />
                )}
              </div>
            )}

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
