import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc } from "../_generated/dataModel";

// ==================== QUERIES ====================

/**
 * Get all categories for the authenticated user
 */
export const getCategories = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    let categories = await ctx.db
      .query("lifeos_habitCategories")
      .withIndex("by_user_order", (q) => q.eq("userId", user._id))
      .collect();

    if (!args.includeArchived) {
      categories = categories.filter((c) => !c.archivedAt);
    }

    return categories;
  },
});

/**
 * Get a single category by ID
 */
export const getCategory = query({
  args: {
    categoryId: v.id("lifeos_habitCategories"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== user._id) {
      return null;
    }

    return category;
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new category
 */
export const createCategory = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Get the highest sortOrder
    const existingCategories = await ctx.db
      .query("lifeos_habitCategories")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const maxSortOrder = existingCategories.reduce(
      (max, c) => Math.max(max, c.sortOrder),
      -1
    );

    const categoryId = await ctx.db.insert("lifeos_habitCategories", {
      userId: user._id,
      name: args.name,
      icon: args.icon ?? "📋",
      color: args.color ?? "#6366f1",
      sortOrder: maxSortOrder + 1,
      isCollapsed: false,
      createdAt: now,
      updatedAt: now,
    });

    return categoryId;
  },
});

/**
 * Update a category
 */
export const updateCategory = mutation({
  args: {
    categoryId: v.id("lifeos_habitCategories"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== user._id) {
      throw new Error("Category not found or access denied");
    }

    const updates: Partial<Doc<"lifeos_habitCategories">> = {
      updatedAt: now,
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.icon !== undefined) updates.icon = args.icon;
    if (args.color !== undefined) updates.color = args.color;

    await ctx.db.patch(args.categoryId, updates);
    return args.categoryId;
  },
});

/**
 * Toggle category collapsed state
 */
export const toggleCategoryCollapsed = mutation({
  args: {
    categoryId: v.id("lifeos_habitCategories"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== user._id) {
      throw new Error("Category not found or access denied");
    }

    await ctx.db.patch(args.categoryId, {
      isCollapsed: !category.isCollapsed,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Reorder categories
 */
export const reorderCategories = mutation({
  args: {
    categoryIds: v.array(v.id("lifeos_habitCategories")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    for (let i = 0; i < args.categoryIds.length; i++) {
      const category = await ctx.db.get(args.categoryIds[i]);
      if (!category || category.userId !== user._id) {
        throw new Error("Category not found or access denied");
      }

      await ctx.db.patch(args.categoryIds[i], {
        sortOrder: i,
        updatedAt: now,
      });
    }
  },
});

/**
 * Archive a category (soft delete)
 * Moves all habits in this category to uncategorized
 */
export const archiveCategory = mutation({
  args: {
    categoryId: v.id("lifeos_habitCategories"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== user._id) {
      throw new Error("Category not found or access denied");
    }

    // Move all habits to uncategorized
    const habits = await ctx.db
      .query("lifeos_habits")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();

    for (const habit of habits) {
      await ctx.db.patch(habit._id, {
        categoryId: undefined,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.categoryId, {
      archivedAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Delete a category permanently
 * Only allowed if no habits are in this category
 */
export const deleteCategory = mutation({
  args: {
    categoryId: v.id("lifeos_habitCategories"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== user._id) {
      throw new Error("Category not found or access denied");
    }

    // Check if any habits are in this category
    const habitsInCategory = await ctx.db
      .query("lifeos_habits")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .first();

    if (habitsInCategory) {
      throw new Error(
        "Cannot delete category with habits. Archive it instead or move habits first."
      );
    }

    await ctx.db.delete(args.categoryId);
  },
});
