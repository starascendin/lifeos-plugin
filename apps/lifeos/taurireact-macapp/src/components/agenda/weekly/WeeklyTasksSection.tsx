import { useState } from "react";
import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  CheckSquare,
  Circle,
  CheckCircle2,
  Clock,
  ChevronDown,
  Trophy,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Doc } from "@holaai/convex";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "urgent":
      return "text-red-500";
    case "high":
      return "text-orange-500";
    case "medium":
      return "text-yellow-500";
    case "low":
      return "text-blue-500";
    default:
      return "text-muted-foreground";
  }
}

function TaskItem({
  task,
  showPoints = false,
}: {
  task: Doc<"lifeos_pmIssues">;
  showPoints?: boolean;
}) {
  const isDone = task.status === "done";

  return (
    <div
      className={cn("flex items-start gap-2 py-1.5", isDone && "opacity-75")}
    >
      {isDone ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
      ) : (
        <Circle
          className={cn(
            "h-4 w-4 mt-0.5 flex-shrink-0",
            getPriorityColor(task.priority)
          )}
        />
      )}
      <span
        className={cn(
          "text-sm leading-tight flex-1",
          isDone && "line-through text-muted-foreground"
        )}
      >
        {task.title}
      </span>
      {showPoints && task.estimate && task.estimate > 0 && (
        <Badge variant="outline" className="text-xs ml-2">
          {task.estimate} pts
        </Badge>
      )}
    </div>
  );
}

function DayTaskGroup({
  date,
  dayIndex,
  tasks,
}: {
  date: string;
  dayIndex: number;
  tasks: Doc<"lifeos_pmIssues">[];
}) {
  const dayDate = new Date(date);
  const dayNum = dayDate.getDate();
  const monthName = dayDate.toLocaleDateString("en-US", { month: "short" });

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{DAY_NAMES[dayIndex]}</span>
          <span className="text-xs text-muted-foreground">
            {monthName} {dayNum}
          </span>
        </div>
        <Badge variant="outline" className="text-xs">
          {tasks.length} task{tasks.length !== 1 ? "s" : ""}
        </Badge>
      </div>
      <div className="pl-2 border-l-2 border-muted space-y-0.5">
        {tasks.map((task) => (
          <TaskItem key={task._id} task={task} />
        ))}
      </div>
    </div>
  );
}

export function WeeklyTasksSection() {
  const {
    weeklyTasks,
    weeklyCompletedTasks,
    isLoadingWeeklyData,
    weekStartDate,
  } = useAgenda();

  const [isPendingOpen, setIsPendingOpen] = useState(true);
  const [isCompletedOpen, setIsCompletedOpen] = useState(true);

  // Generate array of dates for the week
  const getDatesForWeek = () => {
    const dates: string[] = [];
    const start = new Date(weekStartDate);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
    }
    return dates;
  };

  const dates = getDatesForWeek();

  if (isLoadingWeeklyData) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <CheckSquare className="h-5 w-5 text-blue-500" />
            Tasks This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const tasksByDay = weeklyTasks ?? {};
  const completedTasks = weeklyCompletedTasks ?? [];

  // Calculate totals for pending tasks (due this week)
  const pendingTasks = Object.values(tasksByDay).flat();
  const pendingCount = pendingTasks.length;

  // Calculate completed tasks stats
  const completedCount = completedTasks.length;
  const totalCompletedPoints = completedTasks.reduce(
    (sum, task) => sum + (task.estimate ?? 0),
    0
  );

  // Check if there's any data
  const hasNoData = pendingCount === 0 && completedCount === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <CheckSquare className="h-5 w-5 text-blue-500" />
            Tasks This Week
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            {pendingCount > 0 && (
              <span className="text-muted-foreground">
                {pendingCount} pending
              </span>
            )}
            {completedCount > 0 && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-green-600">
                  {completedCount} completed
                </span>
                {totalCompletedPoints > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-green-500/10 text-green-600"
                  >
                    {totalCompletedPoints} pts
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasNoData ? (
          <div className="text-center py-8">
            <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">No tasks this week</p>
          </div>
        ) : (
          <>
            {/* Pending Tasks Section */}
            {pendingCount > 0 && (
              <Collapsible open={isPendingOpen} onOpenChange={setIsPendingOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full hover:bg-muted/50 rounded-md p-1 -ml-1 transition-colors">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      !isPendingOpen && "-rotate-90"
                    )}
                  />
                  <Clock className="h-4 w-4 text-blue-500" />
                  <h4 className="text-sm font-medium">Due This Week</h4>
                  <span className="text-xs text-muted-foreground">
                    ({pendingCount})
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="space-y-4 pl-1">
                    {dates.map((date, i) => {
                      const tasks = tasksByDay[date] ?? [];
                      return (
                        <DayTaskGroup
                          key={date}
                          date={date}
                          dayIndex={i}
                          tasks={tasks}
                        />
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Completed Tasks Section */}
            {completedCount > 0 && (
              <Collapsible
                open={isCompletedOpen}
                onOpenChange={setIsCompletedOpen}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full hover:bg-muted/50 rounded-md p-1 -ml-1 transition-colors">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      !isCompletedOpen && "-rotate-90"
                    )}
                  />
                  <Trophy className="h-4 w-4 text-green-500" />
                  <h4 className="text-sm font-medium text-green-600">
                    Completed This Week
                  </h4>
                  <span className="text-xs text-green-600">
                    ({completedCount})
                  </span>
                  {totalCompletedPoints > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-auto bg-green-500/10 text-green-600 text-xs"
                    >
                      {totalCompletedPoints} pts total
                    </Badge>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="bg-green-500/5 rounded-lg p-3 space-y-0.5">
                    {completedTasks.map((task) => (
                      <TaskItem key={task._id} task={task} showPoints={true} />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
