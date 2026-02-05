import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@holaai/convex";
import type { Id, Doc } from "@holaai/convex";
import type { SupportedModelId } from "@/components/agenda/ModelSelector";

// Types
export type ViewMode = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

// Weekly data types
interface WeeklyTasksByDay {
  [date: string]: Doc<"lifeos_pmIssues">[];
}

interface WeeklyFieldValues {
  fieldDefinition: Doc<"lifeos_dailyFieldDefinitions"> | null;
  valuesByDate: Record<string, number | null>;
}

interface WeeklyMemo extends Doc<"life_voiceMemos"> {
  audioUrl: string | null;
}

type MonthlyMemo = WeeklyMemo;

// Weekly calendar events type
type WeeklyEventsByDay = Record<string, Doc<"lifeos_calendarEvents">[]>;

interface AgendaContextValue {
  // Date navigation
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  goToToday: () => void;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  dateString: string; // YYYY-MM-DD format

  // Week navigation
  currentWeekStart: Date;
  weekStartDate: string; // YYYY-MM-DD (Monday)
  weekEndDate: string; // YYYY-MM-DD (Sunday)
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToThisWeek: () => void;

  // Month navigation
  currentMonth: number; // 1-12
  currentMonthYear: number;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToThisMonth: () => void;

  // Quarter navigation
  currentQuarter: number; // 1-4
  currentQuarterYear: number;
  goToPreviousQuarter: () => void;
  goToNextQuarter: () => void;
  goToThisQuarter: () => void;

  // Year navigation
  currentYear: number;
  goToPreviousYear: () => void;
  goToNextYear: () => void;
  goToThisYear: () => void;

  // View mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Habits data
  todaysHabits: Doc<"lifeos_habits">[] | undefined;
  todaysCheckIns: Record<string, Doc<"lifeos_habitCheckIns">> | undefined;
  isLoadingHabits: boolean;

  // Tasks data
  todaysTasks: Doc<"lifeos_pmIssues">[] | undefined;
  topPriorityTasks: Doc<"lifeos_pmIssues">[] | undefined;
  overdueTasks: Doc<"lifeos_pmIssues">[] | undefined;
  completedTodayTasks: Doc<"lifeos_pmIssues">[] | undefined;
  isLoadingTasks: boolean;

  // Calendar events data
  todaysEvents: Doc<"lifeos_calendarEvents">[] | undefined;
  weeklyEvents: WeeklyEventsByDay | undefined;
  isLoadingEvents: boolean;
  calendarSyncStatus: Doc<"lifeos_calendarSyncStatus"> | null | undefined;
  syncCalendar: () => Promise<void>;
  isSyncingCalendar: boolean;

  // Daily summary
  dailySummary: Doc<"lifeos_dailySummaries"> | null | undefined;
  isLoadingSummary: boolean;
  isGeneratingSummary: boolean;
  generateSummary: (userNote?: string) => Promise<void>;
  saveDailyUserNote: ReturnType<typeof useMutation>;
  updateDailyPrompt: ReturnType<typeof useMutation>;

  // Weekly data (only fetched when viewMode === "weekly")
  weeklyTasks: WeeklyTasksByDay | undefined;
  weeklyCompletedTasks: Doc<"lifeos_pmIssues">[] | undefined;
  weeklyFieldValues: WeeklyFieldValues | undefined;
  weeklyMemos: WeeklyMemo[] | undefined;
  isLoadingWeeklyData: boolean;

  // Weekly summary
  weeklySummary: Doc<"lifeos_weeklySummaries"> | null | undefined;
  isLoadingWeeklySummary: boolean;
  isGeneratingWeeklySummary: boolean;
  generateWeeklySummary: () => Promise<void>;
  updateWeeklyPrompt: ReturnType<typeof useMutation>;

  // Monthly data (only fetched when viewMode === "monthly")
  monthStartDate: string; // YYYY-MM-DD (1st of month)
  monthEndDate: string; // YYYY-MM-DD (last of month)
  monthlyMemos: MonthlyMemo[] | undefined;
  isLoadingMonthlyData: boolean;

