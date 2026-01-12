import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc, Id } from "../_generated/dataModel";
import { INITIATIVE_CATEGORIES } from "./initiatives_schema";

// ==================== HELPER TYPES ====================

interface InitiativeWithDetails extends Doc<"lifeos_yearlyInitiatives"> {
  projects: Array<Doc<"lifeos_pmProjects"> & { completionPercentage: number }>;
  habits: Doc<"lifeos_habits">[];
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
  };
  calculatedProgress: number;
}

interface TimeBasedRollup {
  initiatives: Array<{
    initiative: Doc<"lifeos_yearlyInitiatives">;
    progress: number;
    tasksCompleted: number;
    tasksTotal: number;
    habitsCompleted: number;
    habitsTotal: number;
  }>;
  summary: {
    totalInitiatives: number;
    activeInitiatives: number;
    averageProgress: number;
    totalTasksCompleted: number;
    totalHabitsCompleted: number;
  };
}

// ==================== QUERIES ====================

/**
 * Get full details for a single initiative including all linked items
 */
export const getInitiativeDetails = query({
  args: {
    initiativeId: v.id("lifeos_yearlyInitiatives"),
  },
  handler: async (ctx, args): Promise<InitiativeWithDetails | null> => {
    const user = await requireUser(ctx);

    const initiative = await ctx.db.get(args.initiativeId);
    if (!initiative || initiative.userId !== user._id) {
      return null;
    }

    // Get linked projects
    const projects = await ctx.db
      .query("lifeos_pmProjects")
      .withIndex("by_initiative", (q) =>
        q.eq("initiativeId", args.initiativeId),
      )
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();

    const projectsWithCompletion = projects.map((p) => ({
      ...p,
      completionPercentage:
        p.issueCount > 0
          ? Math.round((p.completedIssueCount / p.issueCount) * 100)
          : 0,
    }));

    // Get linked habits
    const habits = await ctx.db
      .query("lifeos_habits")
      .withIndex("by_initiative", (q) =>
        q.eq("initiativeId", args.initiativeId),
      )
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();

    // Calculate task stats
    let totalTasks = 0;
    let completedTasks = 0;

    for (const project of projects) {
      totalTasks += project.issueCount;
      completedTasks += project.completedIssueCount;

      // Get detailed task breakdown
      const issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();

      // Count in-progress tasks
    }

    // Get all tasks from linked projects for detailed breakdown
    let inProgressTasks = 0;
    let pendingTasks = 0;

    for (const project of projects) {
      const issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();

      for (const issue of issues) {
        if (issue.status === "in_progress" || issue.status === "in_review") {
          inProgressTasks++;
        } else if (issue.status === "backlog" || issue.status === "todo") {
          pendingTasks++;
        }
      }
    }

    const autoProgress =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      ...initiative,
      projects: projectsWithCompletion,
      habits,
      taskStats: {
        total: totalTasks,
        completed: completedTasks,
        inProgress: inProgressTasks,
        pending: pendingTasks,
      },
      calculatedProgress: initiative.manualProgress ?? autoProgress,
    };
  },
});

/**
 * Get yearly rollup - overview of all initiatives for a year
 */
