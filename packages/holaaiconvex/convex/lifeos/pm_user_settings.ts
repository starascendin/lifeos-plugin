import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { cycleSettingsValidator } from "./pm_schema";

// ==================== QUERIES ====================

/**
 * Get user settings for the authenticated user
 */
export const getUserSettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const settings = await ctx.db
      .query("lifeos_pmUserSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    return settings;
  },
});

// ==================== MUTATIONS ====================

/**
 * Update or create user settings
 */
export const updateUserSettings = mutation({
  args: {
    timezone: v.optional(v.string()),
    cycleSettings: v.optional(cycleSettingsValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Check if settings exist
    const existingSettings = await ctx.db
      .query("lifeos_pmUserSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Build update object with only provided fields
    const updateData: {
      timezone?: string;
      cycleSettings?: typeof args.cycleSettings;
      updatedAt: number;
      createdAt?: number;
    } = { updatedAt: now };

    if (args.timezone !== undefined) {
      updateData.timezone = args.timezone;
    }
    if (args.cycleSettings !== undefined) {
      updateData.cycleSettings = args.cycleSettings;
    }

    if (existingSettings) {
      // Update existing settings
      await ctx.db.patch(existingSettings._id, updateData);
      return existingSettings._id;
    } else {
      // Create new settings
      const settingsId = await ctx.db.insert("lifeos_pmUserSettings", {
        userId: user._id,
        timezone: args.timezone,
        cycleSettings: args.cycleSettings,
        createdAt: now,
        updatedAt: now,
      });
      return settingsId;
    }
  },
});
