import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useInitiatives,
  INITIATIVE_CATEGORIES,
  type InitiativeCategory,
} from "@/lib/contexts/InitiativesContext";
import { InitiativeCard } from "./InitiativeCard";
import { InitiativeForm } from "./InitiativeForm";
import { InitiativeProgressRing } from "./InitiativeProgressBar";
import { Plus, Rocket, Filter, LayoutGrid, List } from "lucide-react";
import type { Doc, Id } from "@holaai/convex";

export function InitiativesTab() {
  const navigate = useNavigate();
  const {
    selectedYear,
    setSelectedYear,
    availableYears,
    initiatives,
    isLoading,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    editingInitiative,
    setEditingInitiative,
    archiveInitiative,
    deleteInitiative,
  } = useInitiatives();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [categoryFilter, setCategoryFilter] = useState<
    InitiativeCategory | "all"
  >("all");
  const [deleteConfirmId, setDeleteConfirmId] =
    useState<Id<"lifeos_yearlyInitiatives"> | null>(null);

  // Filter initiatives
  const filteredInitiatives = initiatives?.filter((i) => {
    if (categoryFilter === "all") return true;
    return i.category === categoryFilter;
  });

  // Calculate summary stats
  const summary = initiatives
    ? {
        total: initiatives.length,
        active: initiatives.filter((i) => i.status === "active").length,
        averageProgress:
          initiatives.length > 0
            ? Math.round(
                initiatives.reduce((sum, i) => sum + i.calculatedProgress, 0) /
                  initiatives.length,
              )
            : 0,
        totalTasks: initiatives.reduce((sum, i) => sum + i.taskCount, 0),
        completedTasks: initiatives.reduce(
          (sum, i) => sum + i.completedTaskCount,
          0,
        ),
      }
    : null;

  const handleEdit = (
    initiative: typeof initiatives extends (infer T)[] | undefined ? T : never,
  ) => {
    setEditingInitiative(initiative as Doc<"lifeos_yearlyInitiatives">);
  };

  const handleArchive = async (id: Id<"lifeos_yearlyInitiatives">) => {
    try {
      await archiveInitiative({ initiativeId: id });
    } catch (error) {
      console.error("Failed to archive initiative:", error);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteInitiative({ initiativeId: deleteConfirmId });
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Failed to delete initiative:", error);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 md:px-6 md:py-4">
        <div className="flex flex-col gap-3">
          {/* Title row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Rocket className="h-6 w-6 text-primary" />
              <h1 className="text-xl md:text-2xl font-semibold">
                Yearly Initiatives
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Year selector */}
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears?.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Category filter */}
              <Select
                value={categoryFilter}
                onValueChange={(v) =>
                  setCategoryFilter(v as InitiativeCategory | "all")
                }
              >
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(INITIATIVE_CATEGORIES).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View toggle */}
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-9 w-9 rounded-r-none"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-9 w-9 rounded-l-none"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              {/* Add button */}
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Initiative
              </Button>
            </div>
          </div>

          {/* Summary stats */}
          {summary && (
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <InitiativeProgressRing
                  progress={summary.averageProgress}
                  size={36}
                  strokeWidth={3}
                />
                <div>
                  <div className="font-medium">{summary.averageProgress}%</div>
                  <div className="text-xs text-muted-foreground">
                    Avg Progress
                  </div>
                </div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <div className="font-medium">
                  {summary.active} / {summary.total}
                </div>
                <div className="text-xs text-muted-foreground">
                  Active Initiatives
                </div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <div className="font-medium">
                  {summary.completedTasks} / {summary.totalTasks}
                </div>
                <div className="text-xs text-muted-foreground">
                  Tasks Completed
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {isLoading ? (
          <div
            className={
              viewMode === "grid"
                ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                : "space-y-3"
            }
          >
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-[180px] rounded-lg" />
            ))}
          </div>
        ) : filteredInitiatives && filteredInitiatives.length > 0 ? (
          <div
            className={
              viewMode === "grid"
                ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                : "space-y-3 max-w-3xl"
            }
          >
            {filteredInitiatives.map((initiative) => (
              <InitiativeCard
                key={initiative._id}
                initiative={initiative}
                onClick={() =>
                  navigate(`/lifeos/initiatives/${initiative._id}`)
                }
                onEdit={() => handleEdit(initiative)}
                onArchive={() => handleArchive(initiative._id)}
                onDelete={() => setDeleteConfirmId(initiative._id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <Rocket className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">No initiatives yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {categoryFilter !== "all"
                ? `No ${INITIATIVE_CATEGORIES[categoryFilter].label.toLowerCase()} initiatives for ${selectedYear}.`
                : `Create your first ${selectedYear} initiative to start tracking your yearly goals.`}
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Initiative
            </Button>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <InitiativeForm
        open={isCreateDialogOpen || !!editingInitiative}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingInitiative(null);
          }
        }}
        initiative={editingInitiative}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Initiative?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this initiative. Linked projects and
              habits will be unlinked but not deleted. This action cannot be
              undone.
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
    </div>
  );
}
