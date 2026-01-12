import { useQuery } from "convex/react";
import { api } from "@holaai/convex";

// Note: These API paths will be available after running `convex codegen`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initiativesRollupApi = (api as any).lifeos.initiatives_rollup;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  InitiativeProgressBar,
  InitiativeProgressRing,
} from "@/components/initiatives/InitiativeProgressBar";
import { INITIATIVE_CATEGORIES } from "@/lib/contexts/InitiativesContext";
import { cn } from "@/lib/utils";
import {
  Rocket,
  FolderKanban,
  CheckSquare,
  Target,
  TrendingUp,
  Calendar,
  ChevronRight,
  Briefcase,
  Heart,
  BookOpen,
  Users,
  DollarSign,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

// Icon mapping
const CategoryIcons = {
  Briefcase,
  Heart,
  BookOpen,
  Users,
  DollarSign,
  Sparkles,
} as const;

interface YearlyViewProps {
  year: number;
}

export function YearlyView({ year }: YearlyViewProps) {
  const yearlyRollup = useQuery(initiativesRollupApi.getYearlyRollup, {
    year,
  });

  const categorySummary = useQuery(initiativesRollupApi.getCategorySummary, {
    year,
  });

  if (!yearlyRollup || !categorySummary) {
    return <YearlyViewSkeleton />;
  }

  const { initiatives, summary } = yearlyRollup;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Year Summary Header */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">{year} Overview</h2>
          <p className="text-muted-foreground">
            Your yearly initiatives and progress at a glance
          </p>
        </div>
        <Link to="/lifeos/initiatives">
          <Button variant="outline">
            <Rocket className="h-4 w-4 mr-2" />
            Manage Initiatives
          </Button>
        </Link>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Overall Progress
                </p>
                <p className="text-2xl font-bold">{summary.averageProgress}%</p>
              </div>
              <InitiativeProgressRing
                progress={summary.averageProgress}
                size={56}
                strokeWidth={4}
                showLabel={false}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Active Initiatives
                </p>
                <p className="text-2xl font-bold">
                  {summary.activeInitiatives}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / {summary.totalInitiatives}
                  </span>
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasks Completed</p>
                <p className="text-2xl font-bold">
                  {summary.totalTasksCompleted}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckSquare className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Habits</p>
                <p className="text-2xl font-bold">
                  {summary.totalHabitsCompleted}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Progress by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categorySummary.map(
              (cat: {
                category: string;
                label: string;
                color: string;
                icon: string;
                initiativeCount: number;
                averageProgress: number;
              }) => {
                const IconComponent =
                  CategoryIcons[cat.icon as keyof typeof CategoryIcons] ||
                  Sparkles;
                return (
                  <div
                    key={cat.category}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                  >
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${cat.color}20` }}
                    >
                      <IconComponent
                        className="h-5 w-5"
                        style={{ color: cat.color }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{cat.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {cat.initiativeCount} initiatives
                        </span>
                      </div>
                      <InitiativeProgressBar
                        progress={cat.averageProgress}
                        color={cat.color}
                        size="sm"
                        showLabel
                      />
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quarterly Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Quarterly Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((quarter) => {
              const isCurrentQuarter =
                year === new Date().getFullYear() &&
                Math.ceil((new Date().getMonth() + 1) / 3) === quarter;
              const isPast =
                year < new Date().getFullYear() ||
                (year === new Date().getFullYear() &&
                  Math.ceil((new Date().getMonth() + 1) / 3) > quarter);

              return (
                <div
                  key={quarter}
                  className={cn(
                    "p-4 rounded-lg border",
                    isCurrentQuarter && "ring-2 ring-primary bg-primary/5",
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Q{quarter}</span>
                    {isCurrentQuarter && (
                      <Badge variant="default" className="text-[10px]">
                        Current
                      </Badge>
                    )}
                    {isPast && !isCurrentQuarter && (
                      <Badge variant="secondary" className="text-[10px]">
                        Past
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getQuarterMonths(quarter)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Initiative Details */}
      {initiatives.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              All Initiatives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {initiatives.map(
                ({
                  initiative,
                  progress,
                  tasksCompleted,
                  tasksTotal,
                  habitsTotal,
                }: {
                  initiative: {
                    _id: string;
                    title: string;
                    category: string;
                    icon?: string;
                    color?: string;
                  };
                  progress: number;
                  tasksCompleted: number;
                  tasksTotal: number;
                  habitsTotal: number;
                }) => {
                  const categoryMeta =
                    INITIATIVE_CATEGORIES[
                      initiative.category as keyof typeof INITIATIVE_CATEGORIES
                    ];
                  const IconComponent =
                    CategoryIcons[
                      categoryMeta?.icon as keyof typeof CategoryIcons
                    ] || Sparkles;
                  const displayColor =
                    initiative.color || categoryMeta?.color || "#6366f1";

                  return (
                    <div
                      key={initiative._id}
                      className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${displayColor}20` }}
                      >
                        {initiative.icon ? (
                          <span className="text-lg">{initiative.icon}</span>
                        ) : (
                          <IconComponent
                            className="h-5 w-5"
                            style={{ color: displayColor }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">
                            {initiative.title}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] shrink-0"
                          >
                            {categoryMeta?.label || initiative.category}
                          </Badge>
                        </div>
                        <InitiativeProgressBar
                          progress={progress}
                          color={displayColor}
                          size="sm"
                        />
                      </div>
                      <div className="text-right text-xs text-muted-foreground shrink-0">
                        <div className="flex items-center gap-1">
                          <CheckSquare className="h-3 w-3" />
                          {tasksCompleted}/{tasksTotal}
                        </div>
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {habitsTotal} habits
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  );
                },
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Rocket className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">
              No initiatives for {year}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first initiative to start tracking your yearly goals.
            </p>
            <Link to="/lifeos/initiatives">
              <Button>
                <Rocket className="h-4 w-4 mr-2" />
                Create Initiative
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function YearlyViewSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[100px]" />
        ))}
      </div>
      <Skeleton className="h-[200px]" />
      <Skeleton className="h-[300px]" />
    </div>
  );
}

function getQuarterMonths(quarter: number): string {
  const months = [
    ["Jan", "Feb", "Mar"],
    ["Apr", "May", "Jun"],
    ["Jul", "Aug", "Sep"],
    ["Oct", "Nov", "Dec"],
  ];
  return months[quarter - 1].join(" - ");
}
