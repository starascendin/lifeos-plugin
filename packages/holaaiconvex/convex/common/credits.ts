import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "../_generated/server";
import { requireUser, requireAuth } from "../_lib/auth";
import {
  checkCreditsQuery,
  deductCreditsMutation,
  getOrCreateUserCredits,
  UNLIMITED_ACCESS_EMAILS,
  type MeteringFeature,
} from "../_lib/credits";
import { Id } from "../_generated/dataModel";

// ==================== USER QUERIES ====================

/**
 * Get the current user's credit balance and status
 */
export const getMyCredits = query({
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const credits = await ctx.db
      .query("lifeos_userCredits")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!credits) {
      return {
        balance: 0,
        totalGranted: 0,
        totalConsumed: 0,
        hasUnlimitedAccess: UNLIMITED_ACCESS_EMAILS.includes(
          user.email.toLowerCase()
        ),
        initialized: false,
      };
    }

    return {
      balance: credits.balance,
      totalGranted: credits.totalGranted,
      totalConsumed: credits.totalConsumed,
      hasUnlimitedAccess: credits.hasUnlimitedAccess,
      initialized: true,
    };
  },
});

/**
 * Get the current user's credit transaction history
 */
export const getMyTransactions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 50;

    const transactions = await ctx.db
      .query("lifeos_creditTransactions")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    return transactions;
  },
});

/**
 * Get the current user's pending credit request (if any)
 */
export const getMyPendingRequest = query({
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const request = await ctx.db
      .query("lifeos_creditRequests")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "pending")
      )
      .first();

    return request;
  },
});

/**
 * Get the current user's request history
 */
export const getMyRequests = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 20;

    const requests = await ctx.db
      .query("lifeos_creditRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    return requests;
  },
});

// ==================== USER MUTATIONS ====================

/**
 * Request credits (for users with 0 balance)
 */
export const requestCredits = mutation({
  args: {
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Check if user already has a pending request
    const pendingRequest = await ctx.db
      .query("lifeos_creditRequests")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "pending")
      )
      .first();

    if (pendingRequest) {
      throw new Error("You already have a pending credit request");
    }

    // Check if user has unlimited access
    const credits = await ctx.db
      .query("lifeos_userCredits")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (credits?.hasUnlimitedAccess) {
      throw new Error("You already have unlimited access");
    }

    const now = Date.now();

    // Create the request
    const requestId = await ctx.db.insert("lifeos_creditRequests", {
      userId: user._id,
      status: "pending",
      message: args.message,
      createdAt: now,
      updatedAt: now,
    });

    // Update last request time
    if (credits) {
      await ctx.db.patch(credits._id, {
        lastCreditRequestAt: now,
        updatedAt: now,
      });
    }

    return requestId;
  },
});

/**
 * Initialize credits for the current user (called on first login)
 */
export const initializeMyCredits = mutation({
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // Get or create credits record
    const credits = await getOrCreateUserCredits(ctx, user._id, user.email);

    return {
      balance: credits.balance,
      hasUnlimitedAccess: credits.hasUnlimitedAccess,
    };
  },
});

// ==================== ADMIN QUERIES ====================

/**
 * List all pending credit requests (developer only)
 */
export const listPendingRequests = query({
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // Check if user is developer
    if (!UNLIMITED_ACCESS_EMAILS.includes(user.email.toLowerCase())) {
      throw new Error("Unauthorized: only developers can view requests");
    }

    const requests = await ctx.db
      .query("lifeos_creditRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();

    // Fetch user info for each request
    const requestsWithUsers = await Promise.all(
      requests.map(async (request) => {
        const requestUser = await ctx.db.get(request.userId);
        return {
          ...request,
          userEmail: requestUser?.email,
          userName: requestUser?.name,
        };
      })
    );

    return requestsWithUsers;
  },
});

/**
 * List all users with their credit info (developer only)
 */
export const listUsersWithCredits = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 100;

    // Check if user is developer
    if (!UNLIMITED_ACCESS_EMAILS.includes(user.email.toLowerCase())) {
      throw new Error("Unauthorized: only developers can view user credits");
    }

    const users = await ctx.db.query("users").take(limit);

    const usersWithCredits = await Promise.all(
      users.map(async (u) => {
        const credits = await ctx.db
          .query("lifeos_userCredits")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .first();

        return {
          userId: u._id,
          email: u.email,
          name: u.name,
          balance: credits?.balance ?? 0,
          totalGranted: credits?.totalGranted ?? 0,
          totalConsumed: credits?.totalConsumed ?? 0,
          hasUnlimitedAccess: credits?.hasUnlimitedAccess ?? false,
        };
      })
    );

    return usersWithCredits;
  },
});

// ==================== ADMIN MUTATIONS ====================

/**
 * Grant credits to a user (developer only)
 */
