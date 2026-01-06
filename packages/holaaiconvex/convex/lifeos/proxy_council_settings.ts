import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";

// Default values
// Note: password field is used to store the auth token
const DEFAULT_SETTINGS = {
  url: "https://council-proxy.tail05d28.ts.net/",
  username: "",
  password: "secret123", // This is the token for ?token=xxx
};

// ==================== QUERIES ====================

/**
 * Get proxy council settings for the authenticated user
 * Returns default values if no settings exist
 */
export const getProxyCouncilSettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const settings = await ctx.db
      .query("lifeos_proxyCouncilSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Return settings with defaults if not found
    if (!settings) {
      return {
        url: DEFAULT_SETTINGS.url,
        username: DEFAULT_SETTINGS.username,
        password: DEFAULT_SETTINGS.password,
        isDefault: true,
      };
    }

    return {
      url: settings.url,
      username: settings.username,
      password: settings.password,
      isDefault: false,
    };
  },
});

// ==================== MUTATIONS ====================

/**
 * Update or create proxy council settings
 */
export const updateProxyCouncilSettings = mutation({
  args: {
    url: v.string(),
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Check if settings exist
    const existingSettings = await ctx.db
      .query("lifeos_proxyCouncilSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existingSettings) {
      // Update existing settings
      await ctx.db.patch(existingSettings._id, {
        url: args.url,
        username: args.username,
        password: args.password,
        updatedAt: now,
      });
      return existingSettings._id;
    } else {
      // Create new settings
      const settingsId = await ctx.db.insert("lifeos_proxyCouncilSettings", {
        userId: user._id,
        url: args.url,
        username: args.username,
        password: args.password,
        createdAt: now,
        updatedAt: now,
      });
      return settingsId;
    }
  },
});

/**
 * Reset settings to defaults by deleting user settings
 */
export const resetProxyCouncilSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const existingSettings = await ctx.db
      .query("lifeos_proxyCouncilSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existingSettings) {
      await ctx.db.delete(existingSettings._id);
    }

    return { success: true };
  },
});
