import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc } from "../_generated/dataModel";
import {
  priorityValidator,
  projectStatusValidator,
  projectHealthValidator,
} from "./pm_schema";

// ==================== HELPERS ====================

/**
 * Generate a project key from the name
 * Takes first letters of words, uppercase, max 4 chars
 */
function generateProjectKey(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 4).toUpperCase();
  }
  return words
    .map((w) => w[0])
    .join("")
    .substring(0, 4)
    .toUpperCase();
}

// ==================== QUERIES ====================

/**
 * Get all projects for the authenticated user
 */
export const getProjects = query({
  args: {
    includeArchived: v.optional(v.boolean()),
    status: v.optional(projectStatusValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 50;

    let projects;
    if (args.status) {
      projects = await ctx.db
        .query("lifeos_pmProjects")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    } else if (args.includeArchived) {
      projects = await ctx.db
        .query("lifeos_pmProjects")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(limit);
    } else {
      // Exclude archived (archivedAt is undefined)
      projects = await ctx.db
        .query("lifeos_pmProjects")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .filter((q) => q.eq(q.field("archivedAt"), undefined))
        .take(limit);
    }

    return projects;
  },
});

/**
 * Get a single project by ID
 */
export const getProject = query({
  args: {
    projectId: v.id("lifeos_pmProjects"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    return project;
  },
});

/**
 * Get project by key
 */
export const getProjectByKey = query({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("lifeos_pmProjects")
      .withIndex("by_key", (q) =>
        q.eq("userId", user._id).eq("key", args.key.toUpperCase())
      )
      .first();
  },
});

/**
 * Get project stats (with computed completion percentage)
 */
export const getProjectStats = query({
  args: {
    projectId: v.id("lifeos_pmProjects"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    const completionPercentage =
      project.issueCount > 0
        ? Math.round((project.completedIssueCount / project.issueCount) * 100)
        : 0;

    return {
      ...project,
      completionPercentage,
    };
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new project
 */
export const createProject = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    status: v.optional(projectStatusValidator),
    health: v.optional(projectHealthValidator),
    priority: v.optional(priorityValidator),
    startDate: v.optional(v.number()),
    targetDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Generate unique key
    let baseKey = generateProjectKey(args.name);
    let key = baseKey;
    let suffix = 1;

    // Check for existing key and add suffix if needed
    while (true) {
      const existing = await ctx.db
        .query("lifeos_pmProjects")
        .withIndex("by_key", (q) => q.eq("userId", user._id).eq("key", key))
        .first();
      if (!existing) break;
      key = `${baseKey}${suffix}`;
      suffix++;
    }

    const projectId = await ctx.db.insert("lifeos_pmProjects", {
      userId: user._id,
      key,
      name: args.name,
      description: args.description,
      icon: args.icon,
      color: args.color ?? "#6366f1", // Default indigo
      status: args.status ?? "planned",
      health: args.health ?? "on_track",
      priority: args.priority ?? "none",
      startDate: args.startDate,
      targetDate: args.targetDate,
      issueCount: 0,
      completedIssueCount: 0,
      nextIssueNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    return projectId;
  },
});

/**
 * Update a project
 */
export const updateProject = mutation({
  args: {
    projectId: v.id("lifeos_pmProjects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    status: v.optional(projectStatusValidator),
    health: v.optional(projectHealthValidator),
    priority: v.optional(priorityValidator),
    startDate: v.optional(v.union(v.number(), v.null())),
    targetDate: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found or access denied");
    }

    const updates: Partial<Doc<"lifeos_pmProjects">> = {
      updatedAt: now,
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.icon !== undefined) updates.icon = args.icon;
    if (args.color !== undefined) updates.color = args.color;
    if (args.status !== undefined) {
      updates.status = args.status;
      if (args.status === "completed") {
        updates.completedAt = now;
      }
    }
    if (args.health !== undefined) updates.health = args.health;
    if (args.priority !== undefined) updates.priority = args.priority;
    // Handle dates: null means clear, undefined means don't change
    if (args.startDate !== undefined) {
      updates.startDate = args.startDate === null ? undefined : args.startDate;
    }
    if (args.targetDate !== undefined) {
      updates.targetDate = args.targetDate === null ? undefined : args.targetDate;
    }

    await ctx.db.patch(args.projectId, updates);
    return args.projectId;
  },
});

/**
 * Archive a project (soft delete)
 */
export const archiveProject = mutation({
  args: {
    projectId: v.id("lifeos_pmProjects"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found or access denied");
    }

    await ctx.db.patch(args.projectId, {
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Unarchive a project
 */
export const unarchiveProject = mutation({
  args: {
    projectId: v.id("lifeos_pmProjects"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found or access denied");
    }

    await ctx.db.patch(args.projectId, {
      archivedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Permanently delete a project and all its issues
 */
export const deleteProject = mutation({
  args: {
    projectId: v.id("lifeos_pmProjects"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found or access denied");
    }

    // Delete all issues in the project
    const issues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const issue of issues) {
      await ctx.db.delete(issue._id);
    }

    // Delete all cycles in the project
    const cycles = await ctx.db
      .query("lifeos_pmCycles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const cycle of cycles) {
      await ctx.db.delete(cycle._id);
    }

    // Delete all project-specific labels
    const labels = await ctx.db
      .query("lifeos_pmLabels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const label of labels) {
      await ctx.db.delete(label._id);
    }

    // Delete the project
    await ctx.db.delete(args.projectId);
  },
});

/**
 * Update project issue counts (called internally when issues change)
 */
export const updateProjectCounts = mutation({
  args: {
    projectId: v.id("lifeos_pmProjects"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found or access denied");
    }

    // Count all issues in project
    const allIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const issueCount = allIssues.length;
    const completedIssueCount = allIssues.filter(
      (i) => i.status === "done"
    ).length;

    await ctx.db.patch(args.projectId, {
      issueCount,
      completedIssueCount,
      updatedAt: Date.now(),
    });
  },
});