export const getYearlyRollup = query({
  args: {
    year: v.number(),
  },
  handler: async (ctx, args): Promise<TimeBasedRollup> => {
    const user = await requireUser(ctx);

    const initiatives = await ctx.db
      .query("lifeos_yearlyInitiatives")
      .withIndex("by_user_year", (q) =>
        q.eq("userId", user._id).eq("year", args.year),
      )
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();

    const initiativeRollups = await Promise.all(
      initiatives.map(async (initiative) => {
        // Get linked projects
        const projects = await ctx.db
          .query("lifeos_pmProjects")
          .withIndex("by_initiative", (q) =>
            q.eq("initiativeId", initiative._id),
          )
          .filter((q) => q.eq(q.field("archivedAt"), undefined))
          .collect();

        // Get linked habits
        const habits = await ctx.db
          .query("lifeos_habits")
          .withIndex("by_initiative", (q) =>
            q.eq("initiativeId", initiative._id),
          )
          .filter((q) => q.eq(q.field("archivedAt"), undefined))
          .collect();

        // Calculate task totals
        let totalTasks = 0;
        let completedTasks = 0;
        for (const project of projects) {
          totalTasks += project.issueCount;
          completedTasks += project.completedIssueCount;
        }

        const autoProgress =
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return {
          initiative,
          progress: initiative.manualProgress ?? autoProgress,
          tasksCompleted: completedTasks,
          tasksTotal: totalTasks,
          habitsCompleted: habits.filter((h) => h.currentStreak > 0).length,
          habitsTotal: habits.length,
        };
      }),
    );

    // Calculate summary
    const activeInitiatives = initiativeRollups.filter(
      (i) => i.initiative.status === "active",
    ).length;
    const totalProgress = initiativeRollups.reduce(
      (sum, i) => sum + i.progress,
      0,
    );
    const totalTasksCompleted = initiativeRollups.reduce(
      (sum, i) => sum + i.tasksCompleted,
      0,
    );
    const totalHabitsCompleted = initiativeRollups.reduce(
      (sum, i) => sum + i.habitsCompleted,
      0,
    );

    return {
      initiatives: initiativeRollups.sort(
        (a, b) => a.initiative.sortOrder - b.initiative.sortOrder,
      ),
      summary: {
        totalInitiatives: initiatives.length,
        activeInitiatives,
        averageProgress:
          initiatives.length > 0
            ? Math.round(totalProgress / initiatives.length)
            : 0,
        totalTasksCompleted,
        totalHabitsCompleted,
      },
    };
  },
});

/**
 * Get quarterly rollup - initiatives progress for a specific quarter
 */
export const getQuarterlyRollup = query({
  args: {
    year: v.number(),
    quarter: v.number(), // 1, 2, 3, or 4
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Calculate quarter date range
    const quarterStartMonth = (args.quarter - 1) * 3;
    const quarterStart = new Date(args.year, quarterStartMonth, 1);
    const quarterEnd = new Date(args.year, quarterStartMonth + 3, 0); // Last day of quarter

    const quarterStartStr = formatDateStr(quarterStart);
    const quarterEndStr = formatDateStr(quarterEnd);

    // Get all initiatives for the year
    const initiatives = await ctx.db
      .query("lifeos_yearlyInitiatives")
      .withIndex("by_user_year", (q) =>
        q.eq("userId", user._id).eq("year", args.year),
      )
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();

    const initiativeRollups = await Promise.all(
      initiatives.map(async (initiative) => {
        // Get linked projects
        const projects = await ctx.db
          .query("lifeos_pmProjects")
          .withIndex("by_initiative", (q) =>
            q.eq("initiativeId", initiative._id),
          )
          .filter((q) => q.eq(q.field("archivedAt"), undefined))
          .collect();

        // Get tasks completed during this quarter
        let quarterCompletedTasks = 0;
        let totalTasks = 0;

        for (const project of projects) {
          totalTasks += project.issueCount;

          const issues = await ctx.db
            .query("lifeos_pmIssues")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect();

          for (const issue of issues) {
            if (issue.completedAt) {
              const completedDate = new Date(issue.completedAt);
              if (
                completedDate >= quarterStart &&
                completedDate <= quarterEnd
              ) {
                quarterCompletedTasks++;
              }
            }
          }
        }

        // Get habits and their check-ins for the quarter
        const habits = await ctx.db
          .query("lifeos_habits")
          .withIndex("by_initiative", (q) =>
            q.eq("initiativeId", initiative._id),
          )
          .filter((q) => q.eq(q.field("archivedAt"), undefined))
          .collect();

        let quarterHabitCompletions = 0;
        for (const habit of habits) {
          const checkIns = await ctx.db
            .query("lifeos_habitCheckIns")
            .withIndex("by_habit", (q) => q.eq("habitId", habit._id))
            .collect();

          quarterHabitCompletions += checkIns.filter((c) => {
            return (
              c.completed &&
              c.date >= quarterStartStr &&
              c.date <= quarterEndStr
            );
          }).length;
        }

        return {
          initiative,
          quarterTasksCompleted: quarterCompletedTasks,
          quarterHabitCompletions,
          totalTasks,
          totalHabits: habits.length,
        };
      }),
    );

    return {
      year: args.year,
      quarter: args.quarter,
      quarterStart: quarterStartStr,
      quarterEnd: quarterEndStr,
      initiatives: initiativeRollups.sort(
        (a, b) => a.initiative.sortOrder - b.initiative.sortOrder,
      ),
      summary: {
        totalTasksCompleted: initiativeRollups.reduce(
          (sum, i) => sum + i.quarterTasksCompleted,
          0,
        ),
        totalHabitCompletions: initiativeRollups.reduce(
          (sum, i) => sum + i.quarterHabitCompletions,
          0,
        ),
      },
    };
  },
});

