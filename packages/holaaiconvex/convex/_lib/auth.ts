import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getDefaultRole } from "./roles";

/**
 * Get the current user's identity from Clerk JWT
 */
export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  return identity;
}

/**
 * Get the user ID from the authenticated identity
 */
export async function getAuthUserId(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"users"> | null> {
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

  return user?._id ?? null;
}

/**
 * Get or create user on first login
 * Syncs Clerk user data to Convex
 */
export async function getOrCreateUser(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  // Check if user already exists
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .unique();

  if (existingUser) {
    // Update user data on each login
    await ctx.db.patch(existingUser._id, {
      name: identity.name ?? existingUser.name,
      pictureUrl: identity.pictureUrl ?? existingUser.pictureUrl,
      emailVerificationTime:
        (identity.emailVerificationTime as number | undefined) ??
        existingUser.emailVerificationTime,
      updatedAt: Date.now(),
    });
    return existingUser._id;
  }

  // Create new user with appropriate role based on email
  const email = identity.email!;
  const role = getDefaultRole(email);

  const userId = await ctx.db.insert("users", {
    tokenIdentifier: identity.tokenIdentifier,
    email: email,
    name: identity.name,
    pictureUrl: identity.pictureUrl,
    emailVerificationTime: identity.emailVerificationTime as number | undefined,
    role: role,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return userId;
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
}

/**
 * Get the full user object for the authenticated user
 * Throws if not authenticated or user not found
 */
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await requireAuth(ctx);

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .unique();

  if (!user) {
    throw new Error("User not found in database");
  }

  return user;
}

/**
 * Internal query to get user ID by token identifier
 */
export async function getUserIdByTokenIdentifier(
  ctx: QueryCtx,
  tokenIdentifier: string
): Promise<Id<"users"> | null> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", tokenIdentifier)
    )
    .unique();

  return user?._id ?? null;
}