  // Model selection
  selectedModel: SupportedModelId;
  setSelectedModel: (model: SupportedModelId) => void;

  // Mutations
  toggleHabitCheckIn: ReturnType<typeof useMutation>;
  skipHabitCheckIn: ReturnType<typeof useMutation>;
  checkHabit: ReturnType<typeof useMutation>;
  uncheckHabit: ReturnType<typeof useMutation>;
  markIncomplete: ReturnType<typeof useMutation>;
  updateIssueStatus: ReturnType<typeof useMutation>;
  toggleTopPriority: ReturnType<typeof useMutation>;

  // Daily Fields data
  dailyFields:
    | Array<{
        definition: Doc<"lifeos_dailyFieldDefinitions">;
        value: Doc<"lifeos_dailyFieldValues"> | null;
      }>
    | undefined;
  isLoadingDailyFields: boolean;

  // Daily Fields mutations
  setFieldValue: ReturnType<typeof useMutation>;
  createFieldDefinition: ReturnType<typeof useMutation>;
  updateFieldDefinition: ReturnType<typeof useMutation>;
  archiveFieldDefinition: ReturnType<typeof useMutation>;

  // Helpers
  formatDate: (date: Date) => string;
  getCheckInKey: (habitId: Id<"lifeos_habits">, date: Date) => string;
  isHabitCompleted: (habitId: Id<"lifeos_habits">) => boolean;
  getWeeklyAverage: () => number | null;
}

const AgendaContext = createContext<AgendaContextValue | null>(null);

// Helper functions
function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get the Monday of the week containing the given date
 * Uses ISO week standard (Monday = 1, Sunday = 7)
 */
function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // day: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  // Adjust so Monday = 0
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the Sunday of the week (6 days after Monday)
 */
