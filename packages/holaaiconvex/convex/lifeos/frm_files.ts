import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";

// ==================== QUERIES ====================

/**
 * Get all files for a person
 */
export const getFilesForPerson = query({
  args: {
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify person belongs to user
    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      return [];
    }

    // Get files ordered by creation date
    const files = await ctx.db
      .query("lifeos_frmFiles")
      .withIndex("by_person_created", (q) => q.eq("personId", args.personId))
      .order("desc")
      .collect();

    // Get URLs for each file
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        const url = await ctx.storage.getUrl(file.storageId);
        return {
          ...file,
          url,
        };
      })
    );

    return filesWithUrls;
  },
});

// ==================== MUTATIONS ====================

/**
 * Generate upload URL for file storage
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create a file record after upload
 */
export const createFile = mutation({
  args: {
    personId: v.id("lifeos_frmPeople"),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify person belongs to user
    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      throw new Error("Person not found or access denied");
    }

    // Create file record
    const fileId = await ctx.db.insert("lifeos_frmFiles", {
      userId: user._id,
      personId: args.personId,
      name: args.name,
      mimeType: args.mimeType,
      size: args.size,
      storageId: args.storageId,
      createdAt: Date.now(),
    });

    return fileId;
  },
});

/**
 * Delete a file
 */
export const deleteFile = mutation({
  args: {
    fileId: v.id("lifeos_frmFiles"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Get file
    const file = await ctx.db.get(args.fileId);
    if (!file || file.userId !== user._id) {
      throw new Error("File not found or access denied");
    }

    // Delete from storage
    await ctx.storage.delete(file.storageId);

    // Delete record
    await ctx.db.delete(args.fileId);

    return args.fileId;
  },
});
