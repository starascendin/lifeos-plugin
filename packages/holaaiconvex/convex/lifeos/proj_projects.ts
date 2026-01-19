import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc } from "../_generated/dataModel";
import { projectStatusValidator } from "./projects_schema";

// ==================== QUERIES ====================

/**
 * Get all projects for the authenticated user
 */
export const getProjects = query({
  args: {
    clientId: v.optional(v.id("lifeos_projClients")),
    status: v.optional(projectStatusValidator),
    includePersonal: v.optional(v.boolean()), // Include projects with no client
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // If clientId is provided, filter by client
    if (args.clientId) {
      // Verify client belongs to user
      const client = await ctx.db.get(args.clientId);
      if (!client || client.userId !== user._id) {
        return [];
      }

      let projects = await ctx.db
        .query("lifeos_projProjects")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
        .order("desc")
        .collect();

      if (args.status) {
        projects = projects.filter((p) => p.status === args.status);
      }

      return projects;
    }

    // Get all user projects
    let projects = await ctx.db
      .query("lifeos_projProjects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    if (args.status) {
      projects = projects.filter((p) => p.status === args.status);
    }

    // Filter out personal projects if not requested
    if (!args.includePersonal) {
      projects = projects.filter((p) => p.clientId !== undefined);
    }

    return projects;
  },
});

/**
 * Get all projects grouped by client
 */
export const getProjectsGroupedByClient = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // Get all clients
    const clients = await ctx.db
      .query("lifeos_projClients")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Get all projects
    const projects = await ctx.db
      .query("lifeos_projProjects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Group projects by client
    const grouped: {
      client: Doc<"lifeos_projClients"> | null;
      projects: Doc<"lifeos_projProjects">[];
    }[] = [];

    // Add client groups
    for (const client of clients) {
      grouped.push({
        client,
        projects: projects.filter((p) => p.clientId === client._id),
      });
    }

    // Add personal projects (no client)
    const personalProjects = projects.filter((p) => !p.clientId);
    if (personalProjects.length > 0) {
      grouped.push({
        client: null,
        projects: personalProjects,
      });
    }

    return grouped;
  },
});

/**
 * Get a single project by ID with client info
 */
export const getProject = query({
  args: {
    projectId: v.id("lifeos_projProjects"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    // Get client if linked
    let client = null;
    if (project.clientId) {
      client = await ctx.db.get(project.clientId);
    }

    return {
      ...project,
      client,
    };
  },
});

/**
 * Get project with stats (phase count, issue count)
 */
export const getProjectWithStats = query({
  args: {
    projectId: v.id("lifeos_projProjects"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    // Get client
    let client = null;
    if (project.clientId) {
      client = await ctx.db.get(project.clientId);
    }

    // Count phases
    const phases = await ctx.db
      .query("lifeos_projPhases")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Count issues
    const issues = await ctx.db
      .query("lifeos_projIssues")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Count notes
    const notes = await ctx.db
      .query("lifeos_projNotes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return {
      ...project,
      client,
      phaseCount: phases.length,
      completedPhaseCount: phases.filter((p) => p.status === "completed").length,
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
 * Create a new project
 */
export const createProject = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    clientId: v.optional(v.id("lifeos_projClients")),
    status: v.optional(projectStatusValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Verify client belongs to user if provided
    if (args.clientId) {
      const client = await ctx.db.get(args.clientId);
      if (!client || client.userId !== user._id) {
        throw new Error("Client not found or access denied");
      }
    }

    const projectId = await ctx.db.insert("lifeos_projProjects", {
      userId: user._id,
      clientId: args.clientId,
      name: args.name,
      description: args.description,
      status: args.status ?? "active",
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
    projectId: v.id("lifeos_projProjects"),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    clientId: v.optional(v.union(v.id("lifeos_projClients"), v.null())),
    status: v.optional(projectStatusValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found or access denied");
    }

    // Verify client belongs to user if changing
    if (args.clientId && args.clientId !== null) {
      const client = await ctx.db.get(args.clientId);
      if (!client || client.userId !== user._id) {
        throw new Error("Client not found or access denied");
      }
    }

    const updates: Partial<Doc<"lifeos_projProjects">> = {
      updatedAt: now,
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) {
      updates.description =
        args.description === null ? undefined : args.description;
    }
    if (args.clientId !== undefined) {
      updates.clientId = args.clientId === null ? undefined : args.clientId;
    }
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.projectId, updates);
    return args.projectId;
  },
});

/**
 * Delete a project (and all associated phases, issues, notes)
 */
export const deleteProject = mutation({
  args: {
    projectId: v.id("lifeos_projProjects"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found or access denied");
    }

    // Delete phases
    const phases = await ctx.db
      .query("lifeos_projPhases")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const phase of phases) {
      await ctx.db.delete(phase._id);
    }

    // Delete issues
    const issues = await ctx.db
      .query("lifeos_projIssues")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const issue of issues) {
      await ctx.db.delete(issue._id);
    }

    // Delete notes
    const notes = await ctx.db
      .query("lifeos_projNotes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const note of notes) {
      await ctx.db.delete(note._id);
    }

    // Delete the project
    await ctx.db.delete(args.projectId);
  },
});
