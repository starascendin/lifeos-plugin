import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc } from "../_generated/dataModel";
import { dailyFieldTypeValidator } from "./daily_fields_schema";

// ==================== QUERIES ====================

/**
 * Get all active field definitions for the user
 */
export const getFieldDefinitions = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    let definitions = await ctx.db
      .query("lifeos_dailyFieldDefinitions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", user._id).eq("isActive", true)
      )
      .collect();

    if (!args.includeArchived) {
      definitions = definitions.filter((d) => !d.archivedAt);
    }

    // Sort by sortOrder
    return definitions.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/**
 * Get fields with values for a date (combined query for DailyView)
 */
export const getFieldsWithValuesForDate = query({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Get active field definitions
    const definitions = await ctx.db
      .query("lifeos_dailyFieldDefinitions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", user._id).eq("isActive", true)
      )
      .collect();

    const activeDefinitions = definitions
      .filter((d) => !d.archivedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    // Get values for this date
    const values = await ctx.db
      .query("lifeos_dailyFieldValues")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date)
      )
      .collect();

    const valueMap = new Map(values.map((v) => [v.fieldDefinitionId, v]));

    // Combine definitions with their values
    return activeDefinitions.map((def) => ({
      definition: def,
      value: valueMap.get(def._id) ?? null,
    }));
  },
});

// ==================== MUTATIONS ====================

/**
 * Create default fields for a new user (call on first access)
 */
export const initializeDefaultFields = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Check if user already has any field definitions
    const existing = await ctx.db
      .query("lifeos_dailyFieldDefinitions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      // Already initialized
      return null;
    }

    // Create default "End Day Score" field
    const fieldId = await ctx.db.insert("lifeos_dailyFieldDefinitions", {
      userId: user._id,
      name: "End Day Score",
      fieldType: "number",
      description: "Rate your day from 1-10",
      minValue: 1,
      maxValue: 10,
      sortOrder: 0,
      isActive: true,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });

    return fieldId;
  },
});

/**
 * Create a new field definition
 */
export const createFieldDefinition = mutation({
  args: {
    name: v.string(),
    fieldType: dailyFieldTypeValidator,
    description: v.optional(v.string()),
    minValue: v.optional(v.number()),
    maxValue: v.optional(v.number()),
    placeholder: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Get max sortOrder
    const existing = await ctx.db
      .query("lifeos_dailyFieldDefinitions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const maxSortOrder = existing.reduce(
      (max, d) => Math.max(max, d.sortOrder),
      -1
    );

    const fieldId = await ctx.db.insert("lifeos_dailyFieldDefinitions", {
      userId: user._id,
      name: args.name,
      fieldType: args.fieldType,
      description: args.description,
      minValue: args.fieldType === "number" ? args.minValue : undefined,
      maxValue: args.fieldType === "number" ? args.maxValue : undefined,
      placeholder: args.fieldType === "text" ? args.placeholder : undefined,
      sortOrder: maxSortOrder + 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return fieldId;
  },
});

/**
 * Update a field definition
 */
export const updateFieldDefinition = mutation({
  args: {
    fieldId: v.id("lifeos_dailyFieldDefinitions"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    minValue: v.optional(v.number()),
    maxValue: v.optional(v.number()),
    placeholder: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const field = await ctx.db.get(args.fieldId);
    if (!field || field.userId !== user._id) {
      throw new Error("Field not found or access denied");
    }

    const updates: Partial<Doc<"lifeos_dailyFieldDefinitions">> = {
      updatedAt: now,
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.minValue !== undefined) updates.minValue = args.minValue;
    if (args.maxValue !== undefined) updates.maxValue = args.maxValue;
    if (args.placeholder !== undefined) updates.placeholder = args.placeholder;

    await ctx.db.patch(args.fieldId, updates);
    return args.fieldId;
  },
});

/**
 * Archive (soft delete) a field definition
 */
export const archiveFieldDefinition = mutation({
  args: {
    fieldId: v.id("lifeos_dailyFieldDefinitions"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const field = await ctx.db.get(args.fieldId);
    if (!field || field.userId !== user._id) {
      throw new Error("Field not found or access denied");
    }

    await ctx.db.patch(args.fieldId, {
      archivedAt: now,
      isActive: false,
      updatedAt: now,
    });
  },
});

/**
 * Reorder field definitions
 */
export const reorderFieldDefinitions = mutation({
  args: {
    fieldIds: v.array(v.id("lifeos_dailyFieldDefinitions")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    for (let i = 0; i < args.fieldIds.length; i++) {
      const field = await ctx.db.get(args.fieldIds[i]);
      if (!field || field.userId !== user._id) {
        throw new Error("Field not found or access denied");
      }

      await ctx.db.patch(args.fieldIds[i], {
        sortOrder: i,
        updatedAt: now,
      });
    }
  },
});

/**
 * Set/update a field value for a specific date
 */
export const setFieldValue = mutation({
  args: {
    fieldDefinitionId: v.id("lifeos_dailyFieldDefinitions"),
    date: v.string(), // YYYY-MM-DD
    textValue: v.optional(v.string()),
    numberValue: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Verify field ownership
    const field = await ctx.db.get(args.fieldDefinitionId);
    if (!field || field.userId !== user._id) {
      throw new Error("Field not found or access denied");
    }

    // Validate value based on field type
    if (field.fieldType === "number" && args.numberValue !== undefined) {
      if (field.minValue !== undefined && args.numberValue < field.minValue) {
        throw new Error(`Value must be at least ${field.minValue}`);
      }
      if (field.maxValue !== undefined && args.numberValue > field.maxValue) {
        throw new Error(`Value must be at most ${field.maxValue}`);
      }
    }

    // Check if value exists for this field+date
    const existing = await ctx.db
      .query("lifeos_dailyFieldValues")
      .withIndex("by_user_field_date", (q) =>
        q
          .eq("userId", user._id)
          .eq("fieldDefinitionId", args.fieldDefinitionId)
          .eq("date", args.date)
      )
      .first();

    if (existing) {
      // Update existing value
      await ctx.db.patch(existing._id, {
        textValue: field.fieldType === "text" ? args.textValue : undefined,
        numberValue: field.fieldType === "number" ? args.numberValue : undefined,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new value
      return await ctx.db.insert("lifeos_dailyFieldValues", {
        userId: user._id,
        fieldDefinitionId: args.fieldDefinitionId,
        date: args.date,
        textValue: field.fieldType === "text" ? args.textValue : undefined,
        numberValue: field.fieldType === "number" ? args.numberValue : undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Clear a field value for a specific date
 */
export const clearFieldValue = mutation({
  args: {
    fieldDefinitionId: v.id("lifeos_dailyFieldDefinitions"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db
      .query("lifeos_dailyFieldValues")
      .withIndex("by_user_field_date", (q) =>
        q
          .eq("userId", user._id)
          .eq("fieldDefinitionId", args.fieldDefinitionId)
          .eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
