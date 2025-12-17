import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc } from "../_generated/dataModel";
import { cycleStatusValidator } from "./pm_schema";

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
