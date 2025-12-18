import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc, Id } from "../_generated/dataModel";

// ==================== QUERIES ====================

/**
 * Get check-ins for a date range (for weekly view)
 */
export const getCheckInsForDateRange = query({
  args: {
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const checkIns = await ctx.db
      .query("lifeos_habitCheckIns")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).gte("date", args.startDate)
      )
      .filter((q) => q.lte(q.field("date"), args.endDate))
      .collect();

    // Return as a map: habitId_date -> checkIn
    const checkInMap: Record<string, Doc<"lifeos_habitCheckIns">> = {};
    for (const checkIn of checkIns) {
      checkInMap[`${checkIn.habitId}_${checkIn.date}`] = checkIn;
    }

    return checkInMap;
  },
});

/**
 * Get check-ins for a specific habit (with pagination)
 */
export const getCheckInsForHabit = query({
  args: {
    habitId: v.id("lifeos_habits"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 100;

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== user._id) {
      return [];
    }

    const checkIns = await ctx.db
      .query("lifeos_habitCheckIns")
      .withIndex("by_habit", (q) => q.eq("habitId", args.habitId))
      .order("desc")
      .take(limit);

    return checkIns;
  },
});

/**
 * Get calendar data for a habit (monthly view)
 */
export const getHabitCalendarData = query({
  args: {
    habitId: v.id("lifeos_habits"),
    year: v.number(),
    month: v.number(), // 1-12
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== user._id) {
      return null;
    }

    // Build date range for the month
    const startDate = `${args.year}-${String(args.month).padStart(2, "0")}-01`;
    const endDate = `${args.year}-${String(args.month).padStart(2, "0")}-31`;

    const checkIns = await ctx.db
      .query("lifeos_habitCheckIns")
      .withIndex("by_habit_date", (q) =>
        q.eq("habitId", args.habitId).gte("date", startDate)
      )
      .filter((q) => q.lte(q.field("date"), endDate))
      .collect();

    // Build calendar map: day -> completed
    const calendarData: Record<number, boolean> = {};
    for (const checkIn of checkIns) {
      const day = parseInt(checkIn.date.split("-")[2], 10);
      calendarData[day] = checkIn.completed;
    }

    // Calculate stats for the month
    const completedDays = checkIns.filter((c) => c.completed).length;

    // Calculate scheduled days up to today (or end of month if past)
    const now = new Date();
    const isCurrentMonth =
      now.getFullYear() === args.year && now.getMonth() + 1 === args.month;
    const lastDay = isCurrentMonth
      ? now.getDate()
      : new Date(args.year, args.month, 0).getDate();

    let scheduledDays = 0;
    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(args.year, args.month - 1, day);
      if (isHabitScheduledForDate(habit, date)) {
        scheduledDays++;
      }
    }

    return {
      habit,
      calendarData,
      completedDays,
      scheduledDays,
      completionRate:
        scheduledDays > 0
          ? Math.round((completedDays / scheduledDays) * 100)
          : 0,
    };
  },
});

// ==================== MUTATIONS ====================

/**
 * Toggle check-in for a habit on a specific date
 */
