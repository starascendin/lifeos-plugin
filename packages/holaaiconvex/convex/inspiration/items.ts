import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";

/**
 * Save a new inspiration item
 */
export const saveInspiration = mutation({
  args: {
    url: v.string(),
    title: v.string(),
    notes: v.optional(v.string()),
    favicon: v.optional(v.string()),
    ogImage: v.optional(v.string()),
    tagIds: v.optional(v.array(v.id("ext_insp_tags"))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Extract domain from URL
    let domain = "";
    try {
      const urlObj = new URL(args.url);
      domain = urlObj.hostname.replace(/^www\./, "");
    } catch {
      domain = "unknown";
    }

    const now = Date.now();

    // Create the inspiration item
    const itemId = await ctx.db.insert("ext_insp_items", {
      userId: user._id,
      url: args.url,
      title: args.title,
      notes: args.notes,
      favicon: args.favicon,
      ogImage: args.ogImage,
      domain,
      createdAt: now,
      updatedAt: now,
    });

    // Add tags if provided
    if (args.tagIds && args.tagIds.length > 0) {
      for (const tagId of args.tagIds) {
        // Verify tag belongs to user
        const tag = await ctx.db.get(tagId);
        if (tag && tag.userId === user._id) {
          await ctx.db.insert("ext_insp_item_tags", {
            itemId,
            tagId,
          });
        }
      }
    }

    return itemId;
  },
});

/**
 * Update an existing inspiration item
 */
export const updateInspiration = mutation({
  args: {
    itemId: v.id("ext_insp_items"),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
    tagIds: v.optional(v.array(v.id("ext_insp_tags"))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Inspiration not found");
    }
    if (item.userId !== user._id) {
      throw new Error("Not authorized to update this inspiration");
    }

    // Update the item fields
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };
    if (args.title !== undefined) updates.title = args.title;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(args.itemId, updates);

    // Update tags if provided
    if (args.tagIds !== undefined) {
      // Remove existing tags
      const existingTags = await ctx.db
        .query("ext_insp_item_tags")
        .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
        .collect();

      for (const tag of existingTags) {
        await ctx.db.delete(tag._id);
      }

      // Add new tags
      for (const tagId of args.tagIds) {
        const tag = await ctx.db.get(tagId);
        if (tag && tag.userId === user._id) {
          await ctx.db.insert("ext_insp_item_tags", {
            itemId: args.itemId,
            tagId,
          });
        }
      }
    }

    return args.itemId;
  },
});

/**
 * Delete an inspiration item
 */
export const deleteInspiration = mutation({
  args: {
    itemId: v.id("ext_insp_items"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Inspiration not found");
    }
    if (item.userId !== user._id) {
      throw new Error("Not authorized to delete this inspiration");
    }

    // Remove tag associations
    const tags = await ctx.db
      .query("ext_insp_item_tags")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();

    for (const tag of tags) {
      await ctx.db.delete(tag._id);
    }

    // Delete the item
    await ctx.db.delete(args.itemId);
  },
});

/**
 * List inspirations for the current user
 */
export const listInspirations = query({
  args: {
    tagId: v.optional(v.id("ext_insp_tags")),
    domain: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 50;

    let items;

    if (args.domain) {
      // Filter by domain
      items = await ctx.db
        .query("ext_insp_items")
        .withIndex("by_user_domain", (q) =>
          q.eq("userId", user._id).eq("domain", args.domain!)
        )
        .order("desc")
        .take(limit);
    } else {
      // Default: get by creation date
      items = await ctx.db
        .query("ext_insp_items")
        .withIndex("by_user_created", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(limit);
    }

    // If filtering by tag, filter the results
    if (args.tagId) {
      const taggedItemIds = new Set(
        (
          await ctx.db
            .query("ext_insp_item_tags")
            .withIndex("by_tag", (q) => q.eq("tagId", args.tagId!))
            .collect()
        ).map((t) => t.itemId)
      );

      items = items.filter((item) => taggedItemIds.has(item._id));
    }

    // Fetch tags for each item
    const itemsWithTags = await Promise.all(
      items.map(async (item) => {
        const itemTags = await ctx.db
          .query("ext_insp_item_tags")
          .withIndex("by_item", (q) => q.eq("itemId", item._id))
          .collect();

        const tags = await Promise.all(
          itemTags.map(async (it) => {
            const tag = await ctx.db.get(it.tagId);
            return tag;
          })
        );

        return {
          ...item,
          tags: tags.filter(Boolean),
        };
      })
    );

    return itemsWithTags;
  },
});

/**
 * Get a single inspiration by ID
 */
export const getInspiration = query({
  args: {
    itemId: v.id("ext_insp_items"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const item = await ctx.db.get(args.itemId);
    if (!item) {
      return null;
    }
    if (item.userId !== user._id) {
      return null;
    }

    // Fetch tags
    const itemTags = await ctx.db
      .query("ext_insp_item_tags")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();

    const tags = await Promise.all(
      itemTags.map(async (it) => {
        const tag = await ctx.db.get(it.tagId);
        return tag;
      })
    );

    return {
      ...item,
      tags: tags.filter(Boolean),
    };
  },
});

/**
 * Check if a URL is already saved
 */
export const checkUrlExists = query({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const items = await ctx.db
      .query("ext_insp_items")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const existing = items.find((item) => item.url === args.url);
    return existing ? { exists: true, itemId: existing._id } : { exists: false };
  },
});