/**
 * Get monthly rollup - initiatives progress for a specific month
 */
export const getMonthlyRollup = query({
  args: {
    year: v.number(),
    month: v.number(), // 1-12
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Calculate month date range
    const monthStart = new Date(args.year, args.month - 1, 1);
    const monthEnd = new Date(args.year, args.month, 0); // Last day of month

    const monthStartStr = formatDateStr(monthStart);
    const monthEndStr = formatDateStr(monthEnd);

    // Get all initiatives for the year
    const initiatives = await ctx.db
      .query("lifeos_yearlyInitiatives")
      .withIndex("by_user_year", (q) =>
        q.eq("userId", user._id).eq("year", args.year),
      )
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();

    const initiativeRollups = await Promise.all(
      initiatives.map(async (initiative) => {
        // Get linked projects
        const projects = await ctx.db
          .query("lifeos_pmProjects")
          .withIndex("by_initiative", (q) =>
            q.eq("initiativeId", initiative._id),
          )
          .filter((q) => q.eq(q.field("archivedAt"), undefined))
          .collect();

        // Get tasks completed during this month
        let monthCompletedTasks = 0;

        for (const project of projects) {
          const issues = await ctx.db
            .query("lifeos_pmIssues")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect();

          for (const issue of issues) {
            if (issue.completedAt) {
              const completedDate = new Date(issue.completedAt);
              if (completedDate >= monthStart && completedDate <= monthEnd) {
                monthCompletedTasks++;
              }
            }
          }
        }

        // Get habits check-ins for the month
        const habits = await ctx.db
          .query("lifeos_habits")
          .withIndex("by_initiative", (q) =>
            q.eq("initiativeId", initiative._id),
          )
          .filter((q) => q.eq(q.field("archivedAt"), undefined))
          .collect();

        let monthHabitCompletions = 0;
        for (const habit of habits) {
          const checkIns = await ctx.db
            .query("lifeos_habitCheckIns")
            .withIndex("by_habit", (q) => q.eq("habitId", habit._id))
            .collect();

          monthHabitCompletions += checkIns.filter((c) => {
            return (
              c.completed && c.date >= monthStartStr && c.date <= monthEndStr
            );
          }).length;
        }

        return {
          initiative,
          monthTasksCompleted: monthCompletedTasks,
          monthHabitCompletions,
        };
      }),
    );

    return {
      year: args.year,
      month: args.month,
      monthStart: monthStartStr,
      monthEnd: monthEndStr,
      initiatives: initiativeRollups.sort(
        (a, b) => a.initiative.sortOrder - b.initiative.sortOrder,
      ),
      summary: {
        totalTasksCompleted: initiativeRollups.reduce(
          (sum, i) => sum + i.monthTasksCompleted,
          0,
        ),
        totalHabitCompletions: initiativeRollups.reduce(
          (sum, i) => sum + i.monthHabitCompletions,
          0,
        ),
      },
    };
  },
});

