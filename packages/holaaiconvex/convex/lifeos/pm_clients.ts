import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc } from "../_generated/dataModel";
import { clientStatusValidator } from "./pm_schema";

// ==================== QUERIES ====================

/**
 * Get all clients for the authenticated user
 */
export const getClients = query({
  args: {
    status: v.optional(clientStatusValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (args.status) {
      return await ctx.db
        .query("lifeos_pmClients")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("lifeos_pmClients")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

/**
 * Get a single client by ID
 */
export const getClient = query({
  args: {
    clientId: v.id("lifeos_pmClients"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const client = await ctx.db.get(args.clientId);
    if (!client || client.userId !== user._id) {
      return null;
    }

    return client;
  },
});

/**
 * Get client with project count
 */
export const getClientWithStats = query({
  args: {
    clientId: v.id("lifeos_pmClients"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const client = await ctx.db.get(args.clientId);
    if (!client || client.userId !== user._id) {
      return null;
    }

    const projects = await ctx.db
      .query("lifeos_pmProjects")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    return {
      ...client,
      projectCount: projects.length,
      activeProjectCount: projects.filter((p) => p.status === "in_progress")
        .length,
    };
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new client
 */
export const createClient = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const clientId = await ctx.db.insert("lifeos_pmClients", {
      userId: user._id,
      name: args.name,
      description: args.description,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    return clientId;
  },
});

/**
 * Update a client
 */
export const updateClient = mutation({
  args: {
    clientId: v.id("lifeos_pmClients"),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    status: v.optional(clientStatusValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const client = await ctx.db.get(args.clientId);
    if (!client || client.userId !== user._id) {
      throw new Error("Client not found or access denied");
    }

    const updates: Partial<Doc<"lifeos_pmClients">> = {
      updatedAt: now,
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) {
      updates.description =
        args.description === null ? undefined : args.description;
    }
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.clientId, updates);
    return args.clientId;
  },
});

/**
 * Delete a client (and unlink all associated projects)
 */
export const deleteClient = mutation({
  args: {
    clientId: v.id("lifeos_pmClients"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const client = await ctx.db.get(args.clientId);
    if (!client || client.userId !== user._id) {
      throw new Error("Client not found or access denied");
    }

    // Unlink projects from client (don't delete them)
    const projects = await ctx.db
      .query("lifeos_pmProjects")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    for (const project of projects) {
      await ctx.db.patch(project._id, {
        clientId: undefined,
        updatedAt: Date.now(),
      });
    }

    // Delete client-level notes
    const clientNotes = await ctx.db
      .query("lifeos_pmNotes")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    for (const note of clientNotes) {
      await ctx.db.delete(note._id);
    }

    // Delete the client
    await ctx.db.delete(args.clientId);
  },
});
