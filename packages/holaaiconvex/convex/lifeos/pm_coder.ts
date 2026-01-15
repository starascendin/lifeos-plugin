/**
 * Coder.com Integration for LIFEos - Queries & Mutations
 *
 * Enables per-user Coder API integration for delegating issues to AI agents.
 * Users connect their Coder account with an API token, then can delegate
 * issues to Coder Tasks directly from the web app.
 *
 * This file contains queries and mutations (non-Node.js runtime).
 * Actions that make external API calls are in pm_coder_actions.ts.
 */

import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import { requireUser } from "../_lib/auth";

const DEFAULT_CODER_URL = "https://coder-production-coder2.rocketjump.tech";

// ==================== QUERIES ====================

/**
 * Check if the current user has Coder connected
 */
export const isConnected = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const integration = await ctx.db
      .query("lifeos_coderIntegration")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    return !!integration;
  },
});

/**
 * Get the current user's Coder integration (without exposing full token)
 */
export const getIntegration = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const integration = await ctx.db
      .query("lifeos_coderIntegration")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (!integration) return null;

    return {
      coderUrl: integration.coderUrl,
      coderUsername: integration.coderUsername,
      connectedAt: integration.connectedAt,
      lastUsedAt: integration.lastUsedAt,
      hasToken: !!integration.coderApiToken,
    };
  },
});

// ==================== INTERNAL QUERIES ====================

/**
 * Internal: Get full integration including token (for actions)
 */
export const getIntegrationInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lifeos_coderIntegration")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

// ==================== MUTATIONS ====================

/**
 * Connect Coder account by saving API token
 */
export const connectCoder = mutation({
  args: {
    coderUrl: v.optional(v.string()),
    coderApiToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const coderUrl = args.coderUrl || DEFAULT_CODER_URL;
    const now = Date.now();

    // Check if already connected
    const existing = await ctx.db
      .query("lifeos_coderIntegration")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        coderUrl,
        coderApiToken: args.coderApiToken,
        connectedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("lifeos_coderIntegration", {
      userId: user._id,
      coderUrl,
      coderApiToken: args.coderApiToken,
      connectedAt: now,
    });
  },
});

/**
 * Disconnect Coder account
 */
export const disconnectCoder = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db
      .query("lifeos_coderIntegration")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// ==================== INTERNAL MUTATIONS ====================

/**
 * Internal: Update last used timestamp
 */
export const updateLastUsed = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query("lifeos_coderIntegration")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (integration) {
      await ctx.db.patch(integration._id, {
        lastUsedAt: Date.now(),
      });
    }
  },
});