/**
 * Get weekly initiative contribution - what initiatives were worked on this week
 */
export const getWeeklyInitiativeContribution = query({
  args: {
    weekStartDate: v.string(), // YYYY-MM-DD (Monday)
    weekEndDate: v.string(), // YYYY-MM-DD (Sunday)
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const weekStart = new Date(args.weekStartDate);
    const weekEnd = new Date(args.weekEndDate);
    weekEnd.setHours(23, 59, 59, 999);

    // Get the year from the week
    const year = weekStart.getFullYear();

    // Get all initiatives for the year
    const initiatives = await ctx.db
      .query("lifeos_yearlyInitiatives")
      .withIndex("by_user_year", (q) =>
        q.eq("userId", user._id).eq("year", year),
      )
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();

    const contributions = await Promise.all(
      initiatives.map(async (initiative) => {
        // Get linked projects
        const projects = await ctx.db
          .query("lifeos_pmProjects")
          .withIndex("by_initiative", (q) =>
            q.eq("initiativeId", initiative._id),
          )
          .filter((q) => q.eq(q.field("archivedAt"), undefined))
          .collect();

        // Count tasks completed this week
        let weeklyTasksCompleted = 0;
        for (const project of projects) {
          const issues = await ctx.db
            .query("lifeos_pmIssues")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect();

          for (const issue of issues) {
            if (issue.completedAt) {
              const completedDate = new Date(issue.completedAt);
              if (completedDate >= weekStart && completedDate <= weekEnd) {
                weeklyTasksCompleted++;
              }
            }
          }
        }

        // Get habit completions for the week
        const habits = await ctx.db
          .query("lifeos_habits")
          .withIndex("by_initiative", (q) =>
            q.eq("initiativeId", initiative._id),
          )
          .filter((q) => q.eq(q.field("archivedAt"), undefined))
          .collect();

        let weeklyHabitCompletions = 0;
        for (const habit of habits) {
          const checkIns = await ctx.db
            .query("lifeos_habitCheckIns")
            .withIndex("by_habit", (q) => q.eq("habitId", habit._id))
            .collect();

          weeklyHabitCompletions += checkIns.filter((c) => {
            return (
              c.completed &&
              c.date >= args.weekStartDate &&
              c.date <= args.weekEndDate
            );
          }).length;
        }

        return {
          initiative,
          weeklyTasksCompleted,
          weeklyHabitCompletions,
          hasActivity: weeklyTasksCompleted > 0 || weeklyHabitCompletions > 0,
        };
      }),
    );

    // Filter to only initiatives with activity
    const activeContributions = contributions.filter((c) => c.hasActivity);

    return {
      weekStartDate: args.weekStartDate,
      weekEndDate: args.weekEndDate,
      contributions: activeContributions.sort(
        (a, b) => a.initiative.sortOrder - b.initiative.sortOrder,
      ),
      summary: {
        initiativesWorkedOn: activeContributions.length,
        totalTasksCompleted: activeContributions.reduce(
          (sum, c) => sum + c.weeklyTasksCompleted,
          0,
        ),
        totalHabitCompletions: activeContributions.reduce(
          (sum, c) => sum + c.weeklyHabitCompletions,
          0,
        ),
      },
    };
  },
});

/**
 * Get daily initiative contribution - what initiatives were worked on today
 */
