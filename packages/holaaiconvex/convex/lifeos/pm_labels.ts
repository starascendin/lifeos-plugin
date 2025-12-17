import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc } from "../_generated/dataModel";

// ==================== QUERIES ====================

/**
 * Get all labels for the authenticated user
 * Can filter by project or get workspace-wide labels
 */
export const getLabels = query({
  args: {
    projectId: v.optional(v.id("lifeos_pmProjects")),
    includeWorkspaceLabels: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (args.projectId) {
      // Get project-specific labels
      const projectLabels = await ctx.db
        .query("lifeos_pmLabels")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();

      // Filter by user
      const filteredProjectLabels = projectLabels.filter(
        (l) => l.userId === user._id
      );

      if (args.includeWorkspaceLabels) {
        // Also get workspace-wide labels (no projectId)
        const workspaceLabels = await ctx.db
          .query("lifeos_pmLabels")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .filter((q) => q.eq(q.field("projectId"), undefined))
          .collect();

        return [...filteredProjectLabels, ...workspaceLabels];
      }

      return filteredProjectLabels;
    }

    // Get all labels for user
    return await ctx.db
      .query("lifeos_pmLabels")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

/**
 * Get a single label by ID
 */
export const getLabel = query({
  args: {
    labelId: v.id("lifeos_pmLabels"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const label = await ctx.db.get(args.labelId);
    if (!label || label.userId !== user._id) {
      return null;
    }

    return label;
  },
});

/**
 * Get label by name (for checking duplicates)
 */
export const getLabelByName = query({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("lifeos_pmLabels")
      .withIndex("by_name", (q) =>
        q.eq("userId", user._id).eq("name", args.name)
      )
      .first();
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new label
 */
export const createLabel = mutation({
  args: {
    name: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
    projectId: v.optional(v.id("lifeos_pmProjects")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Check if label with same name already exists
    const existing = await ctx.db
      .query("lifeos_pmLabels")
      .withIndex("by_name", (q) =>
        q.eq("userId", user._id).eq("name", args.name)
      )
      .first();

    if (existing) {
      throw new Error("A label with this name already exists");
    }

    // If projectId provided, verify user owns the project
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId !== user._id) {
        throw new Error("Project not found or access denied");
      }
    }

    const labelId = await ctx.db.insert("lifeos_pmLabels", {
      userId: user._id,
      projectId: args.projectId,
      name: args.name,
      color: args.color,
      description: args.description,
      createdAt: now,
      updatedAt: now,
    });

    return labelId;
  },
});

/**
 * Update a label
 */
export const updateLabel = mutation({
  args: {
    labelId: v.id("lifeos_pmLabels"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const label = await ctx.db.get(args.labelId);
    if (!label || label.userId !== user._id) {
      throw new Error("Label not found or access denied");
    }

    // If changing name, check for duplicates
    if (args.name && args.name !== label.name) {
      const newName = args.name;
      const existing = await ctx.db
        .query("lifeos_pmLabels")
        .withIndex("by_name", (q) =>
          q.eq("userId", user._id).eq("name", newName)
        )
        .first();

      if (existing) {
        throw new Error("A label with this name already exists");
      }
    }

    const updates: Partial<Doc<"lifeos_pmLabels">> = {
      updatedAt: now,
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.color !== undefined) updates.color = args.color;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.labelId, updates);
    return args.labelId;
  },
});

/**
 * Delete a label
 * Also removes the label from all issues that have it
 */
export const deleteLabel = mutation({
  args: {
    labelId: v.id("lifeos_pmLabels"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const label = await ctx.db.get(args.labelId);
    if (!label || label.userId !== user._id) {
      throw new Error("Label not found or access denied");
    }

    // Remove this label from all issues
    const issues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const issue of issues) {
      if (issue.labelIds.includes(args.labelId)) {
        await ctx.db.patch(issue._id, {
          labelIds: issue.labelIds.filter((id) => id !== args.labelId),
          updatedAt: Date.now(),
        });
      }
    }

    // Delete the label
    await ctx.db.delete(args.labelId);
  },
});

// ==================== DEFAULT LABELS ====================

/**
 * Create default labels for a new workspace/project
 */
export const createDefaultLabels = mutation({
  args: {
    projectId: v.optional(v.id("lifeos_pmProjects")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const defaultLabels = [
      { name: "Bug", color: "#ef4444", description: "Something isn't working" },
      {
        name: "Feature",
        color: "#22c55e",
        description: "New feature or request",
      },
      {
        name: "Improvement",
        color: "#3b82f6",
        description: "Enhancement to existing feature",
      },
      {
        name: "Documentation",
        color: "#8b5cf6",
        description: "Documentation updates",
      },
      {
        name: "Tech Debt",
        color: "#f59e0b",
        description: "Technical debt to address",
      },
    ];

    const labelIds = [];
    for (const label of defaultLabels) {
      // Check if label already exists
      const existing = await ctx.db
        .query("lifeos_pmLabels")
        .withIndex("by_name", (q) =>
          q.eq("userId", user._id).eq("name", label.name)
        )
        .first();

      if (!existing) {
        const id = await ctx.db.insert("lifeos_pmLabels", {
          userId: user._id,
          projectId: args.projectId,
          name: label.name,
          color: label.color,
          description: label.description,
          createdAt: now,
          updatedAt: now,
        });
        labelIds.push(id);
      }
    }

    return labelIds;
  },
});
