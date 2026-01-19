import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc } from "../_generated/dataModel";

// ==================== QUERIES ====================

/**
 * Get all notes for the authenticated user
 */
export const getNotes = query({
  args: {
    clientId: v.optional(v.id("lifeos_projClients")),
    projectId: v.optional(v.id("lifeos_projProjects")),
    phaseId: v.optional(v.id("lifeos_projPhases")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Filter by phase
    if (args.phaseId) {
      const phase = await ctx.db.get(args.phaseId);
      if (!phase || phase.userId !== user._id) {
        return [];
      }

      return await ctx.db
        .query("lifeos_projNotes")
        .withIndex("by_phase", (q) => q.eq("phaseId", args.phaseId))
        .order("desc")
        .collect();
    }

    // Filter by project
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId !== user._id) {
        return [];
      }

      return await ctx.db
        .query("lifeos_projNotes")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .order("desc")
        .collect();
    }

    // Filter by client
    if (args.clientId) {
      const client = await ctx.db.get(args.clientId);
      if (!client || client.userId !== user._id) {
        return [];
      }

      return await ctx.db
        .query("lifeos_projNotes")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
        .order("desc")
        .collect();
    }

    // Get all notes for user
    return await ctx.db
      .query("lifeos_projNotes")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

/**
 * Get a single note by ID with context
 */
export const getNote = query({
  args: {
    noteId: v.id("lifeos_projNotes"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== user._id) {
      return null;
    }

    // Get related entities
    let client = null;
    let project = null;
    let phase = null;

    if (note.clientId) {
      client = await ctx.db.get(note.clientId);
    }
    if (note.projectId) {
      project = await ctx.db.get(note.projectId);
    }
    if (note.phaseId) {
      phase = await ctx.db.get(note.phaseId);
    }

    return {
      ...note,
      client,
      project,
      phase,
    };
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new note
 */
export const createNote = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    clientId: v.optional(v.id("lifeos_projClients")),
    projectId: v.optional(v.id("lifeos_projProjects")),
    phaseId: v.optional(v.id("lifeos_projPhases")),
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

    // Verify project belongs to user if provided
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId !== user._id) {
        throw new Error("Project not found or access denied");
      }
    }

    // Verify phase belongs to user if provided
    if (args.phaseId) {
      const phase = await ctx.db.get(args.phaseId);
      if (!phase || phase.userId !== user._id) {
        throw new Error("Phase not found or access denied");
      }

      // If phase is provided but project is not, auto-link to phase's project
      if (!args.projectId) {
        args.projectId = phase.projectId;
      }
    }

    const noteId = await ctx.db.insert("lifeos_projNotes", {
      userId: user._id,
      clientId: args.clientId,
      projectId: args.projectId,
      phaseId: args.phaseId,
      title: args.title,
      content: args.content,
      createdAt: now,
      updatedAt: now,
    });

    return noteId;
  },
});

/**
 * Update a note
 */
export const updateNote = mutation({
  args: {
    noteId: v.id("lifeos_projNotes"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    clientId: v.optional(v.union(v.id("lifeos_projClients"), v.null())),
    projectId: v.optional(v.union(v.id("lifeos_projProjects"), v.null())),
    phaseId: v.optional(v.union(v.id("lifeos_projPhases"), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== user._id) {
      throw new Error("Note not found or access denied");
    }

    // Verify new links belong to user
    if (args.clientId && args.clientId !== null) {
      const client = await ctx.db.get(args.clientId);
      if (!client || client.userId !== user._id) {
        throw new Error("Client not found or access denied");
      }
    }
    if (args.projectId && args.projectId !== null) {
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId !== user._id) {
        throw new Error("Project not found or access denied");
      }
    }
    if (args.phaseId && args.phaseId !== null) {
      const phase = await ctx.db.get(args.phaseId);
      if (!phase || phase.userId !== user._id) {
        throw new Error("Phase not found or access denied");
      }
    }

    const updates: Partial<Doc<"lifeos_projNotes">> = {
      updatedAt: now,
    };

    if (args.title !== undefined) updates.title = args.title;
    if (args.content !== undefined) updates.content = args.content;
    if (args.clientId !== undefined) {
      updates.clientId = args.clientId === null ? undefined : args.clientId;
    }
    if (args.projectId !== undefined) {
      updates.projectId = args.projectId === null ? undefined : args.projectId;
    }
    if (args.phaseId !== undefined) {
      updates.phaseId = args.phaseId === null ? undefined : args.phaseId;
    }

    await ctx.db.patch(args.noteId, updates);
    return args.noteId;
  },
});

/**
 * Delete a note
 */
export const deleteNote = mutation({
  args: {
    noteId: v.id("lifeos_projNotes"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== user._id) {
      throw new Error("Note not found or access denied");
    }

    await ctx.db.delete(args.noteId);
  },
});
