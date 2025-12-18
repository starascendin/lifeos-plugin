import React, { createContext, useContext, useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Id, Doc } from "@holaai/convex";

// Types
export type IssueStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "cancelled";

export type Priority = "urgent" | "high" | "medium" | "low" | "none";

export type ProjectStatus =
  | "planned"
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled";

export type CycleStatus = "upcoming" | "active" | "completed";

export type CycleDuration = "1_week" | "2_weeks";
export type CycleStartDay = "sunday" | "monday";

export interface CycleSettings {
  duration: CycleDuration;
  startDay: CycleStartDay;
  defaultCyclesToCreate: number;
}

export interface CycleRetrospective {
  whatWentWell?: string;
  whatCouldImprove?: string;
  actionItems?: string[];
}

export type ViewType = "board" | "projects" | "cycles";

export interface FilterState {
  projectId?: Id<"lifeos_pmProjects">;
  cycleId?: Id<"lifeos_pmCycles">;
  status?: IssueStatus[];
  priority?: Priority[];
  labelIds?: Id<"lifeos_pmLabels">[];
}

interface PMContextValue {
  // Current view
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;

  // Selection state
  selectedProjectId: Id<"lifeos_pmProjects"> | null;
  setSelectedProjectId: (id: Id<"lifeos_pmProjects"> | null) => void;
  selectedCycleId: Id<"lifeos_pmCycles"> | null;
  setSelectedCycleId: (id: Id<"lifeos_pmCycles"> | null) => void;
  selectedIssueId: Id<"lifeos_pmIssues"> | null;
  setSelectedIssueId: (id: Id<"lifeos_pmIssues"> | null) => void;
  selectedCycleForDetail: Id<"lifeos_pmCycles"> | null;
  setSelectedCycleForDetail: (id: Id<"lifeos_pmCycles"> | null) => void;

  // Filters
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  clearFilters: () => void;

  // Data
  projects: Doc<"lifeos_pmProjects">[] | undefined;
  cycles: Doc<"lifeos_pmCycles">[] | undefined;
  currentCycle: Doc<"lifeos_pmCycles"> | null | undefined;
  labels: Doc<"lifeos_pmLabels">[] | undefined;
  issuesByStatus:
    | Record<IssueStatus, Doc<"lifeos_pmIssues">[]>
    | undefined;

  // Loading states
  isLoadingProjects: boolean;
  isLoadingCycles: boolean;
  isLoadingIssues: boolean;

  // Mutations
  createProject: ReturnType<typeof useMutation>;
  updateProject: ReturnType<typeof useMutation>;
  archiveProject: ReturnType<typeof useMutation>;

  createIssue: ReturnType<typeof useMutation>;
  updateIssue: ReturnType<typeof useMutation>;
  updateIssueStatus: ReturnType<typeof useMutation>;
  deleteIssue: ReturnType<typeof useMutation>;
  reorderIssues: ReturnType<typeof useMutation>;

  createCycle: ReturnType<typeof useMutation>;
  updateCycle: ReturnType<typeof useMutation>;
  deleteCycle: ReturnType<typeof useMutation>;
  generateCycles: ReturnType<typeof useMutation>;

  createLabel: ReturnType<typeof useMutation>;
}

const PMContext = createContext<PMContextValue | null>(null);

