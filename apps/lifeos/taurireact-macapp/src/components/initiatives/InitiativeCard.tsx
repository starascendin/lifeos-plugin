import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  INITIATIVE_CATEGORIES,
  type InitiativeWithStats,
} from "@/lib/contexts/InitiativesContext";
import { InitiativeProgressBar } from "./InitiativeProgressBar";
import { cn } from "@/lib/utils";
import {
  MoreHorizontal,
  Pencil,
  Archive,
  Trash2,
  FolderKanban,
  Target,
  CheckSquare,
  Briefcase,
  Heart,
  BookOpen,
  Users,
  DollarSign,
  Sparkles,
  Pause,
  Play,
  CheckCircle,
} from "lucide-react";

// Icon mapping for categories
const CategoryIcons = {
  Briefcase,
  Heart,
  BookOpen,
  Users,
  DollarSign,
  Sparkles,
} as const;

interface InitiativeCardProps {
  initiative: InitiativeWithStats;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onClick?: () => void;
}

export function InitiativeCard({
  initiative,
  onEdit,
  onArchive,
  onDelete,
  onClick,
}: InitiativeCardProps) {
  const categoryMeta = INITIATIVE_CATEGORIES[initiative.category];
  const IconComponent =
    CategoryIcons[categoryMeta.icon as keyof typeof CategoryIcons] || Sparkles;
  const displayColor = initiative.color || categoryMeta.color;

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

  const status = statusConfig[initiative.status];
  const StatusIcon = status.icon;

  return (
    <Card
      className={cn(
        "group relative cursor-pointer transition-all hover:shadow-md",
        "border-l-4",
      )}
      style={{ borderLeftColor: displayColor }}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${displayColor}20` }}
            >
              {initiative.icon ? (
                <span className="text-lg">{initiative.icon}</span>
              ) : (
                <IconComponent
                  className="h-4 w-4"
                  style={{ color: displayColor }}
                />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">
                {initiative.title}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {categoryMeta.label}
                </Badge>
                <Badge
                  className={cn("text-[10px] px-1.5 py-0", status.className)}
                >
                  <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                  {status.label}
                </Badge>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        {initiative.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {initiative.description}
          </p>
        )}

        {/* Progress bar */}
        <InitiativeProgressBar
          progress={initiative.calculatedProgress}
          color={displayColor}
          size="sm"
          className="mb-3"
        />

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <FolderKanban className="h-3.5 w-3.5" />
            <span>{initiative.projectCount} projects</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckSquare className="h-3.5 w-3.5" />
            <span>
              {initiative.completedTaskCount}/{initiative.taskCount} tasks
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Target className="h-3.5 w-3.5" />
            <span>{initiative.habitCount} habits</span>
          </div>
        </div>

        {/* Target metric if set */}
        {initiative.targetMetric && (
          <div className="mt-2 text-xs text-muted-foreground italic">
            Target: {initiative.targetMetric}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact version for sidebar or small spaces
interface InitiativeCardCompactProps {
  initiative: InitiativeWithStats;
  onClick?: () => void;
  isSelected?: boolean;
}

export function InitiativeCardCompact({
  initiative,
  onClick,
  isSelected,
}: InitiativeCardCompactProps) {
  const categoryMeta = INITIATIVE_CATEGORIES[initiative.category];
  const displayColor = initiative.color || categoryMeta.color;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors",
        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
      )}
    >
      <div
        className="w-1 h-8 rounded-full shrink-0"
        style={{ backgroundColor: displayColor }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {initiative.icon && (
            <span className="text-sm">{initiative.icon}</span>
          )}
          <span className="text-sm font-medium truncate">
            {initiative.title}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <InitiativeProgressBar
            progress={initiative.calculatedProgress}
            color={displayColor}
            size="sm"
            showLabel={false}
            className="flex-1"
          />
          <span className="text-[10px] text-muted-foreground">
            {Math.round(initiative.calculatedProgress)}%
          </span>
        </div>
      </div>
    </button>
  );
}
