import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";

/**
 * Create a new tag
 */
export const createTag = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Check if tag with same name already exists
    const existingTag = await ctx.db
      .query("ext_insp_tags")
      .withIndex("by_user_name", (q) =>
        q.eq("userId", user._id).eq("name", args.name)
      )
      .unique();

    if (existingTag) {
      throw new Error("Tag with this name already exists");
    }

    const tagId = await ctx.db.insert("ext_insp_tags", {
      userId: user._id,
      name: args.name,
      color: args.color,
      createdAt: Date.now(),
    });

    return tagId;
  },
});

/**
 * Update an existing tag
 */
export const updateTag = mutation({
  args: {
    tagId: v.id("ext_insp_tags"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const tag = await ctx.db.get(args.tagId);
    if (!tag) {
      throw new Error("Tag not found");
    }
    if (tag.userId !== user._id) {
      throw new Error("Not authorized to update this tag");
    }

    // If name is changing, check for duplicates
    if (args.name && args.name !== tag.name) {
      const existingTag = await ctx.db
        .query("ext_insp_tags")
        .withIndex("by_user_name", (q) =>
          q.eq("userId", user._id).eq("name", args.name!)
        )
        .unique();

      if (existingTag) {
        throw new Error("Tag with this name already exists");
      }
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.color !== undefined) updates.color = args.color;

    await ctx.db.patch(args.tagId, updates);
    return args.tagId;
  },
});

/**
 * Delete a tag and remove all associations
 */
export const deleteTag = mutation({
  args: {
    tagId: v.id("ext_insp_tags"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const tag = await ctx.db.get(args.tagId);
    if (!tag) {
      throw new Error("Tag not found");
    }
    if (tag.userId !== user._id) {
      throw new Error("Not authorized to delete this tag");
    }

    // Remove all item-tag associations
    const associations = await ctx.db
      .query("ext_insp_item_tags")
      .withIndex("by_tag", (q) => q.eq("tagId", args.tagId))
      .collect();

    for (const assoc of associations) {
      await ctx.db.delete(assoc._id);
    }

    // Delete the tag
    await ctx.db.delete(args.tagId);
  },
});

/**
 * List all tags for the current user
 */
export const listTags = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const tags = await ctx.db
      .query("ext_insp_tags")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Get usage count for each tag
    const tagsWithCount = await Promise.all(
      tags.map(async (tag) => {
        const associations = await ctx.db
          .query("ext_insp_item_tags")
          .withIndex("by_tag", (q) => q.eq("tagId", tag._id))
          .collect();

        return {
          ...tag,
          usageCount: associations.length,
        };
      })
    );

    return tagsWithCount;
  },
});

/**
 * Get or create a tag by name
 * Useful for quick tagging without pre-creating
 */
export const getOrCreateTag = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Check if tag exists
    const existingTag = await ctx.db
      .query("ext_insp_tags")
      .withIndex("by_user_name", (q) =>
        q.eq("userId", user._id).eq("name", args.name)
      )
      .unique();

    if (existingTag) {
      return existingTag._id;
    }

    // Create new tag
    const tagId = await ctx.db.insert("ext_insp_tags", {
      userId: user._id,
      name: args.name,
      color: args.color,
      createdAt: Date.now(),
    });

    return tagId;
  },
});
