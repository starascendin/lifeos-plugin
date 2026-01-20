import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

/**
 * OTA (Over-The-Air) Update Functions
 *
 * Manages app updates for Capacitor iOS/Android apps.
 * Each Convex deployment (dev/staging/prod) has its own updates.
 */

// ==================== QUERIES ====================

/**
 * Get the latest active update
 * Called by the app to check if an update is available
 */
export const getLatestUpdate = query({
  args: {},
  handler: async (ctx) => {
    const update = await ctx.db
      .query("lifeos_otaUpdates")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .first();

    if (!update) return null;

    return {
      version: update.version,
      bundleUrl: update.bundleUrl,
      releaseNotes: update.releaseNotes,
      fileSize: update.fileSize,
      createdAt: update.createdAt,
    };
  },
});

/**
 * List all updates (for admin/debugging)
 */
export const listUpdates = query({
  args: {},
  handler: async (ctx) => {
    const updates = await ctx.db
      .query("lifeos_otaUpdates")
      .order("desc")
      .take(20);

    return updates;
  },
});

// ==================== MUTATIONS ====================

/**
 * Generate an upload URL for the update bundle
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create a new update record after uploading the bundle
 */
export const createUpdate = mutation({
  args: {
    version: v.string(),
    bundleStorageId: v.id("_storage"),
    releaseNotes: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    uploadedBy: v.optional(v.string()),
    setActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get the URL for the uploaded bundle
    const bundleUrl = await ctx.storage.getUrl(args.bundleStorageId);
    if (!bundleUrl) {
      throw new Error("Failed to get bundle URL from storage");
    }

    // Check if this version already exists
    const existing = await ctx.db
      .query("lifeos_otaUpdates")
      .withIndex("by_version", (q) => q.eq("version", args.version))
      .first();

    if (existing) {
      throw new Error(`Update version ${args.version} already exists`);
    }

    // If setActive is true, deactivate all other updates first
    if (args.setActive) {
      const activeUpdates = await ctx.db
        .query("lifeos_otaUpdates")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();

      for (const update of activeUpdates) {
        await ctx.db.patch(update._id, { isActive: false });
      }
    }

    // Create the update record
    const updateId = await ctx.db.insert("lifeos_otaUpdates", {
      version: args.version,
      bundleStorageId: args.bundleStorageId,
      bundleUrl,
      isActive: args.setActive ?? false,
      releaseNotes: args.releaseNotes,
      fileSize: args.fileSize,
      uploadedBy: args.uploadedBy,
      createdAt: Date.now(),
    });

    return { updateId, bundleUrl };
  },
});

/**
 * Set an update as active (and deactivate others)
 */
export const setActiveUpdate = mutation({
  args: {
    version: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the update by version
    const update = await ctx.db
      .query("lifeos_otaUpdates")
      .withIndex("by_version", (q) => q.eq("version", args.version))
      .first();

    if (!update) {
      throw new Error(`Update version ${args.version} not found`);
    }

    // Deactivate all other updates
    const activeUpdates = await ctx.db
      .query("lifeos_otaUpdates")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    for (const activeUpdate of activeUpdates) {
      if (activeUpdate._id !== update._id) {
        await ctx.db.patch(activeUpdate._id, { isActive: false });
      }
    }

    // Activate this update
    await ctx.db.patch(update._id, { isActive: true });

    return { success: true };
  },
});

/**
 * Deactivate an update (no active update = no OTA)
 */
export const deactivateUpdate = mutation({
  args: {
    version: v.string(),
  },
  handler: async (ctx, args) => {
    const update = await ctx.db
      .query("lifeos_otaUpdates")
      .withIndex("by_version", (q) => q.eq("version", args.version))
      .first();

    if (!update) {
      throw new Error(`Update version ${args.version} not found`);
    }

    await ctx.db.patch(update._id, { isActive: false });

    return { success: true };
  },
});

/**
 * Delete an update and its bundle file
 */
export const deleteUpdate = mutation({
  args: {
    version: v.string(),
  },
  handler: async (ctx, args) => {
    const update = await ctx.db
      .query("lifeos_otaUpdates")
      .withIndex("by_version", (q) => q.eq("version", args.version))
      .first();

    if (!update) {
      throw new Error(`Update version ${args.version} not found`);
    }

    // Delete the storage file
    await ctx.storage.delete(update.bundleStorageId);

    // Delete the record
    await ctx.db.delete(update._id);

    return { success: true };
  },
});
