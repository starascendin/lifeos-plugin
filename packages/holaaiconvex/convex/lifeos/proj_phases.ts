import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc } from "../_generated/dataModel";
import { phaseStatusValidator } from "./projects_schema";

// ==================== QUERIES ====================

/**
 * Get all phases for a project
 */
export const getPhases = query({
  args: {
    projectId: v.id("lifeos_projProjects"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify project belongs to user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return [];
    }

    return await ctx.db
      .query("lifeos_projPhases")
      .withIndex("by_project_order", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

/**
 * Get a single phase by ID
 */
export const getPhase = query({
  args: {
    phaseId: v.id("lifeos_projPhases"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const phase = await ctx.db.get(args.phaseId);
    if (!phase || phase.userId !== user._id) {
      return null;
    }

    // Get project
    const project = await ctx.db.get(phase.projectId);

    return {
      ...phase,
      project,
    };
  },
});

/**
 * Get phase with stats (issue count, note count)
 */
export const getPhaseWithStats = query({
  args: {
    phaseId: v.id("lifeos_projPhases"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const phase = await ctx.db.get(args.phaseId);
    if (!phase || phase.userId !== user._id) {
      return null;
    }

    // Count issues
    const issues = await ctx.db
      .query("lifeos_projIssues")
      .withIndex("by_phase", (q) => q.eq("phaseId", args.phaseId))
      .collect();

    // Count notes
    const notes = await ctx.db
      .query("lifeos_projNotes")
      .withIndex("by_phase", (q) => q.eq("phaseId", args.phaseId))
      .collect();

    return {
      ...phase,
      issueCount: issues.length,
      openIssueCount: issues.filter(
        (i) => i.status === "open" || i.status === "in_progress"
      ).length,
      noteCount: notes.length,
    };
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new phase
 */
export const createPhase = mutation({
  args: {
    projectId: v.id("lifeos_projProjects"),
    name: v.string(),
    description: v.optional(v.string()),
    status: v.optional(phaseStatusValidator),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Verify project belongs to user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found or access denied");
    }

    // Get max order for existing phases
    const existingPhases = await ctx.db
      .query("lifeos_projPhases")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const maxOrder =
      existingPhases.length > 0
        ? Math.max(...existingPhases.map((p) => p.order))
        : -1;

    const phaseId = await ctx.db.insert("lifeos_projPhases", {
      userId: user._id,
      projectId: args.projectId,
      name: args.name,
      description: args.description,
      order: maxOrder + 1,
      status: args.status ?? "not_started",
      startDate: args.startDate,
      endDate: args.endDate,
      createdAt: now,
      updatedAt: now,
    });

    return phaseId;
  },
});

/**
 * Update a phase
 */
export const updatePhase = mutation({
  args: {
    phaseId: v.id("lifeos_projPhases"),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    status: v.optional(phaseStatusValidator),
    startDate: v.optional(v.union(v.number(), v.null())),
    endDate: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const phase = await ctx.db.get(args.phaseId);
    if (!phase || phase.userId !== user._id) {
      throw new Error("Phase not found or access denied");
    }

    const updates: Partial<Doc<"lifeos_projPhases">> = {
      updatedAt: now,
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) {
      updates.description =
        args.description === null ? undefined : args.description;
    }
    if (args.status !== undefined) updates.status = args.status;
    if (args.startDate !== undefined) {
      updates.startDate = args.startDate === null ? undefined : args.startDate;
    }
    if (args.endDate !== undefined) {
      updates.endDate = args.endDate === null ? undefined : args.endDate;
    }

    await ctx.db.patch(args.phaseId, updates);
    return args.phaseId;
  },
});

/**
 * Reorder phases within a project
 */
export const reorderPhases = mutation({
  args: {
    projectId: v.id("lifeos_projProjects"),
    phaseIds: v.array(v.id("lifeos_projPhases")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Verify project belongs to user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found or access denied");
    }

    // Update order for each phase
    for (let i = 0; i < args.phaseIds.length; i++) {
      const phase = await ctx.db.get(args.phaseIds[i]);
      if (!phase || phase.userId !== user._id) {
        throw new Error("Phase not found or access denied");
      }
      if (phase.projectId !== args.projectId) {
        throw new Error("Phase does not belong to this project");
      }

      await ctx.db.patch(args.phaseIds[i], {
        order: i,
        updatedAt: now,
      });
    }
  },
});

/**
 * Delete a phase (and optionally reassign issues)
 */
export const deletePhase = mutation({
  args: {
    phaseId: v.id("lifeos_projPhases"),
    deleteIssues: v.optional(v.boolean()), // If false, unlink issues from phase
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const phase = await ctx.db.get(args.phaseId);
    if (!phase || phase.userId !== user._id) {
      throw new Error("Phase not found or access denied");
    }

    // Handle issues
    const issues = await ctx.db
      .query("lifeos_projIssues")
      .withIndex("by_phase", (q) => q.eq("phaseId", args.phaseId))
      .collect();

    if (args.deleteIssues) {
      for (const issue of issues) {
        await ctx.db.delete(issue._id);
      }
    } else {
      // Unlink issues from phase
      for (const issue of issues) {
        await ctx.db.patch(issue._id, {
          phaseId: undefined,
          updatedAt: Date.now(),
        });
      }
    }

    // Delete phase notes
    const notes = await ctx.db
      .query("lifeos_projNotes")
      .withIndex("by_phase", (q) => q.eq("phaseId", args.phaseId))
      .collect();
    for (const note of notes) {
      await ctx.db.delete(note._id);
    }

    // Delete the phase
    await ctx.db.delete(args.phaseId);
  },
});
