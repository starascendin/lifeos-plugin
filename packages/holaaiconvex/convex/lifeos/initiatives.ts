import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc } from "../_generated/dataModel";
import {
  initiativeCategoryValidator,
  initiativeStatusValidator,
} from "./initiatives_schema";

// ==================== QUERIES ====================

/**
 * Get all initiatives for the authenticated user
 */
export const getInitiatives = query({
  args: {
    year: v.optional(v.number()),
    status: v.optional(initiativeStatusValidator),
    category: v.optional(initiativeCategoryValidator),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    let initiatives;

    if (args.year && args.status) {
      initiatives = await ctx.db
        .query("lifeos_yearlyInitiatives")
        .withIndex("by_user_year_status", (q) =>
          q
            .eq("userId", user._id)
            .eq("year", args.year!)
            .eq("status", args.status!),
        )
        .order("asc")
        .collect();
    } else if (args.year) {
      initiatives = await ctx.db
        .query("lifeos_yearlyInitiatives")
        .withIndex("by_user_year", (q) =>
          q.eq("userId", user._id).eq("year", args.year!),
        )
        .order("asc")
        .collect();
    } else if (args.category) {
      initiatives = await ctx.db
        .query("lifeos_yearlyInitiatives")
        .withIndex("by_user_category", (q) =>
          q.eq("userId", user._id).eq("category", args.category!),
        )
        .order("asc")
        .collect();
    } else {
      initiatives = await ctx.db
        .query("lifeos_yearlyInitiatives")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("asc")
        .collect();
    }

    // Filter out archived unless explicitly requested
    if (!args.includeArchived) {
      initiatives = initiatives.filter((i) => !i.archivedAt);
    }

    // Sort by sortOrder
    return initiatives.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/**
 * Get a single initiative by ID
 */
export const getInitiative = query({
  args: {
    initiativeId: v.id("lifeos_yearlyInitiatives"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const initiative = await ctx.db.get(args.initiativeId);
    if (!initiative || initiative.userId !== user._id) {
      return null;
    }

    return initiative;
  },
});

/**
 * Get initiatives for a specific year with linked projects and habits count
 */
export const getInitiativesWithStats = query({
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

    // Get stats for each initiative
    const initiativesWithStats = await Promise.all(
      initiatives.map(async (initiative) => {
        // Count linked projects
        const projects = await ctx.db
          .query("lifeos_pmProjects")
          .withIndex("by_initiative", (q) =>
            q.eq("initiativeId", initiative._id),
          )
          .filter((q) => q.eq(q.field("archivedAt"), undefined))
          .collect();

        // Count linked habits
        const habits = await ctx.db
          .query("lifeos_habits")
          .withIndex("by_initiative", (q) =>
            q.eq("initiativeId", initiative._id),
          )
          .filter((q) => q.eq(q.field("archivedAt"), undefined))
          .collect();

        // Calculate task stats from projects
        let totalTasks = 0;
        let completedTasks = 0;
        for (const project of projects) {
          totalTasks += project.issueCount;
          completedTasks += project.completedIssueCount;
        }

        // Calculate auto progress
        const autoProgress =
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return {
          ...initiative,
          projectCount: projects.length,
          habitCount: habits.length,
          taskCount: totalTasks,
          completedTaskCount: completedTasks,
          calculatedProgress: initiative.manualProgress ?? autoProgress,
        };
      }),
    );

    return initiativesWithStats.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/**
 * Get available years that have initiatives
 */
export const getInitiativeYears = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const initiatives = await ctx.db
      .query("lifeos_yearlyInitiatives")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const years = [...new Set(initiatives.map((i) => i.year))];
    return years.sort((a, b) => b - a); // Descending order
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new initiative
 */
export const createInitiative = mutation({
  args: {
    year: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
    category: initiativeCategoryValidator,
    status: v.optional(initiativeStatusValidator),
    targetMetric: v.optional(v.string()),
    manualProgress: v.optional(v.number()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Get the highest sortOrder for this user's initiatives
    const existingInitiatives = await ctx.db
      .query("lifeos_yearlyInitiatives")
      .withIndex("by_user_year", (q) =>
        q.eq("userId", user._id).eq("year", args.year),
      )
      .collect();

    const maxSortOrder = existingInitiatives.reduce(
      (max, i) => Math.max(max, i.sortOrder),
      -1,
    );

    const initiativeId = await ctx.db.insert("lifeos_yearlyInitiatives", {
      userId: user._id,
      year: args.year,
      title: args.title,
      description: args.description,
      category: args.category,
      status: args.status ?? "active",
      targetMetric: args.targetMetric,
      manualProgress: args.manualProgress,
      color: args.color,
      icon: args.icon,
      sortOrder: maxSortOrder + 1,
      createdAt: now,
      updatedAt: now,
    });

    return initiativeId;
  },
});

/**
 * Update an initiative
 */
export const updateInitiative = mutation({
  args: {
    initiativeId: v.id("lifeos_yearlyInitiatives"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    category: v.optional(initiativeCategoryValidator),
    status: v.optional(initiativeStatusValidator),
    targetMetric: v.optional(v.union(v.string(), v.null())),
    manualProgress: v.optional(v.union(v.number(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
    icon: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const initiative = await ctx.db.get(args.initiativeId);
    if (!initiative || initiative.userId !== user._id) {
      throw new Error("Initiative not found or access denied");
    }

    const updates: Partial<Doc<"lifeos_yearlyInitiatives">> = {
      updatedAt: now,
    };

    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) {
      updates.description =
        args.description === null ? undefined : args.description;
    }
    if (args.category !== undefined) updates.category = args.category;
    if (args.status !== undefined) updates.status = args.status;
    if (args.targetMetric !== undefined) {
      updates.targetMetric =
        args.targetMetric === null ? undefined : args.targetMetric;
    }
    if (args.manualProgress !== undefined) {
      updates.manualProgress =
        args.manualProgress === null ? undefined : args.manualProgress;
    }
    if (args.color !== undefined) {
      updates.color = args.color === null ? undefined : args.color;
    }
    if (args.icon !== undefined) {
      updates.icon = args.icon === null ? undefined : args.icon;
    }

    await ctx.db.patch(args.initiativeId, updates);
    return args.initiativeId;
  },
});

/**
 * Update initiative sort order (for drag-and-drop reordering)
 */
export const updateInitiativeSortOrder = mutation({
  args: {
    initiativeId: v.id("lifeos_yearlyInitiatives"),
    newSortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const initiative = await ctx.db.get(args.initiativeId);
    if (!initiative || initiative.userId !== user._id) {
      throw new Error("Initiative not found or access denied");
    }

    await ctx.db.patch(args.initiativeId, {
      sortOrder: args.newSortOrder,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Reorder initiatives (batch update sort orders)
 */
export const reorderInitiatives = mutation({
  args: {
    orderedIds: v.array(v.id("lifeos_yearlyInitiatives")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    for (let i = 0; i < args.orderedIds.length; i++) {
      const initiative = await ctx.db.get(args.orderedIds[i]);
      if (!initiative || initiative.userId !== user._id) {
        continue;
      }
      await ctx.db.patch(args.orderedIds[i], {
        sortOrder: i,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Archive an initiative (soft delete)
 */
export const archiveInitiative = mutation({
  args: {
    initiativeId: v.id("lifeos_yearlyInitiatives"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const initiative = await ctx.db.get(args.initiativeId);
    if (!initiative || initiative.userId !== user._id) {
      throw new Error("Initiative not found or access denied");
    }

    await ctx.db.patch(args.initiativeId, {
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Unarchive an initiative
 */
export const unarchiveInitiative = mutation({
  args: {
    initiativeId: v.id("lifeos_yearlyInitiatives"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const initiative = await ctx.db.get(args.initiativeId);
    if (!initiative || initiative.userId !== user._id) {
      throw new Error("Initiative not found or access denied");
    }

    await ctx.db.patch(args.initiativeId, {
      archivedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Permanently delete an initiative
 * Note: This does NOT delete linked projects/habits, just unlinks them
 */
export const deleteInitiative = mutation({
  args: {
    initiativeId: v.id("lifeos_yearlyInitiatives"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const initiative = await ctx.db.get(args.initiativeId);
    if (!initiative || initiative.userId !== user._id) {
      throw new Error("Initiative not found or access denied");
    }

    // Unlink all projects
    const linkedProjects = await ctx.db
      .query("lifeos_pmProjects")
      .withIndex("by_initiative", (q) =>
        q.eq("initiativeId", args.initiativeId),
      )
      .collect();

    for (const project of linkedProjects) {
      await ctx.db.patch(project._id, {
        initiativeId: undefined,
        updatedAt: Date.now(),
      });
    }

    // Unlink all habits
    const linkedHabits = await ctx.db
      .query("lifeos_habits")
      .withIndex("by_initiative", (q) =>
        q.eq("initiativeId", args.initiativeId),
      )
      .collect();

    for (const habit of linkedHabits) {
      await ctx.db.patch(habit._id, {
        initiativeId: undefined,
        updatedAt: Date.now(),
      });
    }

    // Delete the initiative
    await ctx.db.delete(args.initiativeId);
  },
});

/**
 * Update auto-calculated progress for an initiative
 * Called when linked projects/tasks change
 */
export const recalculateInitiativeProgress = mutation({
  args: {
    initiativeId: v.id("lifeos_yearlyInitiatives"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const initiative = await ctx.db.get(args.initiativeId);
    if (!initiative || initiative.userId !== user._id) {
      throw new Error("Initiative not found or access denied");
    }

    // Get all linked projects
    const projects = await ctx.db
      .query("lifeos_pmProjects")
      .withIndex("by_initiative", (q) =>
        q.eq("initiativeId", args.initiativeId),
      )
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();

    // Calculate totals
    let totalTasks = 0;
    let completedTasks = 0;
    for (const project of projects) {
      totalTasks += project.issueCount;
      completedTasks += project.completedIssueCount;
    }

    const autoProgress =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    await ctx.db.patch(args.initiativeId, {
      autoProgress,
      updatedAt: Date.now(),
    });

    return autoProgress;
  },
});
