import { v } from "convex/values";
import { query, mutation } from "../_generated/server";

/**
 * Learner Profile Functions
 * Manages user profiles for personalized AI conversations
 */

// ==================== QUERIES ====================

/**
 * Get the learner profile for a user
 */
export const getLearnerProfile = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hola_learnerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

/**
 * Check if the learner profile is complete (for onboarding gate)
 */
export const isProfileComplete = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("hola_learnerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return profile?.isComplete ?? false;
  },
});

// ==================== MUTATIONS ====================

/**
 * Create or update the learner profile
 */
export const upsertLearnerProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    origin: v.string(),
    profession: v.string(),
    interests: v.array(v.string()),
    learningGoal: v.string(),
    additionalContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("hola_learnerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        origin: args.origin,
        profession: args.profession,
        interests: args.interests,
        learningGoal: args.learningGoal,
        additionalContext: args.additionalContext,
        isComplete: true,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("hola_learnerProfiles", {
        userId: args.userId,
        name: args.name,
        origin: args.origin,
        profession: args.profession,
        interests: args.interests,
        learningGoal: args.learningGoal,
        additionalContext: args.additionalContext,
        isComplete: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Update a single field in the learner profile
 */
export const updateProfileField = mutation({
  args: {
    userId: v.id("users"),
    field: v.union(
      v.literal("name"),
      v.literal("origin"),
      v.literal("profession"),
      v.literal("interests"),
      v.literal("learningGoal"),
      v.literal("additionalContext")
    ),
    value: v.union(v.string(), v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("hola_learnerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile) {
      throw new Error("Profile not found");
    }

    await ctx.db.patch(profile._id, {
      [args.field]: args.value,
      updatedAt: Date.now(),
    });

    return profile._id;
  },
});

/**
 * Internal helper to get profile context string for AI prompts
 * Returns null if profile doesn't exist
 */
export const getProfileContextInternal = async (
  ctx: { db: any },
  userId: string
) => {
  const profile = await ctx.db
    .query("hola_learnerProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (!profile || !profile.isComplete) {
    return null;
  }

  return {
    name: profile.name,
    origin: profile.origin,
    profession: profile.profession,
    interests: profile.interests,
    learningGoal: profile.learningGoal,
    additionalContext: profile.additionalContext,
  };
};