export const getDailyInitiativeContribution = query({
  args: {
    date: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const dateObj = new Date(args.date);
    const year = dateObj.getFullYear();

    // Get all initiatives for the year
    const initiatives = await ctx.db
      .query("lifeos_yearlyInitiatives")
      .withIndex("by_user_year", (q) =>
        q.eq("userId", user._id).eq("year", year),
      )
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();

    const contributions = await Promise.all(
      initiatives.map(async (initiative) => {
        // Get linked projects
        const projects = await ctx.db
          .query("lifeos_pmProjects")
          .withIndex("by_initiative", (q) =>
            q.eq("initiativeId", initiative._id),
          )
          .filter((q) => q.eq(q.field("archivedAt"), undefined))
          .collect();

        // Count tasks completed today
        let dailyTasksCompleted = 0;
        const dayStart = new Date(args.date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(args.date);
        dayEnd.setHours(23, 59, 59, 999);

        for (const project of projects) {
          const issues = await ctx.db
            .query("lifeos_pmIssues")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect();

          for (const issue of issues) {
            if (issue.completedAt) {
              const completedDate = new Date(issue.completedAt);
              if (completedDate >= dayStart && completedDate <= dayEnd) {
                dailyTasksCompleted++;
              }
            }
          }
        }

        // Get habit completions for today
        const habits = await ctx.db
          .query("lifeos_habits")
          .withIndex("by_initiative", (q) =>
            q.eq("initiativeId", initiative._id),
          )
          .filter((q) => q.eq(q.field("archivedAt"), undefined))
          .collect();

        let dailyHabitCompletions = 0;
        for (const habit of habits) {
          const checkIn = await ctx.db
            .query("lifeos_habitCheckIns")
            .withIndex("by_habit_date", (q) =>
              q.eq("habitId", habit._id).eq("date", args.date),
            )
            .first();

          if (checkIn?.completed) {
            dailyHabitCompletions++;
          }
        }

        return {
          initiative,
          dailyTasksCompleted,
          dailyHabitCompletions,
          totalHabits: habits.length,
          hasActivity: dailyTasksCompleted > 0 || dailyHabitCompletions > 0,
        };
      }),
    );

    // Filter to only initiatives with activity or habits due today
    const relevantContributions = contributions.filter(
      (c) => c.hasActivity || c.totalHabits > 0,
    );

    return {
      date: args.date,
      contributions: relevantContributions.sort(
        (a, b) => a.initiative.sortOrder - b.initiative.sortOrder,
      ),
      summary: {
        initiativesWorkedOn: contributions.filter((c) => c.hasActivity).length,
        totalTasksCompleted: contributions.reduce(
          (sum, c) => sum + c.dailyTasksCompleted,
          0,
        ),
        totalHabitCompletions: contributions.reduce(
          (sum, c) => sum + c.dailyHabitCompletions,
          0,
        ),
      },
    };
  },
});

/**
 * Get category summary - progress grouped by category
 */
export const getCategorySummary = query({
  args: {
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const initiatives = await ctx.db
      .query("lifeos_yearlyInitiatives")
      .withIndex("by_user_year", (q) =>
        q.eq("userId", user._id).eq("year", args.year),
      )
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();

    // Group by category
    const categoryGroups: Record<
      string,
      {
        initiatives: Doc<"lifeos_yearlyInitiatives">[];
        totalProgress: number;
        count: number;
      }
    > = {};

    for (const category of Object.keys(INITIATIVE_CATEGORIES)) {
      categoryGroups[category] = {
        initiatives: [],
        totalProgress: 0,
        count: 0,
      };
    }

    for (const initiative of initiatives) {
      const group = categoryGroups[initiative.category];
      if (group) {
        group.initiatives.push(initiative);
        group.totalProgress +=
          initiative.manualProgress ?? initiative.autoProgress ?? 0;
        group.count++;
      }
    }

    return Object.entries(categoryGroups).map(([category, data]) => ({
      category,
      label:
        INITIATIVE_CATEGORIES[category as keyof typeof INITIATIVE_CATEGORIES]
          .label,
      color:
        INITIATIVE_CATEGORIES[category as keyof typeof INITIATIVE_CATEGORIES]
          .color,
      icon: INITIATIVE_CATEGORIES[
        category as keyof typeof INITIATIVE_CATEGORIES
      ].icon,
      initiativeCount: data.count,
      averageProgress:
        data.count > 0 ? Math.round(data.totalProgress / data.count) : 0,
      initiatives: data.initiatives,
    }));
  },
});

// ==================== HELPERS ====================

function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
