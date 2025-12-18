import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Id, Doc } from "@holaai/convex";

// Types
export type HabitFrequency = "daily" | "weekly";
export type DayOfWeek =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export interface CategoryWithHabits {
  category: Doc<"lifeos_habitCategories"> | null;
  habits: Doc<"lifeos_habits">[];
}

interface HabitsContextValue {
  // Week navigation
  currentWeekStart: Date;
  setCurrentWeekStart: (date: Date) => void;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToCurrentWeek: () => void;
  getWeekDates: () => Date[];

  // Selection
  selectedHabitId: Id<"lifeos_habits"> | null;
  setSelectedHabitId: (id: Id<"lifeos_habits"> | null) => void;

  // Data
  categories: Doc<"lifeos_habitCategories">[] | undefined;
  habits: Doc<"lifeos_habits">[] | undefined;
  habitsByCategory: CategoryWithHabits[] | undefined;
  checkIns: Record<string, Doc<"lifeos_habitCheckIns">> | undefined;
  selectedHabit: Doc<"lifeos_habits"> | null | undefined;

  // Loading states
  isLoadingCategories: boolean;
  isLoadingHabits: boolean;
  isLoadingCheckIns: boolean;

  // Mutations - Categories
  createCategory: ReturnType<typeof useMutation>;
  updateCategory: ReturnType<typeof useMutation>;
  toggleCategoryCollapsed: ReturnType<typeof useMutation>;
  reorderCategories: ReturnType<typeof useMutation>;
  archiveCategory: ReturnType<typeof useMutation>;

  // Mutations - Habits
  createHabit: ReturnType<typeof useMutation>;
  updateHabit: ReturnType<typeof useMutation>;
  archiveHabit: ReturnType<typeof useMutation>;
  deleteHabit: ReturnType<typeof useMutation>;
  moveHabitToCategory: ReturnType<typeof useMutation>;
  reorderHabits: ReturnType<typeof useMutation>;

  // Mutations - Check-ins
  toggleCheckIn: ReturnType<typeof useMutation>;
  updateCheckIn: ReturnType<typeof useMutation>;

  // Helpers
  isHabitScheduledForDate: (habit: Doc<"lifeos_habits">, date: Date) => boolean;
  formatDate: (date: Date) => string;
  getCheckInKey: (habitId: Id<"lifeos_habits">, date: Date) => string;
}

const HabitsContext = createContext<HabitsContextValue | null>(null);

// Helper functions
function getWeekStart(date: Date, startDay: "sunday" | "monday" = "monday"): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = startDay === "monday" ? (day === 0 ? -6 : 1 - day) : -day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isHabitScheduled(habit: Doc<"lifeos_habits">, date: Date): boolean {
  if (habit.frequency === "daily") return true;

  if (habit.frequency === "weekly" && habit.targetDays) {
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ] as const;
    const dayOfWeek = dayNames[date.getDay()];
    return habit.targetDays.includes(dayOfWeek);
  }

  return false;
}

export function HabitsProvider({ children }: { children: React.ReactNode }) {
  // Week navigation state
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() =>
    getWeekStart(new Date())
  );
  const [selectedHabitId, setSelectedHabitId] = useState<Id<"lifeos_habits"> | null>(null);

  // Calculate date range for queries
  const dateRange = useMemo(() => {
    const startDate = formatDateStr(currentWeekStart);
    const endDate = new Date(currentWeekStart);
    endDate.setDate(endDate.getDate() + 6);
    return {
      startDate,
      endDate: formatDateStr(endDate),
    };
  }, [currentWeekStart]);

  // Queries
  const categories = useQuery(api.lifeos.habits_categories.getCategories, {});
  const habitsByCategory = useQuery(api.lifeos.habits.getHabitsGroupedByCategory, {});
  const habits = useQuery(api.lifeos.habits.getHabits, {});
  const checkIns = useQuery(api.lifeos.habits_checkins.getCheckInsForDateRange, dateRange);
  const selectedHabit = useQuery(
    api.lifeos.habits.getHabit,
    selectedHabitId ? { habitId: selectedHabitId } : "skip"
  );

  // Mutations - Categories
  const createCategory = useMutation(api.lifeos.habits_categories.createCategory);
  const updateCategory = useMutation(api.lifeos.habits_categories.updateCategory);
  const toggleCategoryCollapsed = useMutation(
    api.lifeos.habits_categories.toggleCategoryCollapsed
  );
  const reorderCategories = useMutation(api.lifeos.habits_categories.reorderCategories);
  const archiveCategory = useMutation(api.lifeos.habits_categories.archiveCategory);

  // Mutations - Habits
  const createHabit = useMutation(api.lifeos.habits.createHabit);
  const updateHabit = useMutation(api.lifeos.habits.updateHabit);
  const archiveHabit = useMutation(api.lifeos.habits.archiveHabit);
  const deleteHabit = useMutation(api.lifeos.habits.deleteHabit);
  const moveHabitToCategory = useMutation(api.lifeos.habits.moveHabitToCategory);
  const reorderHabits = useMutation(api.lifeos.habits.reorderHabits);

  // Mutations - Check-ins
  const toggleCheckIn = useMutation(api.lifeos.habits_checkins.toggleCheckIn);
  const updateCheckIn = useMutation(api.lifeos.habits_checkins.updateCheckIn);

  // Navigation helpers
  const goToPreviousWeek = useCallback(() => {
    setCurrentWeekStart((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 7);
      return newDate;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentWeekStart((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 7);
      return newDate;
    });
  }, []);

  const goToCurrentWeek = useCallback(() => {
    setCurrentWeekStart(getWeekStart(new Date()));
  }, []);

  const getWeekDates = useCallback((): Date[] => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      return date;
    });
  }, [currentWeekStart]);

  const getCheckInKey = useCallback(
    (habitId: Id<"lifeos_habits">, date: Date): string => {
      return `${habitId}_${formatDateStr(date)}`;
    },
    []
  );

  const value: HabitsContextValue = {
    // Week navigation
    currentWeekStart,
    setCurrentWeekStart,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    getWeekDates,

    // Selection
    selectedHabitId,
    setSelectedHabitId,

    // Data
    categories,
    habits,
    habitsByCategory,
    checkIns,
    selectedHabit,

    // Loading states
    isLoadingCategories: categories === undefined,
    isLoadingHabits: habits === undefined,
    isLoadingCheckIns: checkIns === undefined,

    // Mutations - Categories
    createCategory,
    updateCategory,
    toggleCategoryCollapsed,
    reorderCategories,
    archiveCategory,

    // Mutations - Habits
    createHabit,
    updateHabit,
    archiveHabit,
    deleteHabit,
    moveHabitToCategory,
    reorderHabits,

    // Mutations - Check-ins
    toggleCheckIn,
    updateCheckIn,

    // Helpers
    isHabitScheduledForDate: isHabitScheduled,
    formatDate: formatDateStr,
    getCheckInKey,
  };

  return <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>;
}

export function useHabits() {
  const context = useContext(HabitsContext);
  if (!context) {
    throw new Error("useHabits must be used within a HabitsProvider");
  }
  return context;
}

// Day of week display helpers
export const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const DAY_NAMES_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_OF_WEEK_OPTIONS: { value: DayOfWeek; label: string }[] = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];
