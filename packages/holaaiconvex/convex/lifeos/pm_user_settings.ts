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

    if (existingSettings) {
      // Update existing settings
      await ctx.db.patch(existingSettings._id, {
        cycleSettings: args.cycleSettings,
        updatedAt: now,
      });
      return existingSettings._id;
    } else {
      // Create new settings
      const settingsId = await ctx.db.insert("lifeos_pmUserSettings", {
        userId: user._id,
        cycleSettings: args.cycleSettings,
        createdAt: now,
        updatedAt: now,
      });
      return settingsId;
    }
  },
});