export function PMProvider({ children }: { children: React.ReactNode }) {
  // View state
  const [currentView, setCurrentView] = useState<ViewType>("board");
  const [selectedProjectId, setSelectedProjectId] = useState<Id<"lifeos_pmProjects"> | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<Id<"lifeos_pmCycles"> | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<Id<"lifeos_pmIssues"> | null>(null);
  const [selectedCycleForDetail, setSelectedCycleForDetail] = useState<Id<"lifeos_pmCycles"> | null>(null);
  const [filters, setFiltersState] = useState<FilterState>({});

  // Queries
  const projects = useQuery(api.lifeos.pm_projects.getProjects, {});
  const cycles = useQuery(api.lifeos.pm_cycles.getCycles, {});
  const currentCycle = useQuery(api.lifeos.pm_cycles.getCurrentCycle, {});
  const labels = useQuery(api.lifeos.pm_labels.getLabels, {});
  const issuesByStatus = useQuery(api.lifeos.pm_issues.getIssuesByStatus, {
    projectId: filters.projectId,
    cycleId: filters.cycleId,
  });

  // Mutations - Projects
  const createProject = useMutation(api.lifeos.pm_projects.createProject);
  const updateProject = useMutation(api.lifeos.pm_projects.updateProject);
  const archiveProject = useMutation(api.lifeos.pm_projects.archiveProject);

  // Mutations - Issues
  const createIssue = useMutation(api.lifeos.pm_issues.createIssue);
  const updateIssue = useMutation(api.lifeos.pm_issues.updateIssue);
  const updateIssueStatus = useMutation(api.lifeos.pm_issues.updateIssueStatus);
  const deleteIssue = useMutation(api.lifeos.pm_issues.deleteIssue);
  const reorderIssues = useMutation(api.lifeos.pm_issues.reorderIssues);

  // Mutations - Cycles
  const createCycle = useMutation(api.lifeos.pm_cycles.createCycle);
  const updateCycle = useMutation(api.lifeos.pm_cycles.updateCycle);
  const deleteCycle = useMutation(api.lifeos.pm_cycles.deleteCycle);
  const generateCycles = useMutation(api.lifeos.pm_cycles.generateCycles);

  // Mutations - Labels
  const createLabel = useMutation(api.lifeos.pm_labels.createLabel);

  const setFilters = useCallback((newFilters: FilterState) => {
    setFiltersState(newFilters);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({});
  }, []);

  const value: PMContextValue = {
    currentView,
    setCurrentView,
    selectedProjectId,
    setSelectedProjectId,
    selectedCycleId,
    setSelectedCycleId,
    selectedIssueId,
    setSelectedIssueId,
    selectedCycleForDetail,
    setSelectedCycleForDetail,
    filters,
    setFilters,
    clearFilters,
    projects,
    cycles,
    currentCycle,
    labels,
    issuesByStatus,
    isLoadingProjects: projects === undefined,
    isLoadingCycles: cycles === undefined,
    isLoadingIssues: issuesByStatus === undefined,
    createProject,
    updateProject,
    archiveProject,
    createIssue,
    updateIssue,
    updateIssueStatus,
    deleteIssue,
    reorderIssues,
    createCycle,
    updateCycle,
    deleteCycle,
    generateCycles,
    createLabel,
  };

  return <PMContext.Provider value={value}>{children}</PMContext.Provider>;
}

export function usePM() {
  const context = useContext(PMContext);
  if (!context) {
    throw new Error("usePM must be used within a PMProvider");
  }
  return context;
}

// Status configuration for display
export const STATUS_CONFIG: Record<
  IssueStatus,
  { label: string; color: string; bgColor: string }
> = {
  backlog: { label: "Backlog", color: "text-gray-500", bgColor: "bg-gray-500/10" },
  todo: { label: "Todo", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  in_progress: { label: "In Progress", color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  in_review: { label: "In Review", color: "text-purple-500", bgColor: "bg-purple-500/10" },
  done: { label: "Done", color: "text-green-500", bgColor: "bg-green-500/10" },
  cancelled: { label: "Cancelled", color: "text-red-500", bgColor: "bg-red-500/10" },
};

export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; icon: string }
> = {
  urgent: { label: "Urgent", color: "text-red-500", icon: "!!!" },
  high: { label: "High", color: "text-orange-500", icon: "!!" },
  medium: { label: "Medium", color: "text-yellow-500", icon: "!" },
  low: { label: "Low", color: "text-blue-500", icon: "↓" },
  none: { label: "No Priority", color: "text-gray-400", icon: "−" },
};
