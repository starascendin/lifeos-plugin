import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc, Id } from "../_generated/dataModel";
import { habitFrequencyValidator, dayOfWeekValidator } from "./habits_schema";

// ==================== QUERIES ====================

/**
 * Get all active habits for the authenticated user
 */
export const getHabits = query({
  args: {
    categoryId: v.optional(v.id("lifeos_habitCategories")),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    let habits;
    if (args.categoryId) {
      habits = await ctx.db
        .query("lifeos_habits")
        .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
        .collect();
    } else {
      habits = await ctx.db
        .query("lifeos_habits")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
    }

    // Filter by user (in case of category query) and archived status
    habits = habits.filter((h) => h.userId === user._id);
    if (!args.includeArchived) {
      habits = habits.filter((h) => !h.archivedAt);
    }

    // Sort by sortOrder
    habits.sort((a, b) => a.sortOrder - b.sortOrder);

    return habits;
  },
});

/**
 * Get habits grouped by category
 */
export const getHabitsGroupedByCategory = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Get all categories
    let categories = await ctx.db
      .query("lifeos_habitCategories")
      .withIndex("by_user_order", (q) => q.eq("userId", user._id))
      .collect();

    if (!args.includeArchived) {
      categories = categories.filter((c) => !c.archivedAt);
    }

    // Get all habits
    let habits = await ctx.db
      .query("lifeos_habits")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (!args.includeArchived) {
      habits = habits.filter((h) => !h.archivedAt && h.isActive);
    }

    // Group habits by category
    const grouped: {
      category: Doc<"lifeos_habitCategories"> | null;
      habits: Doc<"lifeos_habits">[];
    }[] = [];

    // Add categorized habits
    for (const category of categories) {
      const categoryHabits = habits
        .filter((h) => h.categoryId === category._id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      grouped.push({
        category,
        habits: categoryHabits,
      });
    }

    // Add uncategorized habits
    const uncategorizedHabits = habits
      .filter((h) => !h.categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    if (uncategorizedHabits.length > 0) {
      grouped.push({
        category: null,
        habits: uncategorizedHabits,
      });
    }

    return grouped;
  },
});

/**
 * Get a single habit by ID
 */
export const getHabit = query({
  args: {
    habitId: v.id("lifeos_habits"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== user._id) {
      return null;
    }

    return habit;
  },
});

/**
 * Get habit with extended stats
 */
export const getHabitWithStats = query({
  args: {
    habitId: v.id("lifeos_habits"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== user._id) {
      return null;
    }

    // Get this month's check-ins
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const endOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;

    const monthCheckIns = await ctx.db
      .query("lifeos_habitCheckIns")
      .withIndex("by_habit_date", (q) =>
        q.eq("habitId", args.habitId).gte("date", startOfMonth)
      )
      .filter((q) => q.lte(q.field("date"), endOfMonth))
      .collect();

    const monthlyCompletions = monthCheckIns.filter((c) => c.completed).length;

    // Calculate scheduled days this month (for completion rate)
    let scheduledDaysThisMonth = 0;
    const today = now.getDate();
    for (let day = 1; day <= today; day++) {
      const date = new Date(now.getFullYear(), now.getMonth(), day);
      if (isHabitScheduledForDate(habit, date)) {
        scheduledDaysThisMonth++;
      }
    }

    const monthlyCompletionRate =
      scheduledDaysThisMonth > 0
        ? Math.round((monthlyCompletions / scheduledDaysThisMonth) * 100)
        : 0;

    return {
      ...habit,
      monthlyCompletions,
      scheduledDaysThisMonth,
      monthlyCompletionRate,
    };
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new habit
 */
export const createHabit = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    categoryId: v.optional(v.id("lifeos_habitCategories")),
    frequency: habitFrequencyValidator,
    targetDays: v.optional(v.array(dayOfWeekValidator)),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Validate category ownership if provided
    if (args.categoryId) {
      const category = await ctx.db.get(args.categoryId);
      if (!category || category.userId !== user._id) {
        throw new Error("Category not found or access denied");
      }
    }

    // Get the highest sortOrder for the target category
    let existingHabits;
    if (args.categoryId) {
      existingHabits = await ctx.db
        .query("lifeos_habits")
        .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
        .collect();
    } else {
      existingHabits = await ctx.db
        .query("lifeos_habits")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("categoryId"), undefined))
        .collect();
    }

    const maxSortOrder = existingHabits.reduce(
      (max, h) => Math.max(max, h.sortOrder),
      -1
    );

    const habitId = await ctx.db.insert("lifeos_habits", {
      userId: user._id,
      categoryId: args.categoryId,
      name: args.name,
      description: args.description,
      icon: args.icon ?? "✅",
      color: args.color,
      frequency: args.frequency,
      targetDays: args.frequency === "weekly" ? args.targetDays : undefined,
      sortOrder: maxSortOrder + 1,
      isActive: true,
      totalCompletions: 0,
      currentStreak: 0,
      longestStreak: 0,
      createdAt: now,
      updatedAt: now,
    });

    return habitId;
  },
});

