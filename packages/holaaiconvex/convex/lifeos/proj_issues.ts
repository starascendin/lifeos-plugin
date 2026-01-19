import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc } from "../_generated/dataModel";
import { issueStatusValidator, issuePriorityValidator } from "./projects_schema";

// ==================== QUERIES ====================

/**
 * Get all issues for a project
 */
export const getIssues = query({
  args: {
    projectId: v.id("lifeos_projProjects"),
    phaseId: v.optional(v.id("lifeos_projPhases")),
    status: v.optional(issueStatusValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify project belongs to user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return [];
    }

    // If phaseId is provided, filter by phase
    if (args.phaseId) {
      let issues = await ctx.db
        .query("lifeos_projIssues")
        .withIndex("by_phase", (q) => q.eq("phaseId", args.phaseId))
        .order("desc")
        .collect();

      if (args.status) {
        issues = issues.filter((i) => i.status === args.status);
      }

      return issues;
    }

    // Get all issues for the project
    if (args.status) {
      return await ctx.db
        .query("lifeos_projIssues")
        .withIndex("by_project_status", (q) =>
          q.eq("projectId", args.projectId).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("lifeos_projIssues")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

/**
 * Get a single issue by ID
 */
export const getIssue = query({
  args: {
    issueId: v.id("lifeos_projIssues"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.userId !== user._id) {
      return null;
    }

    // Get project
    const project = await ctx.db.get(issue.projectId);

    // Get phase if linked
    let phase = null;
    if (issue.phaseId) {
      phase = await ctx.db.get(issue.phaseId);
    }

    return {
      ...issue,
      project,
      phase,
    };
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new issue
 */
export const createIssue = mutation({
  args: {
    projectId: v.id("lifeos_projProjects"),
    phaseId: v.optional(v.id("lifeos_projPhases")),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(issueStatusValidator),
    priority: v.optional(issuePriorityValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Verify project belongs to user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found or access denied");
    }

    // Verify phase belongs to project if provided
    if (args.phaseId) {
      const phase = await ctx.db.get(args.phaseId);
      if (!phase || phase.userId !== user._id) {
        throw new Error("Phase not found or access denied");
      }
      if (phase.projectId !== args.projectId) {
        throw new Error("Phase does not belong to this project");
      }
    }

    const issueId = await ctx.db.insert("lifeos_projIssues", {
      userId: user._id,
      projectId: args.projectId,
      phaseId: args.phaseId,
      title: args.title,
      description: args.description,
      status: args.status ?? "open",
      priority: args.priority ?? "medium",
      createdAt: now,
      updatedAt: now,
    });

    return issueId;
  },
});

/**
 * Update an issue
 */
export const updateIssue = mutation({
  args: {
    issueId: v.id("lifeos_projIssues"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    status: v.optional(issueStatusValidator),
    priority: v.optional(issuePriorityValidator),
    phaseId: v.optional(v.union(v.id("lifeos_projPhases"), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.userId !== user._id) {
      throw new Error("Issue not found or access denied");
    }

    // Verify phase belongs to same project if changing
    if (args.phaseId && args.phaseId !== null) {
      const phase = await ctx.db.get(args.phaseId);
      if (!phase || phase.userId !== user._id) {
        throw new Error("Phase not found or access denied");
      }
      if (phase.projectId !== issue.projectId) {
        throw new Error("Phase does not belong to this project");
      }
    }

    const updates: Partial<Doc<"lifeos_projIssues">> = {
      updatedAt: now,
    };

    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) {
      updates.description =
        args.description === null ? undefined : args.description;
    }
    if (args.status !== undefined) updates.status = args.status;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.phaseId !== undefined) {
      updates.phaseId = args.phaseId === null ? undefined : args.phaseId;
    }

    await ctx.db.patch(args.issueId, updates);
    return args.issueId;
  },
});

/**
 * Delete an issue
 */
export const deleteIssue = mutation({
  args: {
    issueId: v.id("lifeos_projIssues"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.userId !== user._id) {
      throw new Error("Issue not found or access denied");
    }

    await ctx.db.delete(args.issueId);
  },
});

/**
 * Bulk update issue status
 */
export const bulkUpdateStatus = mutation({
  args: {
    issueIds: v.array(v.id("lifeos_projIssues")),
    status: issueStatusValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    for (const issueId of args.issueIds) {
      const issue = await ctx.db.get(issueId);
      if (!issue || issue.userId !== user._id) {
        continue; // Skip issues that don't exist or user doesn't own
      }

      await ctx.db.patch(issueId, {
        status: args.status,
        updatedAt: now,
      });
    }
  },
});
