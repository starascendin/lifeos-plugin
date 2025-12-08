import { mutation, query } from "./_generated/server";
import { getOrCreateUser, requireAuth, getAuthUserId } from "./auth";

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
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    return user;
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
