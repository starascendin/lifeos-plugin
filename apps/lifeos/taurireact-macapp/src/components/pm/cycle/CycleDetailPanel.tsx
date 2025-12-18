import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { X, Trash2, RefreshCw, Clock, Play, CheckCircle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  usePM,
  CycleStatus,
  CycleRetrospective,
} from "@/lib/contexts/PMContext";
import { CycleGoalsEditor } from "./CycleGoalsEditor";
import { CycleRetrospectiveForm } from "./CycleRetrospectiveForm";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  CycleStatus,
  { label: string; icon: typeof Clock; color: string; bg: string }
> = {
  upcoming: {
    label: "Upcoming",
    icon: Clock,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  active: {
    label: "Active",
    icon: Play,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color: "text-gray-500",
    bg: "bg-gray-500/10",
  },
};

export function CycleDetailPanel() {
  const {
    selectedCycleForDetail,
    setSelectedCycleForDetail,
    updateCycle,
    deleteCycle,
  } = usePM();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const cycle = useQuery(
    api.lifeos.pm_cycles.getCycle,
    selectedCycleForDetail ? { cycleId: selectedCycleForDetail } : "skip"
  );

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedCycleForDetail(null);
      }
    };

    if (selectedCycleForDetail) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [selectedCycleForDetail, setSelectedCycleForDetail]);

  const handleClose = () => {
    setSelectedCycleForDetail(null);
  };

  const handleUpdateGoals = async (goals: string[]) => {
    if (!selectedCycleForDetail) return;
    await updateCycle({ cycleId: selectedCycleForDetail, goals });
  };

  const handleUpdateRetrospective = async (
    retrospective: CycleRetrospective
  ) => {
    if (!selectedCycleForDetail) return;
    await updateCycle({ cycleId: selectedCycleForDetail, retrospective });
  };

  const handleDeleteClick = () => {
    if (!selectedCycleForDetail) return;
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedCycleForDetail) return;

    setIsDeleting(true);
    try {
      await deleteCycle({ cycleId: selectedCycleForDetail });
      setShowDeleteDialog(false);
      setSelectedCycleForDetail(null);
    } catch (error) {
      console.error("Failed to delete cycle:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateRange = (start: number, end: number) => {
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  return (
    <>
    <Sheet
      open={!!selectedCycleForDetail}
      onOpenChange={(open) => !open && handleClose()}
    >
      <SheetContent className="flex w-[500px] flex-col p-0 sm:max-w-[500px]">
        {/* Header */}
        <SheetHeader className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <SheetTitle className="text-sm font-normal text-muted-foreground">
            Cycle Details
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
        {cycle === undefined ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-muted-foreground">Loading...</span>
          </div>
        ) : cycle === null ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-muted-foreground">Cycle not found</span>
          </div>
        ) : (
          <div className="flex-1 space-y-6 overflow-auto p-4">
            {/* Cycle Header */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full",
                    STATUS_CONFIG[cycle.status as CycleStatus].bg
                  )}
                >
                  <RefreshCw
                    className={cn(
                      "h-5 w-5",
                      STATUS_CONFIG[cycle.status as CycleStatus].color
                    )}
                  />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {cycle.name || `Cycle ${cycle.number}`}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {formatDateRange(cycle.startDate, cycle.endDate)}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    STATUS_CONFIG[cycle.status as CycleStatus].color,
                    STATUS_CONFIG[cycle.status as CycleStatus].bg
                  )}
                >
                  {(() => {
                    const StatusIcon =
                      STATUS_CONFIG[cycle.status as CycleStatus].icon;
                    return <StatusIcon className="mr-1 h-3 w-3" />;
                  })()}
                  {STATUS_CONFIG[cycle.status as CycleStatus].label}
                </Badge>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Progress</span>
                <span className="text-muted-foreground">
                  {cycle.completedIssueCount} of {cycle.issueCount} issues
                </span>
              </div>
              <Progress
                value={
                  cycle.issueCount > 0
                    ? Math.round(
                        (cycle.completedIssueCount / cycle.issueCount) * 100
                      )
                    : 0
                }
                className="h-2"
              />
            </div>

            {/* Goals */}
            <CycleGoalsEditor
              goals={cycle.goals}
              onSave={handleUpdateGoals}
              readOnly={cycle.status === "completed"}
            />

            {/* Retrospective */}
            <CycleRetrospectiveForm
              retrospective={cycle.retrospective as CycleRetrospective | undefined}
              onSave={handleUpdateRetrospective}
              cycleStatus={cycle.status as CycleStatus}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Cycle</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this cycle? Issues will be
            unassigned from this cycle but not deleted.
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