export const toggleCheckIn = mutation({
  args: {
    habitId: v.id("lifeos_habits"),
    date: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== user._id) {
      throw new Error("Habit not found or access denied");
    }

    // Check if check-in exists
    const existingCheckIn = await ctx.db
      .query("lifeos_habitCheckIns")
      .withIndex("by_habit_date", (q) =>
        q.eq("habitId", args.habitId).eq("date", args.date)
      )
      .first();

    let newCompleted: boolean;

    if (existingCheckIn) {
      // Toggle existing check-in
      newCompleted = !existingCheckIn.completed;
      await ctx.db.patch(existingCheckIn._id, {
        completed: newCompleted,
        updatedAt: now,
      });
    } else {
      // Create new check-in (completed)
      newCompleted = true;
      await ctx.db.insert("lifeos_habitCheckIns", {
        userId: user._id,
        habitId: args.habitId,
        date: args.date,
        completed: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Update habit stats
    await recalculateHabitStats(ctx, args.habitId, habit);

    return { completed: newCompleted };
  },
});

/**
 * Update check-in with a note
 */
export const updateCheckIn = mutation({
  args: {
    habitId: v.id("lifeos_habits"),
    date: v.string(), // YYYY-MM-DD
    note: v.optional(v.string()),
    completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== user._id) {
      throw new Error("Habit not found or access denied");
    }

    // Check if check-in exists
    const existingCheckIn = await ctx.db
      .query("lifeos_habitCheckIns")
      .withIndex("by_habit_date", (q) =>
        q.eq("habitId", args.habitId).eq("date", args.date)
      )
      .first();

    if (existingCheckIn) {
      const updates: Partial<Doc<"lifeos_habitCheckIns">> = {
        updatedAt: now,
      };
      if (args.note !== undefined) updates.note = args.note;
      if (args.completed !== undefined) updates.completed = args.completed;

      await ctx.db.patch(existingCheckIn._id, updates);

      if (args.completed !== undefined) {
        await recalculateHabitStats(ctx, args.habitId, habit);
      }
    } else if (args.completed === true) {
      // Create new check-in
      await ctx.db.insert("lifeos_habitCheckIns", {
        userId: user._id,
        habitId: args.habitId,
        date: args.date,
        completed: true,
        note: args.note,
        createdAt: now,
        updatedAt: now,
      });

      await recalculateHabitStats(ctx, args.habitId, habit);
    }
  },
});

// ==================== INTERNAL HELPERS ====================

/**
 * Recalculate habit stats (totalCompletions, currentStreak, longestStreak)
 */
async function recalculateHabitStats(
  ctx: { db: any },
  habitId: Id<"lifeos_habits">,
  habit: Doc<"lifeos_habits">
) {
  const now = Date.now();

  // Get all completed check-ins, ordered by date descending
  const allCheckIns = await ctx.db
    .query("lifeos_habitCheckIns")
    .withIndex("by_habit", (q: any) => q.eq("habitId", habitId))
    .collect();

  const completedCheckIns = allCheckIns
    .filter((c: Doc<"lifeos_habitCheckIns">) => c.completed)
    .sort(
      (a: Doc<"lifeos_habitCheckIns">, b: Doc<"lifeos_habitCheckIns">) =>
        b.date.localeCompare(a.date)
    );

  const totalCompletions = completedCheckIns.length;

  // Find last completed date
  const lastCompletedDate =
    completedCheckIns.length > 0 ? completedCheckIns[0].date : undefined;

  // Calculate streaks
  const { currentStreak, longestStreak } = calculateStreaks(
    habit,
    completedCheckIns.map((c: Doc<"lifeos_habitCheckIns">) => c.date)
  );

  // Update habit
  await ctx.db.patch(habitId, {
    totalCompletions,
    currentStreak,
    longestStreak: Math.max(longestStreak, habit.longestStreak),
    lastCompletedDate,
    updatedAt: now,
  });
}

/**
 * Calculate current and longest streak from completion dates
 */
function calculateStreaks(
  habit: Doc<"lifeos_habits">,
  completedDates: string[] // Already sorted desc
): { currentStreak: number; longestStreak: number } {
  if (completedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Build a Set of completed dates for fast lookup
  const completedSet = new Set(completedDates);

  // Get today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDate(today);

  // Calculate current streak (from today/yesterday backwards)
  let currentStreak = 0;
  let checkDate = new Date(today);

  // If today is not scheduled, start from the last scheduled day
  if (!isHabitScheduledForDate(habit, checkDate)) {
    checkDate = getPreviousScheduledDate(habit, checkDate);
  }

  // Check if we have a completion for the first scheduled day
  let checkDateStr = formatDate(checkDate);

  // If we haven't completed for the most recent scheduled day, streak might still be active
  // if yesterday was the last scheduled day and was completed
  if (!completedSet.has(checkDateStr)) {
    // Check if we're still within grace period (allow today to not be completed yet)
    if (checkDateStr === todayStr) {
      // Today not completed yet, check from yesterday
      checkDate = getPreviousScheduledDate(habit, checkDate);
      checkDateStr = formatDate(checkDate);
    } else {
      // The last scheduled day was not today and wasn't completed
      return { currentStreak: 0, longestStreak: calculateLongestStreak(habit, completedSet) };
    }
  }

  // Count backwards from the current position
  while (completedSet.has(checkDateStr)) {
    currentStreak++;
    checkDate = getPreviousScheduledDate(habit, checkDate);
    checkDateStr = formatDate(checkDate);

    // Safety limit
    if (currentStreak > 1000) break;
  }

  const longestStreak = calculateLongestStreak(habit, completedSet);

  return {
    currentStreak,
    longestStreak: Math.max(currentStreak, longestStreak),
  };
}

/**
 * Calculate the longest streak from all completions
 */
function calculateLongestStreak(
  habit: Doc<"lifeos_habits">,
  completedSet: Set<string>
): number {
  if (completedSet.size === 0) return 0;

  // Sort dates ascending
  const sortedDates = Array.from(completedSet).sort();

  let longestStreak = 0;
  let currentStreak = 0;
  let expectedDate: string | null = null;

  for (const dateStr of sortedDates) {
    if (expectedDate === null) {
      // First completion
      currentStreak = 1;
    } else if (dateStr === expectedDate) {
      // Consecutive scheduled day
      currentStreak++;
    } else {
      // Check if there are any scheduled days between expectedDate and dateStr
      // that weren't completed (which would break the streak)
      const checkDate = parseDate(expectedDate);
      const targetDate = parseDate(dateStr);

      let streakBroken = false;
      while (checkDate < targetDate) {
        const checkStr = formatDate(checkDate);
        if (isHabitScheduledForDate(habit, checkDate) && !completedSet.has(checkStr)) {
          streakBroken = true;
          break;
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }

      if (streakBroken) {
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 1;
      } else {
        currentStreak++;
      }
    }

    // Set expected next date
    expectedDate = formatDate(getNextScheduledDate(habit, parseDate(dateStr)));
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  return longestStreak;
}

/**
 * Check if a habit is scheduled for a specific date
 */
function isHabitScheduledForDate(
  habit: Doc<"lifeos_habits">,
  date: Date
): boolean {
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

/**
 * Get the previous scheduled date for a habit
 */
function getPreviousScheduledDate(
  habit: Doc<"lifeos_habits">,
  fromDate: Date
): Date {
  const date = new Date(fromDate);
  date.setDate(date.getDate() - 1);

  // For daily habits, just return yesterday
  if (habit.frequency === "daily") {
    return date;
  }

  // For weekly habits, find the previous scheduled day
  for (let i = 0; i < 7; i++) {
    if (isHabitScheduledForDate(habit, date)) {
      return date;
    }
    date.setDate(date.getDate() - 1);
  }

  return date;
}

/**
 * Get the next scheduled date for a habit
 */
function getNextScheduledDate(
  habit: Doc<"lifeos_habits">,
  fromDate: Date
): Date {
  const date = new Date(fromDate);
  date.setDate(date.getDate() + 1);

  // For daily habits, just return tomorrow
  if (habit.frequency === "daily") {
    return date;
  }

  // For weekly habits, find the next scheduled day
  for (let i = 0; i < 7; i++) {
    if (isHabitScheduledForDate(habit, date)) {
      return date;
    }
    date.setDate(date.getDate() + 1);
  }

  return date;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD string to Date
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}