function getWeekEndDate(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
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
  const [isGeneratingWeeklySummary, setIsGeneratingWeeklySummary] =
    useState(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [selectedModel, setSelectedModel] =
    useState<SupportedModelId>("openai/gpt-4o-mini");

  // Month/Quarter/Year state - independent for those views
  const [currentMonthYear, setCurrentMonthYear] = useState(() =>
    new Date().getFullYear(),
  );
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date().getMonth() + 1,
  );
  const [currentQuarterYear, setCurrentQuarterYear] = useState(() =>
    new Date().getFullYear(),
  );
  const [currentQuarter, setCurrentQuarter] = useState(() =>
    Math.ceil((new Date().getMonth() + 1) / 3),
  );
  const [currentYear, setCurrentYear] = useState(() =>
    new Date().getFullYear(),
  );

  // Week navigation state - derived from currentDate
  const currentWeekStart = useMemo(
    () => getWeekStartDate(currentDate),
    [currentDate],
  );

  // Calculate date strings for queries
  const dateString = useMemo(() => formatDateStr(currentDate), [currentDate]);
  const weekStartDate = useMemo(
    () => formatDateStr(currentWeekStart),
    [currentWeekStart],
  );
  const weekEndDate = useMemo(
    () => formatDateStr(getWeekEndDate(currentWeekStart)),
    [currentWeekStart],
  );

  // Monthly date strings
  const monthStartDate = useMemo(() => {
    const d = new Date(currentMonthYear, currentMonth - 1, 1);
    return formatDateStr(d);
  }, [currentMonthYear, currentMonth]);

  const monthEndDate = useMemo(() => {
    // Day 0 of next month = last day of current month
    const d = new Date(currentMonthYear, currentMonth, 0);
    return formatDateStr(d);
  }, [currentMonthYear, currentMonth]);

  // Habits queries
  const todaysHabits = useQuery(api.lifeos.habits.getHabitsForDate, {
    date: dateString,
  });

  const todaysCheckIns = useQuery(
    api.lifeos.habits_checkins.getCheckInsForDateRange,
    {
      startDate: dateString,
      endDate: dateString,
    },
  );

  // Tasks queries (include completed to show in "Completed" section)
  const todaysTasks = useQuery(api.lifeos.pm_issues.getTasksForDate, {
    date: dateString,
    includeCompleted: true,
  });

  const topPriorityTasks = useQuery(
    api.lifeos.pm_issues.getTopPriorityTasks,
    {},
  );

  // Overdue tasks query (tasks with past due dates that are not completed)
  const overdueTasks = useQuery(api.lifeos.pm_issues.getOverdueTasks, {
    date: dateString,
  });

  // Completed tasks for today (by completedAt timestamp)
  const completedTodayTasks = useQuery(
    api.lifeos.pm_issues.getCompletedTasksForDate,
    { date: dateString },
  );

  // Daily summary query
  const dailySummary = useQuery(api.lifeos.agenda.getDailySummary, {
    date: dateString,
  });

  // Daily fields query
  const dailyFields = useQuery(
    api.lifeos.daily_fields.getFieldsWithValuesForDate,
    {
      date: dateString,
    },
  );

  // Calendar events queries
  // Get timezone offset for proper date boundaries (positive = west of UTC, e.g., 420 for MST)
  const timezoneOffset = new Date().getTimezoneOffset();

  const todaysEvents = useQuery(api.lifeos.calendar.getEventsForDate, {
    date: dateString,
    timezoneOffset,
  });

  const calendarSyncStatus = useQuery(api.lifeos.calendar.getSyncStatus, {});

  // Weekly calendar events (only fetch when in weekly view mode)
  const weeklyEvents = useQuery(
    api.lifeos.calendar.getEventsForDateRange,
    viewMode === "weekly"
      ? { startDate: weekStartDate, endDate: weekEndDate, timezoneOffset }
      : "skip",
  );

  // Weekly data queries (only fetch when in weekly view mode)
  const weeklyTasks = useQuery(
    api.lifeos.pm_issues.getTasksForDateRange,
    viewMode === "weekly"
      ? {
          startDate: weekStartDate,
          endDate: weekEndDate,
          includeCompleted: false,
        }
      : "skip",
  );

  // Weekly completed tasks (by completedAt)
  const weeklyCompletedTasks = useQuery(
    api.lifeos.pm_issues.getCompletedTasksForDateRange,
    viewMode === "weekly"
      ? { startDate: weekStartDate, endDate: weekEndDate }
      : "skip",
  );

  const weeklyFieldValues = useQuery(
    api.lifeos.daily_fields.getFieldValuesForDateRange,
    viewMode === "weekly"
      ? { startDate: weekStartDate, endDate: weekEndDate }
      : "skip",
  );

  const weeklyMemos = useQuery(
    api.lifeos.voicememo.getMemosForDateRange,
    viewMode === "weekly"
      ? { startDate: weekStartDate, endDate: weekEndDate }
      : "skip",
  );

  // Weekly summary query
  const weeklySummary = useQuery(
    api.lifeos.agenda.getWeeklySummary,
    viewMode === "weekly" ? { weekStartDate } : "skip",
  );

  // Monthly memos query (only fetch when in monthly view mode)
  const monthlyMemos = useQuery(
    api.lifeos.voicememo.getMemosForDateRange,
    viewMode === "monthly"
      ? { startDate: monthStartDate, endDate: monthEndDate }
      : "skip",
  );

  // Initialize default fields on mount
  const initializeDefaultFields = useMutation(
    api.lifeos.daily_fields.initializeDefaultFields,
  );

  useEffect(() => {
    initializeDefaultFields();
  }, [initializeDefaultFields]);

  // Mutations
  const toggleHabitCheckIn = useMutation(
    api.lifeos.habits_checkins.toggleCheckIn,
  );
  const skipHabitCheckIn = useMutation(api.lifeos.habits_checkins.skipCheckIn);
  const checkHabit = useMutation(api.lifeos.habits_checkins.checkHabit);
  const uncheckHabit = useMutation(api.lifeos.habits_checkins.uncheckHabit);
  const markIncomplete = useMutation(api.lifeos.habits_checkins.markIncomplete);
  const updateIssueStatus = useMutation(api.lifeos.pm_issues.updateIssueStatus);
  const toggleTopPriority = useMutation(api.lifeos.pm_issues.toggleTopPriority);

  // Daily fields mutations
  const setFieldValue = useMutation(api.lifeos.daily_fields.setFieldValue);
  const createFieldDefinition = useMutation(
    api.lifeos.daily_fields.createFieldDefinition,
  );
  const updateFieldDefinition = useMutation(
    api.lifeos.daily_fields.updateFieldDefinition,
  );
  const archiveFieldDefinition = useMutation(
    api.lifeos.daily_fields.archiveFieldDefinition,
  );

  // Action for AI summary generation
  const generateDailySummaryAction = useAction(
    api.lifeos.agenda.generateDailySummary,
  );

  // Daily summary mutations
  const saveDailyUserNoteMutation = useMutation(
    api.lifeos.agenda.saveDailyUserNote,
  );
  const updateDailyPromptMutation = useMutation(
    api.lifeos.agenda.updateDailyPrompt,
  );

  // Weekly summary mutations and action
  const updateWeeklyPromptMutation = useMutation(
    api.lifeos.agenda.updateWeeklyPrompt,
  );
  const generateWeeklySummaryAction = useAction(
    api.lifeos.agenda.generateWeeklySummary,
  );

  // Calendar sync action
  const syncCalendarAction = useAction(api.lifeos.calendar.syncCalendarEvents);

  // Generate daily summary handler — accepts userNote directly to avoid race conditions
  const generateSummary = useCallback(async (userNote?: string) => {
    setIsGeneratingSummary(true);
    try {
      await generateDailySummaryAction({
        date: dateString,
        model: selectedModel,
        userNote: userNote ?? dailySummary?.userNote ?? undefined,
      });
    } catch (error) {
      console.error("Failed to generate summary:", error);
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [generateDailySummaryAction, dateString, selectedModel, dailySummary?.userNote]);

  // Generate weekly summary handler
  const generateWeeklySummary = useCallback(async () => {
    setIsGeneratingWeeklySummary(true);
    try {
      await generateWeeklySummaryAction({
        weekStartDate,
        model: selectedModel,
      });
    } catch (error) {
      console.error("Failed to generate weekly summary:", error);
    } finally {
      setIsGeneratingWeeklySummary(false);
    }
  }, [generateWeeklySummaryAction, weekStartDate, selectedModel]);

  // Sync calendar handler
  const syncCalendar = useCallback(async () => {
    setIsSyncingCalendar(true);
    try {
      await syncCalendarAction({});
    } catch (error) {
      console.error("Failed to sync calendar:", error);
    } finally {
      setIsSyncingCalendar(false);
    }
  }, [syncCalendarAction]);

  // Week navigation helpers
  const goToPreviousWeek = useCallback(() => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 7);
      return newDate;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 7);
      return newDate;
    });
  }, []);

  const goToThisWeek = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setCurrentDate(today);
  }, []);

  // Month navigation helpers
  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev === 1) {
        setCurrentMonthYear((y) => y - 1);
        return 12;
      }
      return prev - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev === 12) {
        setCurrentMonthYear((y) => y + 1);
        return 1;
      }
      return prev + 1;
    });
  }, []);

  const goToThisMonth = useCallback(() => {
    const today = new Date();
    setCurrentMonthYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
  }, []);

  // Quarter navigation helpers
  const goToPreviousQuarter = useCallback(() => {
    setCurrentQuarter((prev) => {
      if (prev === 1) {
        setCurrentQuarterYear((y) => y - 1);
        return 4;
      }
      return prev - 1;
    });
  }, []);

  const goToNextQuarter = useCallback(() => {
    setCurrentQuarter((prev) => {
      if (prev === 4) {
        setCurrentQuarterYear((y) => y + 1);
        return 1;
      }
      return prev + 1;
    });
  }, []);

  const goToThisQuarter = useCallback(() => {
    const today = new Date();
    setCurrentQuarterYear(today.getFullYear());
    setCurrentQuarter(Math.ceil((today.getMonth() + 1) / 3));
  }, []);

  // Year navigation helpers
  const goToPreviousYear = useCallback(() => {
    setCurrentYear((prev) => prev - 1);
  }, []);

  const goToNextYear = useCallback(() => {
    setCurrentYear((prev) => prev + 1);
  }, []);

  const goToThisYear = useCallback(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  // Get weekly average for End Day Score
  const getWeeklyAverage = useCallback(() => {
    if (!weeklyFieldValues?.valuesByDate) return null;
    const scores = Object.values(weeklyFieldValues.valuesByDate).filter(
      (s): s is number => s !== null,
    );
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [weeklyFieldValues]);

  // Day navigation helpers
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
    [],
  );

  const isHabitCompleted = useCallback(
    (habitId: Id<"lifeos_habits">): boolean => {
      if (!todaysCheckIns) return false;
      const key = `${habitId}_${dateString}`;
      return todaysCheckIns[key]?.completed ?? false;
    },
    [todaysCheckIns, dateString],
  );

  const value: AgendaContextValue = {
    // Date navigation
    currentDate,
    setCurrentDate,
    goToToday,
    goToPreviousDay,
    goToNextDay,
    dateString,

    // Week navigation
    currentWeekStart,
    weekStartDate,
    weekEndDate,
    goToPreviousWeek,
    goToNextWeek,
    goToThisWeek,

    // Month navigation
    currentMonth,
    currentMonthYear,
    goToPreviousMonth,
    goToNextMonth,
    goToThisMonth,

    // Quarter navigation
    currentQuarter,
    currentQuarterYear,
    goToPreviousQuarter,
    goToNextQuarter,
    goToThisQuarter,

    // Year navigation
    currentYear,
    goToPreviousYear,
    goToNextYear,
    goToThisYear,

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
    overdueTasks,
    completedTodayTasks,
    isLoadingTasks: todaysTasks === undefined || overdueTasks === undefined,

    // Calendar events data
    todaysEvents,
    weeklyEvents,
    isLoadingEvents: todaysEvents === undefined,
    calendarSyncStatus,
    syncCalendar,
    isSyncingCalendar,

    // Daily summary
    dailySummary,
    isLoadingSummary: dailySummary === undefined,
    isGeneratingSummary,
    generateSummary,
    saveDailyUserNote: saveDailyUserNoteMutation,
    updateDailyPrompt: updateDailyPromptMutation,

    // Weekly data
    weeklyTasks,
    weeklyCompletedTasks,
    weeklyFieldValues,
    weeklyMemos,
    isLoadingWeeklyData:
      viewMode === "weekly" &&
      (weeklyTasks === undefined ||
        weeklyCompletedTasks === undefined ||
        weeklyFieldValues === undefined ||
        weeklyMemos === undefined),

    // Weekly summary
    weeklySummary,
    isLoadingWeeklySummary:
      viewMode === "weekly" && weeklySummary === undefined,
    isGeneratingWeeklySummary,
    generateWeeklySummary,
    updateWeeklyPrompt: updateWeeklyPromptMutation,

    // Monthly data
    monthStartDate,
    monthEndDate,
    monthlyMemos,
    isLoadingMonthlyData:
      viewMode === "monthly" && monthlyMemos === undefined,

    // Model selection
    selectedModel,
    setSelectedModel,

    // Mutations
    toggleHabitCheckIn,
    skipHabitCheckIn,
    checkHabit,
    uncheckHabit,
    markIncomplete,
    updateIssueStatus,
    toggleTopPriority,

    // Daily Fields data
    dailyFields,
    isLoadingDailyFields: dailyFields === undefined,

    // Daily Fields mutations
    setFieldValue,
    createFieldDefinition,
    updateFieldDefinition,
    archiveFieldDefinition,

    // Helpers
    formatDate: formatDateStr,
    getCheckInKey,
    isHabitCompleted,
    getWeeklyAverage,
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

export function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const startMonth = weekStart.toLocaleDateString("en-US", { month: "short" });
  const startDay = weekStart.getDate();
  const endMonth = weekEnd.toLocaleDateString("en-US", { month: "short" });
  const endDay = weekEnd.getDate();
  const year = weekEnd.getFullYear();

  // If same month: "Jan 6-12, 2025"
  // If different months: "Jan 27 - Feb 2, 2025"
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}, ${year}`;
  } else {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  }
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}
