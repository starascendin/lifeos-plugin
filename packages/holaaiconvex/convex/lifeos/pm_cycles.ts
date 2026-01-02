import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc, Id } from "../_generated/dataModel";
import {
  cycleStatusValidator,
  cycleRetrospectiveValidator,
} from "./pm_schema";

type IssueStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled";

// ==================== QUERIES ====================

/**
 * Get all cycles for the authenticated user
 */
export const getCycles = query({
  args: {
    projectId: v.optional(v.id("lifeos_pmProjects")),
    status: v.optional(cycleStatusValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 50;

    let cycles;
    if (args.projectId) {
      cycles = await ctx.db
        .query("lifeos_pmCycles")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .order("desc")
        .take(limit);
      // Filter by user
      cycles = cycles.filter((c) => c.userId === user._id);
    } else if (args.status) {
      cycles = await ctx.db
        .query("lifeos_pmCycles")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    } else {
      cycles = await ctx.db
        .query("lifeos_pmCycles")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(limit);
    }

    return cycles;
  },
});

/**
 * Get the current active cycle
 */
export const getCurrentCycle = query({
  args: {
    projectId: v.optional(v.id("lifeos_pmProjects")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    let activeCycles = await ctx.db
      .query("lifeos_pmCycles")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .collect();

    if (args.projectId) {
      activeCycles = activeCycles.filter(
        (c) => c.projectId === args.projectId
      );
    }

    // Return the most recently started active cycle
    return activeCycles.sort((a, b) => b.startDate - a.startDate)[0] ?? null;
  },
});

/**
 * Get upcoming cycles
 */
export const getUpcomingCycles = query({
  args: {
    projectId: v.optional(v.id("lifeos_pmProjects")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 10;

    let cycles = await ctx.db
      .query("lifeos_pmCycles")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "upcoming")
      )
      .take(limit);

    if (args.projectId) {
      cycles = cycles.filter((c) => c.projectId === args.projectId);
    }

    // Sort by start date (soonest first)
    return cycles.sort((a, b) => a.startDate - b.startDate);
  },
});

/**
 * Get a single cycle by ID
 */
export const getCycle = query({
  args: {
    cycleId: v.id("lifeos_pmCycles"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.userId !== user._id) {
      return null;
    }

    return cycle;
  },
});

/**
 * Get cycle with its issues
 */
export const getCycleWithIssues = query({
  args: {
    cycleId: v.id("lifeos_pmCycles"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.userId !== user._id) {
      return null;
    }

    const issues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();

    // Calculate progress
    const completedCount = issues.filter((i) => i.status === "done").length;
    const completionPercentage =
      issues.length > 0
        ? Math.round((completedCount / issues.length) * 100)
        : 0;

    return {
      ...cycle,
      issues,
      completionPercentage,
    };
  },
});

/**
 * Get cycle with full breakdown data for the detail view
 * Includes stats, issues grouped by status, and breakdowns by priority/label/project
 */
export const getCycleWithBreakdowns = query({
  args: {
    cycleId: v.id("lifeos_pmCycles"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.userId !== user._id) {
      return null;
    }

    // Get all issues in this cycle
    const issues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();

    // Filter by user
    const userIssues = issues.filter((i) => i.userId === user._id);

    // Calculate stats
    const scopeCount = userIssues.length;
    const startedCount = userIssues.filter(
      (i) => i.status === "in_progress" || i.status === "in_review"
    ).length;
    const completedCount = userIssues.filter((i) => i.status === "done").length;
    const todoCount = userIssues.filter(
      (i) => i.status === "backlog" || i.status === "todo"
    ).length;

    // Calculate weekdays remaining
    const now = new Date();
    const endDate = new Date(cycle.endDate);
    let weekdaysLeft = 0;
    const current = new Date(now);
    current.setHours(0, 0, 0, 0);

    while (current <= endDate) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) weekdaysLeft++;
      current.setDate(current.getDate() + 1);
    }

    // Group issues by status
    const issuesByStatus: Record<IssueStatus, typeof userIssues> = {
      backlog: [],
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
      cancelled: [],
    };
    for (const issue of userIssues) {
      issuesByStatus[issue.status as IssueStatus].push(issue);
    }

    // Sort each group by sortOrder
    for (const status of Object.keys(issuesByStatus) as IssueStatus[]) {
      issuesByStatus[status].sort((a, b) => a.sortOrder - b.sortOrder);
    }

    // Group by priority
    const priorityCounts: Record<string, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    };
    for (const issue of userIssues) {
      priorityCounts[issue.priority] = (priorityCounts[issue.priority] || 0) + 1;
    }
    const byPriority = Object.entries(priorityCounts)
      .filter(([_, count]) => count > 0)
      .map(([priority, count]) => ({
        priority,
        count,
        percent: scopeCount > 0 ? Math.round((count / scopeCount) * 100) : 0,
      }));

    // Group by label
    const labelCounts: Map<string, { labelId: Id<"lifeos_pmLabels">; count: number }> = new Map();
    for (const issue of userIssues) {
      for (const labelId of issue.labelIds) {
        const existing = labelCounts.get(labelId);
        if (existing) {
          existing.count++;
        } else {
          labelCounts.set(labelId, { labelId, count: 1 });
        }
      }
    }

    // Fetch label details
    const byLabel = await Promise.all(
      Array.from(labelCounts.values()).map(async ({ labelId, count }) => {
        const label = await ctx.db.get(labelId);
        return {
          labelId,
          labelName: label?.name ?? "Unknown",
          color: label?.color ?? "#888888",
          count,
          percent: scopeCount > 0 ? Math.round((count / scopeCount) * 100) : 0,
        };
      })
    );

    // Group by project
    const projectCounts: Map<string, { projectId: Id<"lifeos_pmProjects">; count: number }> = new Map();
    const noProjectCount = userIssues.filter((i) => !i.projectId).length;

    for (const issue of userIssues) {
      if (issue.projectId) {
        const existing = projectCounts.get(issue.projectId);
        if (existing) {
          existing.count++;
        } else {
          projectCounts.set(issue.projectId, { projectId: issue.projectId, count: 1 });
        }
      }
    }

    // Fetch project details
    const byProject = await Promise.all(
      Array.from(projectCounts.values()).map(async ({ projectId, count }) => {
        const project = await ctx.db.get(projectId);
        return {
          projectId,
          projectName: project?.name ?? "Unknown",
          color: project?.color,
          count,
          percent: scopeCount > 0 ? Math.round((count / scopeCount) * 100) : 0,
        };
      })
    );

    // Add "No project" entry if there are unassigned issues
    if (noProjectCount > 0) {
      byProject.push({
        projectId: null as unknown as Id<"lifeos_pmProjects">,
        projectName: "No project",
        color: undefined,
        count: noProjectCount,
        percent: scopeCount > 0 ? Math.round((noProjectCount / scopeCount) * 100) : 0,
      });
    }

    return {
      cycle,
      issues: userIssues,
      issuesByStatus,
      stats: {
        scopeCount,
        startedCount,
        completedCount,
        todoCount,
        weekdaysLeft,
        capacityPercent: scopeCount > 0 ? Math.round((completedCount / scopeCount) * 100) : 0,
        startedPercent: scopeCount > 0 ? Math.round((startedCount / scopeCount) * 100) : 0,
      },
      breakdowns: {
        byPriority,
        byLabel,
        byProject,
      },
    };
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new cycle
 */
export const createCycle = mutation({
  args: {
    projectId: v.optional(v.id("lifeos_pmProjects")),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    goals: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // If projectId provided, verify user owns the project
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId !== user._id) {
        throw new Error("Project not found or access denied");
      }
    }

    // Get the next cycle number
    const existingCycles = await ctx.db
      .query("lifeos_pmCycles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const maxNumber = existingCycles.reduce(
      (max, c) => Math.max(max, c.number),
      0
    );

    // Determine status based on dates
    let status: "upcoming" | "active" | "completed" = "upcoming";
    if (now >= args.startDate && now <= args.endDate) {
      status = "active";
    } else if (now > args.endDate) {
      status = "completed";
    }

    const cycleId = await ctx.db.insert("lifeos_pmCycles", {
      userId: user._id,
      projectId: args.projectId,
      number: maxNumber + 1,
      name: args.name,
      description: args.description,
      startDate: args.startDate,
      endDate: args.endDate,
      status,
      goals: args.goals,
      issueCount: 0,
      completedIssueCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return cycleId;
  },
});

/**
 * Update a cycle
 */
export const updateCycle = mutation({
  args: {
    cycleId: v.id("lifeos_pmCycles"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    status: v.optional(cycleStatusValidator),
    goals: v.optional(v.array(v.string())),
    retrospective: v.optional(cycleRetrospectiveValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.userId !== user._id) {
      throw new Error("Cycle not found or access denied");
    }

    const updates: Partial<Doc<"lifeos_pmCycles">> = {
      updatedAt: now,
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.startDate !== undefined) updates.startDate = args.startDate;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.status !== undefined) updates.status = args.status;
    if (args.goals !== undefined) updates.goals = args.goals;
    if (args.retrospective !== undefined)
      updates.retrospective = args.retrospective;

    await ctx.db.patch(args.cycleId, updates);
    return args.cycleId;
  },
});

/**
 * Delete a cycle
 * Removes cycle assignment from all issues but doesn't delete them
 */
export const deleteCycle = mutation({
  args: {
    cycleId: v.id("lifeos_pmCycles"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.userId !== user._id) {
      throw new Error("Cycle not found or access denied");
    }

    // Remove cycle assignment from all issues
    const issues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();

    for (const issue of issues) {
      await ctx.db.patch(issue._id, {
        cycleId: undefined,
        updatedAt: Date.now(),
      });
    }

    // Delete the cycle
    await ctx.db.delete(args.cycleId);
  },
});

/**
 * Update cycle status based on current date
 * Should be called periodically or on app load
 */
export const updateCycleStatuses = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const cycles = await ctx.db
      .query("lifeos_pmCycles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const cycle of cycles) {
      let newStatus: "upcoming" | "active" | "completed" = cycle.status;

      if (now < cycle.startDate) {
        newStatus = "upcoming";
      } else if (now >= cycle.startDate && now <= cycle.endDate) {
        newStatus = "active";
      } else if (now > cycle.endDate) {
        newStatus = "completed";
      }

      if (newStatus !== cycle.status) {
        await ctx.db.patch(cycle._id, {
          status: newStatus,
          updatedAt: now,
        });
      }
    }
  },
});

