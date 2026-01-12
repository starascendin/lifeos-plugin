import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Id, Doc } from "@holaai/convex";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  InitiativeProgressBar,
  InitiativeProgressRing,
} from "./InitiativeProgressBar";
import { InitiativeForm } from "./InitiativeForm";
import {
  INITIATIVE_CATEGORIES,
  type InitiativeCategory,
} from "@/lib/contexts/InitiativesContext";
import { useState } from "react";
import {
  ArrowLeft,
  Pencil,
  Archive,
  Trash2,
  MoreHorizontal,
  FolderKanban,
  Target,
  CheckSquare,
  ExternalLink,
  LinkIcon,
  Plus,
  Briefcase,
  Heart,
  BookOpen,
  Users,
  DollarSign,
  Sparkles,
  Play,
  Pause,
  CheckCircle,
} from "lucide-react";

// Note: These API paths will be available after running `convex codegen`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initiativesApi = (api as any).lifeos.initiatives;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pmProjectsApi = (api as any).lifeos.pm_projects;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const habitsApi = (api as any).lifeos.habits;

// Icon mapping for categories
const CategoryIcons = {
  Briefcase,
  Heart,
  BookOpen,
  Users,
  DollarSign,
  Sparkles,
} as const;

const statusConfig = {
  active: {
    label: "Active",
    icon: Play,
    className: "bg-green-500/10 text-green-600",
  },
  paused: {
    label: "Paused",
    icon: Pause,
    className: "bg-yellow-500/10 text-yellow-600",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "bg-blue-500/10 text-blue-600",
  },
  cancelled: {
    label: "Cancelled",
    icon: Archive,
    className: "bg-gray-500/10 text-gray-600",
  },
};

interface InitiativeDetailViewProps {
  initiativeId: Id<"lifeos_yearlyInitiatives">;
}

export function InitiativeDetailView({
  initiativeId,
}: InitiativeDetailViewProps) {
  const navigate = useNavigate();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Queries
  const initiative = useQuery(initiativesApi.getInitiative, { initiativeId });
  const linkedProjects = useQuery(pmProjectsApi.getProjectsByInitiative, {
    initiativeId,
  });
  const linkedHabits = useQuery(habitsApi.getHabitsByInitiative, {
    initiativeId,
  });

  // Mutations
  const archiveInitiative = useMutation(initiativesApi.archiveInitiative);
  const deleteInitiative = useMutation(initiativesApi.deleteInitiative);

  // Loading state
  if (initiative === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading initiative...</div>
      </div>
    );
  }

  // Not found state
  if (initiative === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-muted-foreground">Initiative not found</div>
        <Button
          variant="outline"
          onClick={() => navigate("/lifeos/initiatives")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Initiatives
        </Button>
      </div>
    );
  }

  const categoryMeta =
    INITIATIVE_CATEGORIES[initiative.category as InitiativeCategory];
  const IconComponent =
    CategoryIcons[categoryMeta.icon as keyof typeof CategoryIcons] || Sparkles;
  const displayColor = initiative.color || categoryMeta.color;
  const status = statusConfig[initiative.status as keyof typeof statusConfig];
  const StatusIcon = status.icon;

  // Calculate stats
  const projectCount = linkedProjects?.length ?? 0;
  const habitCount = linkedHabits?.length ?? 0;
  let totalTasks = 0;
  let completedTasks = 0;
  for (const project of linkedProjects ?? []) {
    totalTasks += project.issueCount ?? 0;
    completedTasks += project.completedIssueCount ?? 0;
  }
  const autoProgress =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const calculatedProgress = initiative.manualProgress ?? autoProgress;

  const handleArchive = async () => {
    await archiveInitiative({ initiativeId });
    navigate("/lifeos/initiatives");
  };

  const handleDelete = async () => {
    await deleteInitiative({ initiativeId });
    setShowDeleteConfirm(false);
    navigate("/lifeos/initiatives");
  };

  const handleProjectClick = (projectId: Id<"lifeos_pmProjects">) => {
    navigate(`/lifeos/pm/projects/${projectId}`);
  };

  const handleHabitClick = () => {
    navigate("/lifeos/habits");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/lifeos/initiatives")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${displayColor}20` }}
              >
                {initiative.icon ? (
                  <span className="text-xl">{initiative.icon}</span>
                ) : (
                  <IconComponent
                    className="h-5 w-5"
                    style={{ color: displayColor }}
                  />
                )}
              </div>
              <div>
                <h1 className="text-xl font-semibold">{initiative.title}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-xs">
                    {categoryMeta.label}
                  </Badge>
                  <Badge className={status.className}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {status.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {initiative.year}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleArchive}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Progress Overview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Progress Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <InitiativeProgressRing
                  progress={calculatedProgress}
                  size={100}
                  strokeWidth={8}
                  color={displayColor}
                />
                <div className="flex-1 space-y-4">
                  <InitiativeProgressBar
                    progress={calculatedProgress}
                    color={displayColor}
                    size="lg"
                  />
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">{projectCount}</div>
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <FolderKanban className="h-3 w-3" />
                        Projects
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">
                        {completedTasks}/{totalTasks}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <CheckSquare className="h-3 w-3" />
                        Tasks
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{habitCount}</div>
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <Target className="h-3 w-3" />
                        Habits
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {initiative.description && (
                <>
                  <div className="my-4 h-px bg-border" />
                  <p className="text-sm text-muted-foreground">
                    {initiative.description}
                  </p>
                </>
              )}

              {initiative.targetMetric && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">
                    Target Metric
                  </div>
                  <div className="text-sm font-medium">
                    {initiative.targetMetric}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked Projects */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderKanban className="h-4 w-4" />
                  Linked Projects ({projectCount})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/lifeos/pm/projects")}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Link Project
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {linkedProjects && linkedProjects.length > 0 ? (
                <div className="space-y-2">
                  {linkedProjects.map((project: Doc<"lifeos_pmProjects">) => (
                    <button
                      key={project._id}
                      onClick={() => handleProjectClick(project._id)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-2 h-8 rounded-full"
                          style={{ backgroundColor: displayColor }}
                        />
                        <div>
                          <div className="font-medium text-sm">
                            {project.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {project.completedIssueCount ?? 0}/
                            {project.issueCount ?? 0} tasks
                          </div>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <LinkIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No projects linked yet</p>
                  <p className="text-xs">
                    Link projects to track progress toward this initiative
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked Habits */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Linked Habits ({habitCount})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/lifeos/habits")}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Link Habit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {linkedHabits && linkedHabits.length > 0 ? (
                <div className="space-y-2">
                  {linkedHabits.map((habit: Doc<"lifeos_habits">) => (
                    <button
                      key={habit._id}
                      onClick={handleHabitClick}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-2 h-8 rounded-full"
                          style={{ backgroundColor: displayColor }}
                        />
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {habit.icon && <span>{habit.icon}</span>}
                            {habit.name}
                          </div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {habit.frequency} habit
                          </div>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No habits linked yet</p>
                  <p className="text-xs">
                    Link habits to build consistency toward this initiative
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <InitiativeForm
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        initiative={initiative}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Initiative?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{initiative.title}&quot;.
              Linked projects and habits will be unlinked but not deleted. This
              action cannot be undone.
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
