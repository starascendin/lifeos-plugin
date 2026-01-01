import { useAgenda } from "@/lib/contexts/AgendaContext";
import { usePM } from "@/lib/contexts/PMContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ListTodo, Star, CheckCircle2 } from "lucide-react";
import type { Doc, Id } from "@holaai/convex";

interface TaskItemProps {
  task: Doc<"lifeos_pmIssues">;
  onToggleStatus: () => void;
  onToggleStar: () => void;
  onClick: () => void;
  showStar?: boolean;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/10 text-red-500 border-red-500/20",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  none: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

function TaskItem({
  task,
  onToggleStatus,
  onToggleStar,
  onClick,
  showStar = true,
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

  // Get top 3 starred tasks
  const top3Tasks = topPriorityTasks?.slice(0, 3) ?? [];

  // Get other tasks (due today but not in top 3)
  const otherTasks =
    todaysTasks?.filter(
      (t) => !top3Tasks.find((top) => top._id === t._id)
    ) ?? [];

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
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                <h4 className="text-sm font-medium">Top 3 Priorities</h4>
              </div>
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
            </div>

            {/* Other Tasks Due Today */}
            {otherTasks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                  Other Tasks Due Today
                </h4>
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
              </div>
            )}

            {/* Empty state */}
            {top3Tasks.length === 0 && otherTasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No tasks due today</p>
                <p className="text-xs mt-1">
                  Add due dates to your tasks to see them here
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
