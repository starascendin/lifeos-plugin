import { mutation, query, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { getOrCreateUser, getAuthUserId } from "../_lib/auth";

/**
 * Ensure user exists in the database
 * Called on first login to sync Clerk user to Convex
 */
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getOrCreateUser(ctx);
    return userId;
  },
});

/**
 * Get the current authenticated user
 * Returns user with role defaulting to "user" if not set
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    // Ensure role is always defined (default to "user" for backward compatibility)
    return {
      ...user,
      role: user.role ?? "user",
    };
  },
});

/**
 * Get user by ID
 */
export const getUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    return user;
  },
});

// ==================== INTERNAL QUERIES ====================

/**
 * Internal: Get user by token identifier
 * Used by HTTP actions to look up user from auth identity
 */
export const getUserByTokenIdentifier = internalQuery({
  args: {
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", args.tokenIdentifier)
      )
      .unique();
  },
});

/**
 * Internal: Get user by email
 * Used for admin/debug purposes to look up user IDs
 */
export const getUserByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

/**
 * Internal: List all users (for debug)
 */
export const listAllUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(10);
    return users.map((u) => ({ _id: u._id, email: u.email, name: u.name }));
  },
});