export const grantCredits = mutation({
  args: {
    userEmail: v.string(),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireUser(ctx);

    // Check if user is developer
    if (!UNLIMITED_ACCESS_EMAILS.includes(admin.email.toLowerCase())) {
      throw new Error("Unauthorized: only developers can grant credits");
    }

    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    // Find target user
    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!targetUser) {
      throw new Error(`User not found: ${args.userEmail}`);
    }

    // Get or create credits record
    const credits = await getOrCreateUserCredits(
      ctx,
      targetUser._id,
      targetUser.email
    );

    const newBalance = credits.balance + args.amount;
    const now = Date.now();

    // Update credits
    await ctx.db.patch(credits._id, {
      balance: newBalance,
      totalGranted: credits.totalGranted + args.amount,
      updatedAt: now,
    });

    // Log transaction
    await ctx.db.insert("lifeos_creditTransactions", {
      userId: targetUser._id,
      type: "grant",
      amount: args.amount,
      balanceAfter: newBalance,
      description: args.reason,
      createdAt: now,
    });

    return { newBalance };
  },
});

/**
 * Process a credit request (developer only)
 */
export const processRequest = mutation({
  args: {
    requestId: v.id("lifeos_creditRequests"),
    approved: v.boolean(),
    creditsToGrant: v.optional(v.number()),
    response: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireUser(ctx);

    // Check if user is developer
    if (!UNLIMITED_ACCESS_EMAILS.includes(admin.email.toLowerCase())) {
      throw new Error("Unauthorized: only developers can process requests");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    if (request.status !== "pending") {
      throw new Error("Request has already been processed");
    }

    const now = Date.now();

    // Update request status
    await ctx.db.patch(args.requestId, {
      status: args.approved ? "approved" : "denied",
      adminResponse: args.response,
      creditsGranted: args.approved ? args.creditsToGrant : undefined,
      processedBy: admin.email,
      processedAt: now,
      updatedAt: now,
    });

    // If approved, grant credits
    if (args.approved && args.creditsToGrant && args.creditsToGrant > 0) {
      const requestUser = await ctx.db.get(request.userId);
      if (requestUser) {
        const credits = await getOrCreateUserCredits(
          ctx,
          request.userId,
          requestUser.email
        );

        const newBalance = credits.balance + args.creditsToGrant;

        await ctx.db.patch(credits._id, {
          balance: newBalance,
          totalGranted: credits.totalGranted + args.creditsToGrant,
          updatedAt: now,
        });

        // Log transaction
        await ctx.db.insert("lifeos_creditTransactions", {
          userId: request.userId,
          type: "grant",
          amount: args.creditsToGrant,
          balanceAfter: newBalance,
          description: "Credit request approved",
          createdAt: now,
        });
      }
    }

    return { success: true };
  },
});

/**
 * Set unlimited access for a user (developer only)
 */
export const setUnlimitedAccess = mutation({
  args: {
    userEmail: v.string(),
    hasUnlimitedAccess: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireUser(ctx);

    // Check if user is developer
    if (!UNLIMITED_ACCESS_EMAILS.includes(admin.email.toLowerCase())) {
      throw new Error("Unauthorized: only developers can set unlimited access");
    }

    // Find target user
    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!targetUser) {
      throw new Error(`User not found: ${args.userEmail}`);
    }

    // Get or create credits record
    const credits = await getOrCreateUserCredits(
      ctx,
      targetUser._id,
      targetUser.email
    );

    await ctx.db.patch(credits._id, {
      hasUnlimitedAccess: args.hasUnlimitedAccess,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ==================== INTERNAL QUERIES (for actions) ====================

/**
 * Check credits for action context (internal)
 */
export const checkCreditsForAction = internalQuery({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        allowed: false,
        hasUnlimitedAccess: false,
        currentBalance: 0,
        reason: "Not authenticated",
        userId: null as unknown as Id<"users">,
      };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      return {
        allowed: false,
        hasUnlimitedAccess: false,
        currentBalance: 0,
        reason: "User not found",
        userId: null as unknown as Id<"users">,
      };
    }

    const result = await checkCreditsQuery(ctx, user._id);
    return {
      ...result,
      userId: user._id,
    };
  },
});

/**
 * Check credits for a specific user ID (internal)
 */
export const checkCreditsInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await checkCreditsQuery(ctx, args.userId);
  },
});

// ==================== INTERNAL MUTATIONS (for actions) ====================

/**
 * Deduct credits (internal - called from actions)
 */
export const deductCreditsInternal = internalMutation({
  args: {
    userId: v.id("users"),
    feature: v.string(),
    tokenUsage: v.object({
      promptTokens: v.number(),
      completionTokens: v.number(),
      totalTokens: v.number(),
    }),
    model: v.string(),
    description: v.optional(v.string()),
    relatedRecordId: v.optional(v.string()),
    relatedRecordType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await deductCreditsMutation(ctx, {
      userId: args.userId,
      feature: args.feature as MeteringFeature,
      tokenUsage: args.tokenUsage,
      model: args.model,
      description: args.description,
      relatedRecordId: args.relatedRecordId,
      relatedRecordType: args.relatedRecordType,
    });
  },
});

/**
 * Initialize credits for a user (internal - called during user creation)
 */
export const initializeCreditsInternal = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    await getOrCreateUserCredits(ctx, args.userId, args.email);
  },
});
