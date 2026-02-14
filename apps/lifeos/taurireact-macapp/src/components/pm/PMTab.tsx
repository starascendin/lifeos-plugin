import { useParams, useNavigate } from "react-router-dom";
import { usePM } from "@/lib/contexts/PMContext";
import { KanbanBoard } from "./board/KanbanBoard";
import { ProjectList } from "./ProjectList";
import { CycleList } from "./CycleList";
import { ProjectDetailView } from "./project/ProjectDetailView";
import { IssueDetailPanel } from "./issue/IssueDetailPanel";
import { CycleDetailView } from "./cycle/CycleDetailView";
import { ContactsTab } from "./contacts/ContactsTab";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Kanban,
  FolderKanban,
  RefreshCw,
  Settings,
  ContactRound,
} from "lucide-react";
import { useState } from "react";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { CreateIssueDialog } from "./CreateIssueDialog";
import { CycleSettingsModal } from "./CycleSettingsModal";
import { PomodoroWidget, PomodoroStatsMini } from "./pomodoro";
import { toast } from "sonner";
import type { Id } from "@holaai/convex";

type ViewType = "board" | "projects" | "cycles" | "contacts";

export function PMTab() {
  const { view, id } = useParams<{ view?: string; id?: string }>();
  const navigate = useNavigate();
  const { projects, filters, setFilters, clearFilters, userSettings, generateCycles } = usePM();

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateIssue, setShowCreateIssue] = useState(false);
  const [showCycleSettings, setShowCycleSettings] = useState(false);
  const [isGeneratingCycle, setIsGeneratingCycle] = useState(false);

  const handleNewCycle = async () => {
    if (!userSettings?.cycleSettings) {
      toast.info("Configure your cycle settings first");
      setShowCycleSettings(true);
      return;
    }
    setIsGeneratingCycle(true);
    try {
      await generateCycles({ count: 1 });
      toast.success("Cycle created");
    } catch (error) {
      toast.error("Failed to create cycle");
      console.error("Failed to generate cycle:", error);
    } finally {
      setIsGeneratingCycle(false);
    }
  };

  // Determine current view from URL
  const currentView: ViewType =
    view === "projects"
      ? "projects"
      : view === "cycles"
        ? "cycles"
        : view === "contacts"
          ? "contacts"
          : "board";

  // Check if we're viewing a specific project or cycle
  const isProjectDetail = view === "projects" && id;
  const isCycleDetail = view === "cycles" && id;
  const projectId = isProjectDetail ? (id as Id<"lifeos_pmProjects">) : undefined;
  const cycleId = isCycleDetail ? (id as Id<"lifeos_pmCycles">) : undefined;

  const handleViewChange = (newView: ViewType) => {
    if (newView === "board") {
      navigate("/lifeos/pm");
    } else {
      navigate(`/lifeos/pm/${newView}`);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header - hide when viewing project or cycle details */}
      {!isProjectDetail && !isCycleDetail && (
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Project Management</h1>

          {/* View Tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <Button
              variant={currentView === "board" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleViewChange("board")}
              className="gap-2"
            >
              <Kanban className="h-4 w-4" />
              Board
            </Button>
            <Button
              variant={currentView === "projects" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleViewChange("projects")}
              className="gap-2"
            >
              <FolderKanban className="h-4 w-4" />
              Projects
            </Button>
            <Button
              variant={currentView === "cycles" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleViewChange("cycles")}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Cycles
            </Button>
            <Button
              variant={currentView === "contacts" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleViewChange("contacts")}
              className="gap-2"
            >
              <ContactRound className="h-4 w-4" />
              Contacts
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Pomodoro Widget */}
          <PomodoroWidget />

          {/* Pomodoro Stats Mini (when idle) */}
          <PomodoroStatsMini />

          {/* Project Filter (for board view) */}
          {currentView === "board" && projects && projects.length > 0 && (
            <Select
              value={filters.projectId ?? "all"}
              onValueChange={(value) => {
                if (value === "all") {
                  clearFilters();
                } else {
                  setFilters({ ...filters, projectId: value as any });
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project._id} value={project._id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Create Buttons */}
          {currentView === "board" && (
            <Button onClick={() => setShowCreateIssue(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Issue
            </Button>
          )}
          {currentView === "projects" && (
            <Button onClick={() => setShowCreateProject(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          )}
          {currentView === "cycles" && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowCycleSettings(true)}
                title="Cycle Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button onClick={handleNewCycle} disabled={isGeneratingCycle} className="gap-2">
                <Plus className="h-4 w-4" />
                {isGeneratingCycle ? "Creating..." : "New Cycle"}
              </Button>
            </>
          )}
        </div>
      </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isCycleDetail && cycleId ? (
          <CycleDetailView cycleId={cycleId} />
        ) : isProjectDetail && projectId ? (
          <ProjectDetailView projectId={projectId} />
        ) : (
          <>
            {currentView === "board" && <KanbanBoard />}
            {currentView === "projects" && <ProjectList />}
            {currentView === "cycles" && <CycleList />}
            {currentView === "contacts" && <ContactsTab />}
          </>
        )}
      </div>

      {/* Dialogs */}
      <CreateProjectDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
      />
      <CreateIssueDialog
        open={showCreateIssue}
        onOpenChange={setShowCreateIssue}
      />
      <CycleSettingsModal
        open={showCycleSettings}
        onOpenChange={setShowCycleSettings}
      />

      {/* Issue Detail Panel */}
      <IssueDetailPanel />
    </div>
  );
}
