import { useState } from "react";
import { useAgenda } from "@/lib/contexts/AgendaContext";
import { usePM } from "@/lib/contexts/PMContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ListTodo, Star, CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  if (days === 1) return "1 day overdue";
  if (days < 7) return `${days} days overdue`;
  if (days < 14) return "1 week overdue";
  if (days < 30) return `${Math.floor(days / 7)} weeks overdue`;
  return `${Math.floor(days / 30)} month(s) overdue`;
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
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer"
      onClick={onClick}
    >
      <Checkbox
        checked={isDone}
        onCheckedChange={(checked) => {
          // Prevent opening sidebar when clicking checkbox
          onToggleStatus();
        }}
        onClick={(e) => e.stopPropagation()}
        className="h-5 w-5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`truncate ${isDone ? "line-through text-muted-foreground" : ""}`}
          >
            {task.title}
          </span>
          {isDone && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge
            variant="outline"
            className={`text-xs ${priorityColors[task.priority]}`}
          >
            {task.priority}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {task.identifier}
          </span>
          {overdueDays !== undefined && overdueDays > 0 && (
            <Badge
              variant="destructive"
              className="text-xs bg-red-500/10 text-red-500 border-red-500/20"
            >
              {formatOverdueDays(overdueDays)}
            </Badge>
          )}
        </div>
      </div>
      {showStar && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar();
          }}
        >
          <Star
            className={`h-4 w-4 ${isStarred ? "fill-yellow-400 text-yellow-400" : ""}`}
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
    isLoadingTasks,
    updateIssueStatus,
    toggleTopPriority,
  } = useAgenda();

  const { setSelectedIssueId } = usePM();

  // Collapsible state for each section
  const [isTop3Open, setIsTop3Open] = useState(true);
  const [isOverdueOpen, setIsOverdueOpen] = useState(true);
  const [isOtherTasksOpen, setIsOtherTasksOpen] = useState(true);

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

  // Get top 3 starred tasks (not completed)
  const top3Tasks =
    topPriorityTasks?.filter((t) => t.status !== "done").slice(0, 3) ?? [];

  // Get other tasks (due today but not in top 3, not completed)
  const otherTasks =
    todaysTasks?.filter(
      (t) =>
        t.status !== "done" && !top3Tasks.find((top) => top._id === t._id)
    ) ?? [];

  // Get completed tasks (from both today's tasks and top priority, deduplicated)
  const completedTasks = [
    ...(todaysTasks?.filter((t) => t.status === "done") ?? []),
    ...(topPriorityTasks?.filter(
      (t) => t.status === "done" && !todaysTasks?.find((td) => td._id === t._id)
    ) ?? []),
  ];

  // Count active (non-completed) tasks
  const activeTaskCount = top3Tasks.length + otherTasks.length + (overdueTasks?.length ?? 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ListTodo className="h-5 w-5" />
          Today's Tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {isLoadingTasks ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* Top 3 Priorities Section */}
            <Collapsible open={isTop3Open} onOpenChange={setIsTop3Open}>
              <CollapsibleTrigger className="flex items-center gap-2 mb-2 w-full hover:bg-muted/50 rounded-md p-1 -ml-1 transition-colors">
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    isTop3Open ? "" : "-rotate-90"
                  }`}
                />
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                <h4 className="text-sm font-medium">Top 3 Priorities</h4>
                <span className="text-xs text-muted-foreground">({top3Tasks.length})</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {top3Tasks.length > 0 ? (
                  <div className="space-y-1 bg-yellow-500/5 rounded-lg p-2">
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
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm bg-muted/30 rounded-lg">
                    <Star className="h-5 w-5 mx-auto mb-1 opacity-50" />
                    <p>Star up to 3 tasks to set priorities</p>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Overdue Tasks Section */}
            {overdueTasks && overdueTasks.length > 0 && (
              <Collapsible open={isOverdueOpen} onOpenChange={setIsOverdueOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 mb-2 w-full hover:bg-muted/50 rounded-md p-1 -ml-1 transition-colors">
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      isOverdueOpen ? "" : "-rotate-90"
                    }`}
                  />
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <h4 className="text-sm font-medium text-red-500">Overdue</h4>
                  <span className="text-xs text-red-500">({overdueTasks.length})</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1 bg-red-500/5 rounded-lg p-2 border border-red-500/10">
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
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Other Tasks Due Today */}
            {otherTasks.length > 0 && (
              <Collapsible open={isOtherTasksOpen} onOpenChange={setIsOtherTasksOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 mb-2 w-full hover:bg-muted/50 rounded-md p-1 -ml-1 transition-colors">
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      isOtherTasksOpen ? "" : "-rotate-90"
                    }`}
                  />
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Other Tasks Due Today
                  </h4>
                  <span className="text-xs text-muted-foreground">({otherTasks.length})</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1">
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
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Empty state for active tasks */}
            {activeTaskCount === 0 && completedTasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No tasks due today</p>
                <p className="text-xs mt-1">
                  Add due dates to your tasks to see them here
                </p>
              </div>
            )}

            {/* Completed Tasks Section */}
            {completedTasks.length > 0 && (
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Completed ({completedTasks.length})
                  </h4>
                </div>
                <div className="space-y-1 opacity-75">
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
