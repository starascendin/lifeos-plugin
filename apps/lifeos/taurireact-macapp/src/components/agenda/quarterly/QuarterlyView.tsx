import { useQuery } from "convex/react";
import { api } from "@holaai/convex";

// Note: These API paths will be available after running `convex codegen`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initiativesRollupApi = (api as any).lifeos.initiatives_rollup;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InitiativeProgressBar,
  InitiativeProgressRing,
} from "@/components/initiatives/InitiativeProgressBar";
import { INITIATIVE_CATEGORIES } from "@/lib/contexts/InitiativesContext";
import { cn } from "@/lib/utils";
import {
  Rocket,
  CheckSquare,
  Target,
  TrendingUp,
  Briefcase,
  Heart,
  BookOpen,
  Users,
  DollarSign,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";

// Icon mapping
const CategoryIcons = {
  Briefcase,
  Heart,
  BookOpen,
  Users,
  DollarSign,
  Sparkles,
} as const;

interface QuarterlyViewProps {
  year: number;
  quarter: number;
}

export function QuarterlyView({ year, quarter }: QuarterlyViewProps) {
  const quarterlyRollup = useQuery(initiativesRollupApi.getQuarterlyRollup, {
    year,
    quarter,
  });

  if (!quarterlyRollup) {
    return <QuarterlyViewSkeleton />;
  }

  const { initiatives, summary, quarterStart, quarterEnd } = quarterlyRollup;

  const quarterNames = ["Q1", "Q2", "Q3", "Q4"];
  const monthNames = [
    ["January", "February", "March"],
    ["April", "May", "June"],
    ["July", "August", "September"],
    ["October", "November", "December"],
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Quarter Header */}
      <div>
        <h2 className="text-2xl font-bold">
          {quarterNames[quarter - 1]} {year}
        </h2>
        <p className="text-muted-foreground">
          {monthNames[quarter - 1].join(", ")} ({quarterStart} to {quarterEnd})
        </p>
      </div>

      {/* Quarter Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasks Completed</p>
                <p className="text-2xl font-bold">
                  {summary.totalTasksCompleted}
                </p>
                <p className="text-xs text-muted-foreground">this quarter</p>
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
                <p className="text-sm text-muted-foreground">Habit Check-ins</p>
                <p className="text-2xl font-bold">
                  {summary.totalHabitCompletions}
                </p>
                <p className="text-xs text-muted-foreground">this quarter</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-amber-500" />
              </div>
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
                <p className="text-2xl font-bold">{initiatives.length}</p>
                <p className="text-xs text-muted-foreground">being tracked</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Monthly Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {monthNames[quarter - 1].map((month, idx) => {
              const monthNum = (quarter - 1) * 3 + idx + 1;
              const isCurrentMonth =
                year === new Date().getFullYear() &&
                monthNum === new Date().getMonth() + 1;
              const isPast =
                year < new Date().getFullYear() ||
                (year === new Date().getFullYear() &&
                  monthNum < new Date().getMonth() + 1);

              return (
                <div
                  key={month}
                  className={cn(
                    "p-4 rounded-lg border text-center",
                    isCurrentMonth && "ring-2 ring-primary bg-primary/5",
                  )}
                >
                  <div className="font-semibold">{month}</div>
                  {isCurrentMonth && (
                    <Badge variant="default" className="mt-1 text-[10px]">
                      Current
                    </Badge>
                  )}
                  {isPast && !isCurrentMonth && (
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      Completed
                    </Badge>
                  )}
                  {!isPast && !isCurrentMonth && (
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      Upcoming
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Initiative Progress This Quarter */}
      {initiatives.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Initiative Progress This Quarter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {initiatives.map(
                ({
                  initiative,
                  quarterTasksCompleted,
                  quarterHabitCompletions,
                  totalTasks,
                  totalHabits,
                }: {
                  initiative: {
                    _id: string;
                    title: string;
                    category: string;
                    icon?: string;
                    color?: string;
                  };
                  quarterTasksCompleted: number;
                  quarterHabitCompletions: number;
                  totalTasks: number;
                  totalHabits: number;
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
                      className="p-4 rounded-lg border space-y-3"
                    >
                      <div className="flex items-center gap-3">
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
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">
                            {initiative.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {categoryMeta?.label || initiative.category}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                          <div className="flex items-center gap-2 text-green-600 mb-1">
                            <CheckSquare className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              Tasks Completed
                            </span>
                          </div>
                          <div className="text-2xl font-bold">
                            {quarterTasksCompleted}
                            <span className="text-sm font-normal text-muted-foreground">
                              {" "}
                              / {totalTasks} total
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                          <div className="flex items-center gap-2 text-amber-600 mb-1">
                            <Target className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              Habit Check-ins
                            </span>
                          </div>
                          <div className="text-2xl font-bold">
                            {quarterHabitCompletions}
                            <span className="text-sm font-normal text-muted-foreground">
                              {" "}
                              ({totalHabits} habits)
                            </span>
                          </div>
                        </div>
                      </div>
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
            <h3 className="text-lg font-medium mb-1">No initiative activity</h3>
            <p className="text-sm text-muted-foreground">
              No initiatives have been worked on this quarter yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function QuarterlyViewSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-[100px]" />
        ))}
      </div>
      <Skeleton className="h-[150px]" />
      <Skeleton className="h-[300px]" />
    </div>
  );
}
