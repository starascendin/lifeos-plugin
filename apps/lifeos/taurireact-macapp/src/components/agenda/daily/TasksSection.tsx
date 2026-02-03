import { useAgenda } from "@/lib/contexts/AgendaContext";
import { usePM } from "@/lib/contexts/PMContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ListTodo, Star, CheckCircle2, AlertTriangle } from "lucide-react";
import type { Doc, Id } from "@holaai/convex";

interface TaskItemProps {
  task: Doc<"lifeos_pmIssues">;
  onToggleStatus: () => void;
  onToggleStar: () => void;
  onClick: () => void;
  showStar?: boolean;
  overdueDays?: number;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/10 text-red-500 border-red-500/20",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  none: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

function getDaysOverdue(dueDate: number): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function formatOverdueDays(days: number): string {
  if (days === 1) return "1d overdue";
  if (days < 7) return `${days}d overdue`;
  if (days < 14) return "1w overdue";
  if (days < 30) return `${Math.floor(days / 7)}w overdue`;
  return `${Math.floor(days / 30)}mo overdue`;
}

function TaskItem({
  task,
  onToggleStatus,
  onToggleStar,
  onClick,
  showStar = true,
  overdueDays,
}: TaskItemProps) {
  const isDone = task.status === "done";
  const isStarred = task.isTopPriority;

  return (
    <div
      className="flex items-center gap-2.5 py-1.5 px-1 rounded-md hover:bg-muted/50 transition-colors group cursor-pointer"
      onClick={onClick}
    >
      <Checkbox
        checked={isDone}
        onCheckedChange={() => onToggleStatus()}
        onClick={(e) => e.stopPropagation()}
        className="h-4 w-4"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-sm truncate ${isDone ? "line-through text-muted-foreground" : ""}`}
          >
            {task.title}
          </span>
          {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Badge
            variant="outline"
            className={`text-[10px] h-4 px-1 ${priorityColors[task.priority]}`}
          >
            {task.priority}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {task.identifier}
          </span>
          {overdueDays !== undefined && overdueDays > 0 && (
            <span className="text-[10px] text-red-500 font-medium">
              {formatOverdueDays(overdueDays)}
            </span>
          )}
        </div>
      </div>
      {showStar && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar();
          }}
        >
          <Star
            className={`h-3.5 w-3.5 ${isStarred ? "fill-yellow-400 text-yellow-400" : ""}`}
          />
        </Button>
      )}
    </div>
  );
}

export function TasksSection() {
  const {
    todaysTasks,
    topPriorityTasks,
    overdueTasks,
    completedTodayTasks,
    isLoadingTasks,
    updateIssueStatus,
    toggleTopPriority,
  } = useAgenda();

  const { setSelectedIssueId } = usePM();

  const handleToggleStatus = async (task: Doc<"lifeos_pmIssues">) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    await updateIssueStatus({
      issueId: task._id,
      status: newStatus,
    });
  };

  const handleToggleStar = async (issueId: Id<"lifeos_pmIssues">) => {
    await toggleTopPriority({ issueId });
  };

  const top3Tasks =
    topPriorityTasks?.filter((t) => t.status !== "done").slice(0, 3) ?? [];

  const otherTasks =
    todaysTasks?.filter(
      (t) =>
        t.status !== "done" && !top3Tasks.find((top) => top._id === t._id)
    ) ?? [];

  const completedTasks = completedTodayTasks ?? [];

  const totalCompletedPoints = completedTasks.reduce(
    (sum, task) => sum + (task.estimate ?? 0),
    0
  );

  const activeTaskCount = top3Tasks.length + otherTasks.length + (overdueTasks?.length ?? 0);

  return (
    <div className="p-4 md:p-5">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Tasks</h3>
          {activeTaskCount > 0 && (
            <span className="text-xs text-muted-foreground">
              ({activeTaskCount})
            </span>
          )}
        </div>
        {completedTasks.length > 0 && (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs text-muted-foreground">
              {completedTasks.length} done
            </span>
            {totalCompletedPoints > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                {totalCompletedPoints}pts
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isLoadingTasks ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Top 3 Priorities */}
          {top3Tasks.length > 0 ? (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                <span className="text-xs font-medium text-muted-foreground">Priorities</span>
              </div>
              <div className="space-y-0.5 bg-yellow-500/5 rounded-md p-1.5">
                {top3Tasks.map((task) => (
                  <TaskItem
                    key={task._id}
                    task={task}
                    onToggleStatus={() => handleToggleStatus(task)}
                    onToggleStar={() => handleToggleStar(task._id)}
                    onClick={() => setSelectedIssueId(task._id)}
                    showStar={true}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-3 text-muted-foreground">
              <Star className="h-4 w-4 mx-auto mb-1 opacity-40" />
              <p className="text-xs">Star tasks to set priorities</p>
            </div>
          )}

          {/* Overdue */}
          {overdueTasks && overdueTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                <span className="text-xs font-medium text-red-500">
                  Overdue ({overdueTasks.length})
                </span>
              </div>
              <div className="space-y-0.5 bg-red-500/5 rounded-md p-1.5 border border-red-500/10">
                {overdueTasks.map((task) => (
                  <TaskItem
                    key={task._id}
                    task={task}
                    onToggleStatus={() => handleToggleStatus(task)}
                    onToggleStar={() => handleToggleStar(task._id)}
                    onClick={() => setSelectedIssueId(task._id)}
                    showStar={top3Tasks.length < 3}
                    overdueDays={getDaysOverdue(task.dueDate!)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other tasks due today */}
          {otherTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Due Today ({otherTasks.length})
                </span>
              </div>
              <div className="space-y-0.5">
                {otherTasks.map((task) => (
                  <TaskItem
                    key={task._id}
                    task={task}
                    onToggleStatus={() => handleToggleStatus(task)}
                    onToggleStar={() => handleToggleStar(task._id)}
                    onClick={() => setSelectedIssueId(task._id)}
                    showStar={top3Tasks.length < 3}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {activeTaskCount === 0 && completedTasks.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <ListTodo className="h-6 w-6 mx-auto mb-1 opacity-40" />
              <p className="text-xs">No tasks due today</p>
            </div>
          )}

          {/* Completed */}
          {completedTasks.length > 0 && (
            <div className="pt-2 border-t">
              <div className="space-y-0.5 opacity-60">
                {completedTasks.map((task) => (
                  <TaskItem
                    key={task._id}
                    task={task}
                    onToggleStatus={() => handleToggleStatus(task)}
                    onToggleStar={() => handleToggleStar(task._id)}
                    onClick={() => setSelectedIssueId(task._id)}
                    showStar={false}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
