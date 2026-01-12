import { useQuery } from "convex/react";
import { api } from "@holaai/convex";

// Note: These API paths will be available after running `convex codegen`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initiativesRollupApi = (api as any).lifeos.initiatives_rollup;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InitiativeProgressBar } from "@/components/initiatives/InitiativeProgressBar";
import { INITIATIVE_CATEGORIES } from "@/lib/contexts/InitiativesContext";
import { cn } from "@/lib/utils";
import {
  Rocket,
  CheckSquare,
  Target,
  Calendar,
  Briefcase,
  Heart,
  BookOpen,
  Users,
  DollarSign,
  Sparkles,
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

interface MonthlyViewProps {
  year: number;
  month: number;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function MonthlyView({ year, month }: MonthlyViewProps) {
  const monthlyRollup = useQuery(initiativesRollupApi.getMonthlyRollup, {
    year,
    month,
  });

  if (!monthlyRollup) {
    return <MonthlyViewSkeleton />;
  }

  const { initiatives, summary, monthStart, monthEnd } = monthlyRollup;

  // Generate calendar grid for the month
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

  const calendarDays: (number | null)[] = [];
  // Add empty cells for days before the 1st
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }
  // Add days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const today = new Date();
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth() + 1;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Month Header */}
      <div>
        <h2 className="text-2xl font-bold">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <p className="text-muted-foreground">
          {monthStart} to {monthEnd}
        </p>
      </div>

      {/* Month Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasks Completed</p>
                <p className="text-2xl font-bold">
                  {summary.totalTasksCompleted}
                </p>
                <p className="text-xs text-muted-foreground">this month</p>
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
                <p className="text-xs text-muted-foreground">this month</p>
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
                <p className="text-2xl font-bold">
                  {
                    initiatives.filter(
                      (i: {
                        monthTasksCompleted: number;
                        monthHabitCompletions: number;
                      }) =>
                        i.monthTasksCompleted > 0 ||
                        i.monthHabitCompletions > 0,
                    ).length
                  }
                </p>
                <p className="text-xs text-muted-foreground">worked on</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar View */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
            {/* Calendar days */}
            {calendarDays.map((day, idx) => {
              const isToday = isCurrentMonth && day === today.getDate();
              return (
                <div
                  key={idx}
                  className={cn(
                    "aspect-square p-1 text-center text-sm rounded-md",
                    day && "hover:bg-accent cursor-pointer",
                    isToday && "bg-primary text-primary-foreground font-bold",
                  )}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Initiative Activity This Month */}
      {initiatives.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Initiative Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {initiatives.map(
                ({
                  initiative,
                  monthTasksCompleted,
                  monthHabitCompletions,
                }: {
                  initiative: {
                    _id: string;
                    title: string;
                    category: string;
                    icon?: string;
                    color?: string;
                  };
                  monthTasksCompleted: number;
                  monthHabitCompletions: number;
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
                  const hasActivity =
                    monthTasksCompleted > 0 || monthHabitCompletions > 0;

                  return (
                    <div
                      key={initiative._id}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-lg border",
                        !hasActivity && "opacity-50",
                      )}
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
                        <div className="font-medium truncate">
                          {initiative.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {categoryMeta?.label || initiative.category}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckSquare className="h-4 w-4" />
                          <span>{monthTasksCompleted}</span>
                        </div>
                        <div className="flex items-center gap-1 text-amber-600">
                          <Target className="h-4 w-4" />
                          <span>{monthHabitCompletions}</span>
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
              No initiatives have been worked on this month yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MonthlyViewSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <Skeleton className="h-8 w-40 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-[100px]" />
        ))}
      </div>
      <Skeleton className="h-[300px]" />
      <Skeleton className="h-[200px]" />
    </div>
  );
}
