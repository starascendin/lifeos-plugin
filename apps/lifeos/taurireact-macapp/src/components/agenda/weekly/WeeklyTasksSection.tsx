import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Circle, CheckCircle2, Clock } from "lucide-react";
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

const SHORT_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

function TaskItem({ task }: { task: Doc<"lifeos_pmIssues"> }) {
  const isDone = task.status === "done";

  return (
    <div
      className={cn(
        "flex items-start gap-2 py-1.5",
        isDone && "opacity-60"
      )}
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
          "text-sm leading-tight",
          isDone && "line-through text-muted-foreground"
        )}
      >
        {task.title}
      </span>
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

  const completedCount = tasks.filter((t) => t.status === "done").length;
  const totalCount = tasks.length;

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
          {completedCount}/{totalCount}
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
  const { weeklyTasks, isLoadingWeeklyData, weekStartDate } = useAgenda();

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

  // Calculate totals
  const allTasks = Object.values(tasksByDay).flat();
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.status === "done").length;

  // Get days that have tasks
  const daysWithTasks = dates.filter((date) => {
    const tasks = tasksByDay[date] ?? [];
    return tasks.length > 0;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <CheckSquare className="h-5 w-5 text-blue-500" />
            Tasks This Week
          </CardTitle>
          {totalTasks > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>
                {completedTasks}/{totalTasks} completed
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {totalTasks === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No tasks with due dates this week
            </p>
          </div>
        ) : (
          <div className="space-y-4">
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

            {daysWithTasks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No tasks scheduled for this week
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
