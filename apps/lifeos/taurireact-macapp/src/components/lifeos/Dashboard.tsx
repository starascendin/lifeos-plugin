import { AppShell } from "./AppShell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@holaai/convex";
import { useQuery } from "convex/react";
import {
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  FolderKanban,
  Loader2,
  PlayCircle,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";

export function LifeOSDashboard() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

function DashboardContent() {
  // Fetch all issues grouped by status
  const issuesByStatus = useQuery(api.lifeos.pm_issues.getIssuesByStatus, {});
  const projects = useQuery(api.lifeos.pm_projects.getProjects, {});
  const currentCycle = useQuery(api.lifeos.pm_cycles.getCurrentCycle, {});

  // Calculate task metrics
  const taskMetrics = useMemo(() => {
    if (!issuesByStatus) return null;

    const backlog = issuesByStatus.backlog?.length ?? 0;
    const todo = issuesByStatus.todo?.length ?? 0;
    const inProgress = issuesByStatus.in_progress?.length ?? 0;
    const inReview = issuesByStatus.in_review?.length ?? 0;
    const done = issuesByStatus.done?.length ?? 0;
    const cancelled = issuesByStatus.cancelled?.length ?? 0;

    const total = backlog + todo + inProgress + inReview + done + cancelled;
    const active = todo + inProgress + inReview;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    return {
      backlog,
      todo,
      inProgress,
      inReview,
      done,
      cancelled,
      total,
      active,
      completionRate,
    };
  }, [issuesByStatus]);

  // Calculate project metrics
  const projectMetrics = useMemo(() => {
    if (!projects) return null;

    const activeProjects = projects.filter(
      (p) => p.status === "in_progress" && !p.isArchived
    );
    const plannedProjects = projects.filter(
      (p) => p.status === "planned" && !p.isArchived
    );
    const completedProjects = projects.filter(
      (p) => p.status === "completed" && !p.isArchived
    );

    const healthCounts = {
      on_track: activeProjects.filter((p) => p.health === "on_track").length,
      at_risk: activeProjects.filter((p) => p.health === "at_risk").length,
      off_track: activeProjects.filter((p) => p.health === "off_track").length,
    };

    return {
      total: projects.filter((p) => !p.isArchived).length,
      active: activeProjects.length,
      planned: plannedProjects.length,
      completed: completedProjects.length,
      healthCounts,
      activeProjects: activeProjects.slice(0, 5), // Top 5 active projects
    };
  }, [projects]);

  const isLoading = issuesByStatus === undefined || projects === undefined;

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="font-bold text-3xl">LifeOS Dashboard</h1>
        <p className="text-muted-foreground">
          Command Center - Your productivity at a glance
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Task Overview Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taskMetrics?.total ?? 0}</div>
                <p className="text-xs text-muted-foreground">
                  Across all statuses
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
                <PlayCircle className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taskMetrics?.active ?? 0}</div>
                <p className="text-xs text-muted-foreground">
                  Todo, In Progress, In Review
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taskMetrics?.done ?? 0}</div>
                <p className="text-xs text-muted-foreground">
                  Tasks marked as done
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taskMetrics?.completionRate ?? 0}%</div>
                <Progress value={taskMetrics?.completionRate ?? 0} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* Task Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Task Status Breakdown</CardTitle>
              <CardDescription>Distribution of tasks across all statuses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <StatusCard
                  icon={<Circle className="h-4 w-4 text-gray-500" />}
                  label="Backlog"
                  count={taskMetrics?.backlog ?? 0}
                  color="bg-gray-500/10"
                />
                <StatusCard
                  icon={<CircleDot className="h-4 w-4 text-blue-500" />}
                  label="Todo"
                  count={taskMetrics?.todo ?? 0}
                  color="bg-blue-500/10"
                />
                <StatusCard
                  icon={<PlayCircle className="h-4 w-4 text-yellow-500" />}
                  label="In Progress"
                  count={taskMetrics?.inProgress ?? 0}
                  color="bg-yellow-500/10"
                />
                <StatusCard
                  icon={<Clock className="h-4 w-4 text-purple-500" />}
                  label="In Review"
                  count={taskMetrics?.inReview ?? 0}
                  color="bg-purple-500/10"
                />
                <StatusCard
                  icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
                  label="Done"
                  count={taskMetrics?.done ?? 0}
                  color="bg-green-500/10"
                />
                <StatusCard
                  icon={<XCircle className="h-4 w-4 text-red-500" />}
                  label="Cancelled"
                  count={taskMetrics?.cancelled ?? 0}
                  color="bg-red-500/10"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Projects Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Projects Overview</CardTitle>
                    <CardDescription>Active project status and health</CardDescription>
                  </div>
                  <Link
                    to="/lifeos/pm/projects"
                    className="text-sm text-primary hover:underline"
                  >
                    View all
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="rounded-lg bg-muted p-3">
                    <div className="text-2xl font-bold">{projectMetrics?.active ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Active</div>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <div className="text-2xl font-bold">{projectMetrics?.planned ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Planned</div>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <div className="text-2xl font-bold">{projectMetrics?.completed ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </div>
                </div>

                {/* Project Health */}
                {projectMetrics && projectMetrics.active > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Project Health</h4>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="bg-green-500/10 text-green-700">
                        {projectMetrics.healthCounts.on_track} On Track
                      </Badge>
                      <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-700">
                        {projectMetrics.healthCounts.at_risk} At Risk
                      </Badge>
                      <Badge variant="secondary" className="bg-red-500/10 text-red-700">
                        {projectMetrics.healthCounts.off_track} Off Track
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Active Projects List */}
                {projectMetrics?.activeProjects && projectMetrics.activeProjects.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Active Projects</h4>
                    <div className="space-y-2">
                      {projectMetrics.activeProjects.map((project) => (
                        <Link
                          key={project._id}
                          to={`/lifeos/pm/projects`}
                          className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <FolderKanban className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{project.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {project.key}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {project.completedIssueCount}/{project.issueCount} tasks
                            </span>
                            <HealthIndicator health={project.health} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {(!projectMetrics?.activeProjects || projectMetrics.activeProjects.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No active projects
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Current Cycle */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Current Cycle</CardTitle>
                    <CardDescription>Sprint progress and details</CardDescription>
                  </div>
                  <Link
                    to="/lifeos/pm/cycles"
                    className="text-sm text-primary hover:underline"
                  >
                    View all
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {currentCycle ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{currentCycle.name}</h3>
                      <Badge
                        variant={currentCycle.status === "active" ? "default" : "secondary"}
                      >
                        {currentCycle.status}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {currentCycle.completedIssueCount} / {currentCycle.issueCount} tasks
                        </span>
                      </div>
                      <Progress
                        value={
                          currentCycle.issueCount > 0
                            ? (currentCycle.completedIssueCount / currentCycle.issueCount) * 100
                            : 0
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Start Date</span>
                        <p className="font-medium">
                          {new Date(currentCycle.startDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">End Date</span>
                        <p className="font-medium">
                          {new Date(currentCycle.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Days remaining */}
                    <div className="rounded-lg bg-muted p-3 text-center">
                      <CycleDaysRemaining endDate={currentCycle.endDate} />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No active cycle
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatusCard({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className={`rounded-lg p-3 ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{count}</div>
    </div>
  );
}

function HealthIndicator({ health }: { health?: string }) {
  const colors = {
    on_track: "bg-green-500",
    at_risk: "bg-yellow-500",
    off_track: "bg-red-500",
  };

  return (
    <div
      className={`h-2 w-2 rounded-full ${colors[health as keyof typeof colors] || "bg-gray-400"}`}
    />
  );
}

function CycleDaysRemaining({ endDate }: { endDate: number }) {
  const now = Date.now();
  const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return (
      <div className="text-red-600">
        <span className="text-lg font-bold">{Math.abs(daysRemaining)}</span>
        <span className="text-sm ml-1">days overdue</span>
      </div>
    );
  }

  if (daysRemaining === 0) {
    return (
      <div className="text-yellow-600">
        <span className="text-lg font-bold">Last day</span>
      </div>
    );
  }

  return (
    <div>
      <span className="text-lg font-bold">{daysRemaining}</span>
      <span className="text-sm text-muted-foreground ml-1">days remaining</span>
    </div>
  );
}
