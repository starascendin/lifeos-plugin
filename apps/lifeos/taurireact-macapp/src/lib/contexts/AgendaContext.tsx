import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@holaai/convex";
import type { Id, Doc } from "@holaai/convex";
import type { SupportedModelId } from "@/components/agenda/ModelSelector";

// Types
export type ViewMode = "daily" | "weekly" | "monthly";

interface AgendaContextValue {
  // Date navigation
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  goToToday: () => void;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  dateString: string; // YYYY-MM-DD format

  // View mode (for future weekly/monthly views)
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Habits data
  todaysHabits: Doc<"lifeos_habits">[] | undefined;
  todaysCheckIns: Record<string, Doc<"lifeos_habitCheckIns">> | undefined;
  isLoadingHabits: boolean;

  // Tasks data
  todaysTasks: Doc<"lifeos_pmIssues">[] | undefined;
  topPriorityTasks: Doc<"lifeos_pmIssues">[] | undefined;
  isLoadingTasks: boolean;

  // Daily summary
  dailySummary: Doc<"lifeos_dailySummaries"> | null | undefined;
  isLoadingSummary: boolean;
  isGeneratingSummary: boolean;
  generateSummary: () => Promise<void>;

  // Model selection
  selectedModel: SupportedModelId;
  setSelectedModel: (model: SupportedModelId) => void;

  // Mutations
  toggleHabitCheckIn: ReturnType<typeof useMutation>;
  updateIssueStatus: ReturnType<typeof useMutation>;
  toggleTopPriority: ReturnType<typeof useMutation>;

  // Helpers
  formatDate: (date: Date) => string;
  getCheckInKey: (habitId: Id<"lifeos_habits">, date: Date) => string;
  isHabitCompleted: (habitId: Id<"lifeos_habits">) => boolean;
}

const AgendaContext = createContext<AgendaContextValue | null>(null);

// Helper functions
function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AgendaProvider({ children }: { children: React.ReactNode }) {
  // Date navigation state
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [selectedModel, setSelectedModel] = useState<SupportedModelId>(
    "openai/gpt-4o-mini"
  );

  // Calculate date string for queries
  const dateString = useMemo(() => formatDateStr(currentDate), [currentDate]);

  // Habits queries
  const todaysHabits = useQuery(api.lifeos.habits.getHabitsForDate, {
    date: dateString,
  });

  const todaysCheckIns = useQuery(
    api.lifeos.habits_checkins.getCheckInsForDateRange,
    {
      startDate: dateString,
      endDate: dateString,
    }
  );

  // Tasks queries (include completed to show in "Completed" section)
  const todaysTasks = useQuery(api.lifeos.pm_issues.getTasksForDate, {
    date: dateString,
    includeCompleted: true,
  });

  const topPriorityTasks = useQuery(api.lifeos.pm_issues.getTopPriorityTasks, {});

  // Daily summary query
  const dailySummary = useQuery(api.lifeos.agenda.getDailySummary, {
    date: dateString,
  });

  // Mutations
  const toggleHabitCheckIn = useMutation(api.lifeos.habits_checkins.toggleCheckIn);
  const updateIssueStatus = useMutation(api.lifeos.pm_issues.updateIssueStatus);
  const toggleTopPriority = useMutation(api.lifeos.pm_issues.toggleTopPriority);

  // Action for AI summary generation
  const generateDailySummaryAction = useAction(
    api.lifeos.agenda.generateDailySummary
  );

  // Generate summary handler
  const generateSummary = useCallback(async () => {
    setIsGeneratingSummary(true);
    try {
      await generateDailySummaryAction({ date: dateString, model: selectedModel });
    } catch (error) {
      console.error("Failed to generate summary:", error);
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [generateDailySummaryAction, dateString, selectedModel]);

  // Navigation helpers
  const goToToday = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setCurrentDate(today);
  }, []);

  const goToPreviousDay = useCallback(() => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 1);
      return newDate;
    });
  }, []);

  const goToNextDay = useCallback(() => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 1);
      return newDate;
    });
  }, []);

  const getCheckInKey = useCallback(
    (habitId: Id<"lifeos_habits">, date: Date): string => {
      return `${habitId}_${formatDateStr(date)}`;
    },
    []
  );

  const isHabitCompleted = useCallback(
    (habitId: Id<"lifeos_habits">): boolean => {
      if (!todaysCheckIns) return false;
      const key = `${habitId}_${dateString}`;
      return todaysCheckIns[key]?.completed ?? false;
    },
    [todaysCheckIns, dateString]
  );

  const value: AgendaContextValue = {
    // Date navigation
    currentDate,
    setCurrentDate,
    goToToday,
    goToPreviousDay,
    goToNextDay,
    dateString,

    // View mode
    viewMode,
    setViewMode,

    // Habits data
    todaysHabits,
    todaysCheckIns,
    isLoadingHabits: todaysHabits === undefined,

    // Tasks data
    todaysTasks,
    topPriorityTasks,
    isLoadingTasks: todaysTasks === undefined,

    // Daily summary
    dailySummary,
    isLoadingSummary: dailySummary === undefined,
    isGeneratingSummary,
    generateSummary,

    // Model selection
    selectedModel,
    setSelectedModel,

    // Mutations
    toggleHabitCheckIn,
    updateIssueStatus,
    toggleTopPriority,

    // Helpers
    formatDate: formatDateStr,
    getCheckInKey,
    isHabitCompleted,
  };

  return (
    <AgendaContext.Provider value={value}>{children}</AgendaContext.Provider>
  );
}

export function useAgenda() {
  const context = useContext(AgendaContext);
  if (!context) {
    throw new Error("useAgenda must be used within an AgendaProvider");
  }
  return context;
}

// Date display helpers
export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}
