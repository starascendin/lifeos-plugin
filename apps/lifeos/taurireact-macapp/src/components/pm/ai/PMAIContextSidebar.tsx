import { usePM } from "@/lib/contexts/PMContext";
import { FolderKanban, RefreshCw, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PMAIContextSidebar() {
  const {
    projects,
    currentCycle,
    issuesByStatus,
    isLoadingProjects,
    isLoadingCycles,
    isLoadingIssues,
  } = usePM();

  const isLoading = isLoadingProjects || isLoadingCycles || isLoadingIssues;

  // Get recent issues (last 5 from any status)
  const recentIssues = issuesByStatus
    ? Object.values(issuesByStatus)
        .flat()
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, 5)
    : [];

  // Count total issues
  const totalIssueCount = issuesByStatus
    ? Object.values(issuesByStatus).reduce((sum, issues) => sum + issues.length, 0)
    : 0;

  return (
    <div className="w-64 border-r border-border bg-muted/30 flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-muted-foreground">PM Context</h2>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Projects Section */}
          <section>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
              <FolderKanban className="h-3.5 w-3.5" />
              Projects ({projects?.length || 0})
            </div>
            <div className="space-y-1">
              {projects && projects.length > 0 ? (
                projects.slice(0, 5).map((project) => (
                  <div
                    key={project._id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 text-sm"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: project.color || "#6366f1" }}
                    />
                    <span className="truncate flex-1">{project.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {project.issueCount || 0}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground px-2">
                  No projects yet
                </div>
              )}
            </div>
          </section>

          {/* Active Cycle Section */}
          <section>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Active Cycle
            </div>
            {currentCycle ? (
              <div className="px-2 py-2 rounded-md bg-muted/50">
                <div className="text-sm font-medium">
                  {currentCycle.name || `Cycle ${currentCycle.number}`}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDateRange(currentCycle.startDate, currentCycle.endDate)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {currentCycle.completedIssueCount || 0} / {currentCycle.issueCount || 0} completed
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground px-2">
                No active cycle
              </div>
            )}
          </section>

          {/* Recent Issues Section */}
          <section>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
              <FileText className="h-3.5 w-3.5" />
              Recent Issues ({totalIssueCount})
            </div>
            <div className="space-y-1">
              {recentIssues.length > 0 ? (
                recentIssues.map((issue) => (
                  <div
                    key={issue._id}
                    className="px-2 py-1.5 rounded-md hover:bg-muted/50 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <StatusDot status={issue.status} />
                      <span className="text-xs font-mono text-muted-foreground">
                        {issue.identifier}
                      </span>
                    </div>
                    <div className="truncate text-xs mt-0.5">{issue.title}</div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground px-2">
                  No issues yet
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* AI Hint */}
      <div className="p-3 border-t border-border">
        <div className="text-xs text-muted-foreground">
          Try: &quot;Create an issue for login bug&quot; or &quot;Show my high priority tasks&quot;
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    backlog: "bg-gray-400",
    todo: "bg-blue-400",
    in_progress: "bg-yellow-400",
    in_review: "bg-purple-400",
    done: "bg-green-400",
    cancelled: "bg-red-400",
  };

  return (
    <div className={cn("w-1.5 h-1.5 rounded-full", colors[status] || "bg-gray-400")} />
  );
}

function formatDateRange(start: number, end: number): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
}