/**
 * Update cycle issue counts (called internally when issues change)
 */
export const updateCycleCounts = mutation({
  args: {
    cycleId: v.id("lifeos_pmCycles"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.userId !== user._id) {
      throw new Error("Cycle not found or access denied");
    }

    // Count all issues in cycle
    const allIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();

    const issueCount = allIssues.length;
    const completedIssueCount = allIssues.filter(
      (i) => i.status === "done"
    ).length;

    await ctx.db.patch(args.cycleId, {
      issueCount,
      completedIssueCount,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Generate multiple cycles based on global user settings
 */
export const generateCycles = mutation({
  args: {
    count: v.optional(v.number()), // Override default count
    startFrom: v.optional(v.number()), // Override start date (timestamp)
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Get user settings for cycle configuration
    const userSettings = await ctx.db
      .query("lifeos_pmUserSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Use user settings or defaults
    const duration = userSettings?.cycleSettings?.duration ?? "2_weeks";
    const startDay = userSettings?.cycleSettings?.startDay ?? "monday";
    const count =
      args.count ?? userSettings?.cycleSettings?.defaultCyclesToCreate ?? 4;
    // Timezone offset in minutes (e.g., -420 for UTC-7/Denver)
    // Note: JavaScript's getTimezoneOffset() returns minutes WEST of UTC (opposite sign)
    // So we store the negated value to get standard UTC offset
    const tzOffsetMinutes =
      userSettings?.cycleSettings?.timezoneOffsetMinutes ?? 0;
    const tzOffsetMs = tzOffsetMinutes * 60 * 1000;

    // Calculate duration in milliseconds
    const durationMs =
      duration === "1_week"
        ? 7 * 24 * 60 * 60 * 1000
        : 14 * 24 * 60 * 60 * 1000;

    // Find next start date based on startDay
    // We need to calculate the day-of-week in the USER's timezone
    let startDate = args.startFrom ?? now;
    const targetDayNum = startDay === "sunday" ? 0 : 1;

    // Convert to user's local time to determine day-of-week
    // tzOffsetMs is positive for UTC+ timezones, negative for UTC- timezones
    // To get local time: UTC + offset
    const localTimeMs = startDate + tzOffsetMs;
    const currentDate = new Date(localTimeMs);
    const currentDay = currentDate.getUTCDay(); // Day in user's timezone
    const daysUntilTarget = (targetDayNum - currentDay + 7) % 7;

    // If today is the target day and no startFrom provided, use next week's target day
    if (daysUntilTarget === 0 && !args.startFrom) {
      startDate += 7 * 24 * 60 * 60 * 1000;
    } else if (daysUntilTarget > 0) {
      startDate += daysUntilTarget * 24 * 60 * 60 * 1000;
    }

    // Normalize to midnight in USER's timezone
    // First convert to local time, then truncate to midnight, then convert back to UTC
    const localStartMs = startDate + tzOffsetMs;
    const startDateObj = new Date(localStartMs);
    startDateObj.setUTCHours(0, 0, 0, 0);
    startDate = startDateObj.getTime() - tzOffsetMs;

    // Get existing max cycle number globally for this user
    const existingCycles = await ctx.db
      .query("lifeos_pmCycles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    let nextNumber =
      existingCycles.reduce((max, c) => Math.max(max, c.number), 0) + 1;

    // Generate cycles
    const cycleIds = [];
    for (let i = 0; i < count; i++) {
      const cycleStartDate = startDate + i * durationMs;
      const cycleEndDate = cycleStartDate + durationMs - 1; // End 1ms before next cycle starts

      // Determine status based on current date
      let status: "upcoming" | "active" | "completed" = "upcoming";
      if (now >= cycleStartDate && now <= cycleEndDate) {
        status = "active";
      } else if (now > cycleEndDate) {
        status = "completed";
      }

      const cycleId = await ctx.db.insert("lifeos_pmCycles", {
        userId: user._id,
        number: nextNumber++,
        startDate: cycleStartDate,
        endDate: cycleEndDate,
        status,
        issueCount: 0,
        completedIssueCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      cycleIds.push(cycleId);
    }

    return cycleIds;
  },
});

/**
 * Ensure there are upcoming cycles - auto-generate if needed
 * Called on app load and by cron job
 * Returns the number of cycles generated (0 if none needed)
 */
export const ensureUpcomingCycles = mutation({
  args: {
    minUpcoming: v.optional(v.number()), // Minimum upcoming cycles to maintain (default: 2)
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const minUpcoming = args.minUpcoming ?? 2;

    // Get user settings
    const userSettings = await ctx.db
      .query("lifeos_pmUserSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // If no settings configured, don't auto-generate
    if (!userSettings?.cycleSettings) {
      return { generated: 0, reason: "no_settings" };
    }

    // Count upcoming cycles
    const upcomingCycles = await ctx.db
      .query("lifeos_pmCycles")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "upcoming")
      )
      .collect();

    // If we have enough upcoming cycles, no need to generate
    if (upcomingCycles.length >= minUpcoming) {
      return { generated: 0, reason: "sufficient_cycles" };
    }

    // Calculate how many cycles to generate
    const cyclesToGenerate = userSettings.cycleSettings.defaultCyclesToCreate;

    // Find the latest cycle end date to start from
    const allCycles = await ctx.db
      .query("lifeos_pmCycles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    let startFrom: number | undefined;
    if (allCycles.length > 0) {
      const latestEndDate = Math.max(...allCycles.map((c) => c.endDate));
      // Start from the day after the latest cycle ends
      startFrom = latestEndDate + 1;
    }

    // Use settings
    const duration = userSettings.cycleSettings.duration;
    const startDay = userSettings.cycleSettings.startDay;
    const tzOffsetMinutes =
      userSettings.cycleSettings.timezoneOffsetMinutes ?? 0;
    const tzOffsetMs = tzOffsetMinutes * 60 * 1000;

    // Calculate duration in milliseconds
    const durationMs =
      duration === "1_week"
        ? 7 * 24 * 60 * 60 * 1000
        : 14 * 24 * 60 * 60 * 1000;

    // Find next start date based on startDay (in user's timezone)
    let startDate = startFrom ?? now;
    const targetDayNum = startDay === "sunday" ? 0 : 1;

    // Convert to user's local time to determine day-of-week
    const localTimeMs = startDate + tzOffsetMs;
    const currentDate = new Date(localTimeMs);
    const currentDay = currentDate.getUTCDay(); // Day in user's timezone
    const daysUntilTarget = (targetDayNum - currentDay + 7) % 7;

    // If today is the target day and no startFrom provided, use next week
    if (daysUntilTarget === 0 && !startFrom) {
      startDate += 7 * 24 * 60 * 60 * 1000;
    } else if (daysUntilTarget > 0) {
      startDate += daysUntilTarget * 24 * 60 * 60 * 1000;
    }

    // Normalize to midnight in USER's timezone
    const localStartMs = startDate + tzOffsetMs;
    const startDateObj = new Date(localStartMs);
    startDateObj.setUTCHours(0, 0, 0, 0);
    startDate = startDateObj.getTime() - tzOffsetMs;

    // Get existing max cycle number
    let nextNumber =
      allCycles.reduce((max, c) => Math.max(max, c.number), 0) + 1;

    // Generate cycles
    const cycleIds = [];
    for (let i = 0; i < cyclesToGenerate; i++) {
      const cycleStartDate = startDate + i * durationMs;
      const cycleEndDate = cycleStartDate + durationMs - 1;

      // Determine status based on current date
      let status: "upcoming" | "active" | "completed" = "upcoming";
      if (now >= cycleStartDate && now <= cycleEndDate) {
        status = "active";
      } else if (now > cycleEndDate) {
        status = "completed";
      }

      const cycleId = await ctx.db.insert("lifeos_pmCycles", {
        userId: user._id,
        number: nextNumber++,
        startDate: cycleStartDate,
        endDate: cycleEndDate,
        status,
        issueCount: 0,
        completedIssueCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      cycleIds.push(cycleId);
    }

    return { generated: cycleIds.length, reason: "auto_generated", cycleIds };
  },
});

// ==================== INTERNAL MUTATIONS (for cron jobs) ====================

/**
 * Internal: Process a single user for cycle auto-generation
 * Called by the cron job
 */
export const _autoGenerateCyclesForUser = internalMutation({
  args: {
    userId: v.id("users"),
    minUpcoming: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get user settings
    const userSettings = await ctx.db
      .query("lifeos_pmUserSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // If no settings configured, skip
    if (!userSettings?.cycleSettings) {
      return { generated: 0, reason: "no_settings" };
    }

    // First, update cycle statuses based on current date
    const allCycles = await ctx.db
      .query("lifeos_pmCycles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const cycle of allCycles) {
      let newStatus: "upcoming" | "active" | "completed" = cycle.status;

      if (now < cycle.startDate) {
        newStatus = "upcoming";
      } else if (now >= cycle.startDate && now <= cycle.endDate) {
        newStatus = "active";
      } else if (now > cycle.endDate) {
        newStatus = "completed";
      }

      if (newStatus !== cycle.status) {
        await ctx.db.patch(cycle._id, {
          status: newStatus,
          updatedAt: now,
        });
      }
    }

    // Count upcoming cycles (after status update)
    const upcomingCycles = allCycles.filter(
      (c) => now < c.startDate || (now >= c.startDate && now <= c.endDate && c.status !== "completed")
    );
    const actualUpcoming = upcomingCycles.filter((c) => now < c.startDate);

    // If we have enough upcoming cycles, no need to generate
    if (actualUpcoming.length >= args.minUpcoming) {
      return { generated: 0, reason: "sufficient_cycles" };
    }

    // Calculate how many cycles to generate
    const cyclesToGenerate = userSettings.cycleSettings.defaultCyclesToCreate;

    // Find the latest cycle end date to start from
    let startFrom: number | undefined;
    if (allCycles.length > 0) {
      const latestEndDate = Math.max(...allCycles.map((c) => c.endDate));
      startFrom = latestEndDate + 1;
    }

    // Use settings
    const duration = userSettings.cycleSettings.duration;
    const startDay = userSettings.cycleSettings.startDay;
    const tzOffsetMinutes =
      userSettings.cycleSettings.timezoneOffsetMinutes ?? 0;
    const tzOffsetMs = tzOffsetMinutes * 60 * 1000;

    // Calculate duration in milliseconds
    const durationMs =
      duration === "1_week"
        ? 7 * 24 * 60 * 60 * 1000
        : 14 * 24 * 60 * 60 * 1000;

    // Find next start date based on startDay (in user's timezone)
    let startDate = startFrom ?? now;
    const targetDayNum = startDay === "sunday" ? 0 : 1;

    // Convert to user's local time to determine day-of-week
    const localTimeMs = startDate + tzOffsetMs;
    const currentDate = new Date(localTimeMs);
    const currentDay = currentDate.getUTCDay(); // Day in user's timezone
    const daysUntilTarget = (targetDayNum - currentDay + 7) % 7;

    if (daysUntilTarget === 0 && !startFrom) {
      startDate += 7 * 24 * 60 * 60 * 1000;
    } else if (daysUntilTarget > 0) {
      startDate += daysUntilTarget * 24 * 60 * 60 * 1000;
    }

    // Normalize to midnight in USER's timezone
    const localStartMs = startDate + tzOffsetMs;
    const startDateObj = new Date(localStartMs);
    startDateObj.setUTCHours(0, 0, 0, 0);
    startDate = startDateObj.getTime() - tzOffsetMs;

    // Get existing max cycle number
    let nextNumber =
      allCycles.reduce((max, c) => Math.max(max, c.number), 0) + 1;

    // Generate cycles
    let generated = 0;
    for (let i = 0; i < cyclesToGenerate; i++) {
      const cycleStartDate = startDate + i * durationMs;
      const cycleEndDate = cycleStartDate + durationMs - 1;

      let status: "upcoming" | "active" | "completed" = "upcoming";
      if (now >= cycleStartDate && now <= cycleEndDate) {
        status = "active";
      } else if (now > cycleEndDate) {
        status = "completed";
      }

      await ctx.db.insert("lifeos_pmCycles", {
        userId: args.userId,
        number: nextNumber++,
        startDate: cycleStartDate,
        endDate: cycleEndDate,
        status,
        issueCount: 0,
        completedIssueCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      generated++;
    }

    return { generated, reason: "auto_generated" };
  },
});

/**
 * Internal: Get all users with cycle settings for cron processing
 */
export const _getUsersWithCycleSettings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allSettings = await ctx.db
      .query("lifeos_pmUserSettings")
      .collect();

    // Return user IDs that have cycle settings configured
    return allSettings
      .filter((s) => s.cycleSettings)
      .map((s) => s.userId);
  },
});