/**
 * Update a habit
 */
export const updateHabit = mutation({
  args: {
    habitId: v.id("lifeos_habits"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    categoryId: v.optional(v.id("lifeos_habitCategories")),
    frequency: v.optional(habitFrequencyValidator),
    targetDays: v.optional(v.array(dayOfWeekValidator)),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== user._id) {
      throw new Error("Habit not found or access denied");
    }

    // Validate new category ownership if changing
    if (args.categoryId !== undefined && args.categoryId !== null) {
      const category = await ctx.db.get(args.categoryId);
      if (!category || category.userId !== user._id) {
        throw new Error("Category not found or access denied");
      }
    }

    const updates: Partial<Doc<"lifeos_habits">> = {
      updatedAt: now,
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.icon !== undefined) updates.icon = args.icon;
    if (args.color !== undefined) updates.color = args.color;
    if (args.categoryId !== undefined) updates.categoryId = args.categoryId;
    if (args.frequency !== undefined) {
      updates.frequency = args.frequency;
      // Clear targetDays if switching to daily
      if (args.frequency === "daily") {
        updates.targetDays = undefined;
      }
    }
    if (args.targetDays !== undefined) updates.targetDays = args.targetDays;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(args.habitId, updates);
    return args.habitId;
  },
});

/**
 * Move habit to a different category
 */
export const moveHabitToCategory = mutation({
  args: {
    habitId: v.id("lifeos_habits"),
    categoryId: v.optional(v.id("lifeos_habitCategories")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== user._id) {
      throw new Error("Habit not found or access denied");
    }

    // Validate new category ownership if provided
    if (args.categoryId) {
      const category = await ctx.db.get(args.categoryId);
      if (!category || category.userId !== user._id) {
        throw new Error("Category not found or access denied");
      }
    }

    // Get new sortOrder for the target category
    let existingHabits;
    if (args.categoryId) {
      existingHabits = await ctx.db
        .query("lifeos_habits")
        .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
        .collect();
    } else {
      existingHabits = await ctx.db
        .query("lifeos_habits")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("categoryId"), undefined))
        .collect();
    }

    const maxSortOrder = existingHabits.reduce(
      (max, h) => Math.max(max, h.sortOrder),
      -1
    );

    await ctx.db.patch(args.habitId, {
      categoryId: args.categoryId,
      sortOrder: maxSortOrder + 1,
      updatedAt: now,
    });
  },
});

/**
 * Reorder habits within a category
 */
export const reorderHabits = mutation({
  args: {
    habitIds: v.array(v.id("lifeos_habits")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    for (let i = 0; i < args.habitIds.length; i++) {
      const habit = await ctx.db.get(args.habitIds[i]);
      if (!habit || habit.userId !== user._id) {
        throw new Error("Habit not found or access denied");
      }

      await ctx.db.patch(args.habitIds[i], {
        sortOrder: i,
        updatedAt: now,
      });
    }
  },
});

/**
 * Archive a habit (soft delete)
 */
export const archiveHabit = mutation({
  args: {
    habitId: v.id("lifeos_habits"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== user._id) {
      throw new Error("Habit not found or access denied");
    }

    await ctx.db.patch(args.habitId, {
      archivedAt: now,
      isActive: false,
      updatedAt: now,
    });
  },
});

/**
 * Delete a habit permanently (and all its check-ins)
 */
export const deleteHabit = mutation({
  args: {
    habitId: v.id("lifeos_habits"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== user._id) {
      throw new Error("Habit not found or access denied");
    }

    // Delete all check-ins for this habit
    const checkIns = await ctx.db
      .query("lifeos_habitCheckIns")
      .withIndex("by_habit", (q) => q.eq("habitId", args.habitId))
      .collect();

    for (const checkIn of checkIns) {
      await ctx.db.delete(checkIn._id);
    }

    // Delete the habit
    await ctx.db.delete(args.habitId);
  },
});

// ==================== HELPERS ====================

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
