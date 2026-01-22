import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";

/**
 * Centralized Credit/Metering System
 *
 * All AI features should use this module to check and deduct credits.
 * Developers (bsliu17@gmail.com, bryanshliu@gmail.com, bryan@rocketjump.tech) have unlimited access.
 * Other users start with 0 credits and must request access.
 */

// ==================== TYPES ====================

/**
 * All metered AI features
 */
export type MeteringFeature =
  // LifeOS features
  | "agenda_daily_summary"
  | "agenda_weekly_summary"
  | "pm_agent"
  | "demo_agent"
  | "chatnexus"
  | "llm_council"
  | "voice_memo_extraction"
  // HolaAI features
  | "holaai_lesson"
  | "holaai_conversation"
  | "holaai_suggestions"
  | "holaai_voice"
  | "holaai_translate";

/**
 * Cost per 1000 tokens for each feature
 * Higher costs for multi-model or complex features
 */
export const FEATURE_COSTS: Record<MeteringFeature, number> = {
  // LifeOS features
  agenda_daily_summary: 1,
  agenda_weekly_summary: 2,
  pm_agent: 2,
  demo_agent: 1,
  chatnexus: 2,
  llm_council: 5, // Multi-model, more expensive
  voice_memo_extraction: 1,
  // HolaAI features
  holaai_lesson: 3,
  holaai_conversation: 2,
  holaai_suggestions: 1,
  holaai_voice: 3,
  holaai_translate: 1,
};

/**
 * Emails with unlimited access (developers)
 */
export const UNLIMITED_ACCESS_EMAILS = [
  "bsliu17@gmail.com",
  "bryanshliu@gmail.com",
  "bryan@rocketjump.tech",
];

/**
 * Result of a credit check
 */
export interface CreditCheckResult {
  allowed: boolean;
  hasUnlimitedAccess: boolean;
  currentBalance: number;
  reason?: string;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if an email has unlimited access
 */
export function hasUnlimitedAccessByEmail(email: string): boolean {
  return UNLIMITED_ACCESS_EMAILS.includes(email.toLowerCase());
}

/**
 * Calculate credit cost based on token usage
 */
export function calculateCreditCost(
  feature: MeteringFeature,
  totalTokens: number
): number {
  const costPer1000Tokens = FEATURE_COSTS[feature];
  return Math.ceil((totalTokens / 1000) * costPer1000Tokens);
}

// ==================== QUERY/MUTATION CONTEXT FUNCTIONS ====================

/**
 * Get or create a user's credit record
 * Called internally - does not authenticate
 */
export async function getOrCreateUserCredits(
  ctx: MutationCtx,
  userId: Id<"users">,
  email: string
): Promise<Doc<"lifeos_userCredits">> {
  // Check if credits record exists
  const existing = await ctx.db
    .query("lifeos_userCredits")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (existing) {
    return existing;
  }

  // Create new credits record
  const hasUnlimited = hasUnlimitedAccessByEmail(email);
  const now = Date.now();

  const creditsId = await ctx.db.insert("lifeos_userCredits", {
    userId,
    balance: 0, // Everyone starts with 0
    totalGranted: 0,
    totalConsumed: 0,
    hasUnlimitedAccess: hasUnlimited,
    createdAt: now,
    updatedAt: now,
  });

  return (await ctx.db.get(creditsId))!;
}

/**
 * Check if a user can use AI features (query context - read only)
 */
export async function checkCreditsQuery(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<CreditCheckResult> {
  const credits = await ctx.db
    .query("lifeos_userCredits")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  // No credits record means user hasn't been initialized yet
  if (!credits) {
    return {
      allowed: false,
      hasUnlimitedAccess: false,
      currentBalance: 0,
      reason: "Credits not initialized. Please refresh the page.",
    };
  }

  // Unlimited access users always allowed
  if (credits.hasUnlimitedAccess) {
    return {
      allowed: true,
      hasUnlimitedAccess: true,
      currentBalance: credits.balance,
    };
  }

  // Check balance
  if (credits.balance <= 0) {
    return {
      allowed: false,
      hasUnlimitedAccess: false,
      currentBalance: credits.balance,
      reason: "You have run out of AI credits. Please request more credits.",
    };
  }

  return {
    allowed: true,
    hasUnlimitedAccess: false,
    currentBalance: credits.balance,
  };
}

/**
 * Check if a user can use AI features (mutation context)
 * Also creates credit record if missing
 */
export async function checkCreditsMutation(
  ctx: MutationCtx,
  userId: Id<"users">,
  email: string
): Promise<CreditCheckResult> {
  // Ensure credits record exists
  const credits = await getOrCreateUserCredits(ctx, userId, email);

  // Unlimited access users always allowed
  if (credits.hasUnlimitedAccess) {
    return {
      allowed: true,
      hasUnlimitedAccess: true,
      currentBalance: credits.balance,
    };
  }

  // Check balance
  if (credits.balance <= 0) {
    return {
      allowed: false,
      hasUnlimitedAccess: false,
      currentBalance: credits.balance,
      reason: "You have run out of AI credits. Please request more credits.",
    };
  }

  return {
    allowed: true,
    hasUnlimitedAccess: false,
    currentBalance: credits.balance,
  };
}

/**
 * Deduct credits after AI usage
 * Should be called after successful AI call
 */
export async function deductCreditsMutation(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    feature: MeteringFeature;
    tokenUsage: TokenUsage;
    model: string;
    description?: string;
    relatedRecordId?: string;
    relatedRecordType?: string;
  }
): Promise<void> {
  const credits = await ctx.db
    .query("lifeos_userCredits")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .first();

  if (!credits) {
    console.error("Credits record not found for user:", args.userId);
    return;
  }

  // Don't deduct for unlimited access users
  if (credits.hasUnlimitedAccess) {
    // Still log the transaction for analytics
    await ctx.db.insert("lifeos_creditTransactions", {
      userId: args.userId,
      type: "deduction",
      amount: 0, // No actual deduction
      balanceAfter: credits.balance,
      description:
        args.description || `${args.feature} (unlimited access - no charge)`,
      feature: args.feature,
      tokenUsage: args.tokenUsage,
      model: args.model,
      relatedRecordId: args.relatedRecordId,
      relatedRecordType: args.relatedRecordType,
      createdAt: Date.now(),
    });
    return;
  }

  // Calculate cost
  const cost = calculateCreditCost(args.feature, args.tokenUsage.totalTokens);
  const newBalance = Math.max(0, credits.balance - cost);

  // Update balance
  await ctx.db.patch(credits._id, {
    balance: newBalance,
    totalConsumed: credits.totalConsumed + cost,
    updatedAt: Date.now(),
  });

  // Log transaction
  await ctx.db.insert("lifeos_creditTransactions", {
    userId: args.userId,
    type: "deduction",
    amount: -cost,
    balanceAfter: newBalance,
    description: args.description || `Used ${args.feature}`,
    feature: args.feature,
    tokenUsage: args.tokenUsage,
    model: args.model,
    relatedRecordId: args.relatedRecordId,
    relatedRecordType: args.relatedRecordType,
    createdAt: Date.now(),
  });
}

/**
 * Initialize credits for a new user
 * Called from getOrCreateUser in auth.ts
 */
export async function initializeUserCredits(
  ctx: MutationCtx,
  userId: Id<"users">,
  email: string
): Promise<void> {
  // Check if already exists
  const existing = await ctx.db
    .query("lifeos_userCredits")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (existing) {
    // Update unlimited access status in case email was added to developers
    const shouldHaveUnlimited = hasUnlimitedAccessByEmail(email);
    if (existing.hasUnlimitedAccess !== shouldHaveUnlimited) {
      await ctx.db.patch(existing._id, {
        hasUnlimitedAccess: shouldHaveUnlimited,
        updatedAt: Date.now(),
      });
    }
    return;
  }

  // Create new record
  const hasUnlimited = hasUnlimitedAccessByEmail(email);
  const now = Date.now();

  await ctx.db.insert("lifeos_userCredits", {
    userId,
    balance: 0,
    totalGranted: 0,
    totalConsumed: 0,
    hasUnlimitedAccess: hasUnlimited,
    createdAt: now,
    updatedAt: now,
  });
}

// ==================== ACTION CONTEXT FUNCTIONS ====================

/**
 * Check credits in action context
 * Throws error if insufficient credits
 */
export async function requireCreditsAction(
  ctx: ActionCtx,
  feature: MeteringFeature
): Promise<{
  userId: Id<"users">;
  hasUnlimitedAccess: boolean;
  currentBalance: number;
}> {
  // Get user info via internal query
  const result = await ctx.runQuery(
    internal.common.credits.checkCreditsForAction
  );

  if (!result.allowed) {
    throw new Error(result.reason || "OUT_OF_CREDITS");
  }

  return {
    userId: result.userId,
    hasUnlimitedAccess: result.hasUnlimitedAccess,
    currentBalance: result.currentBalance,
  };
}

/**
 * Deduct credits in action context
 * Calls internal mutation
 */
export async function deductCreditsAction(
  ctx: ActionCtx,
  args: {
    userId: Id<"users">;
    feature: MeteringFeature;
    tokenUsage: TokenUsage;
    model: string;
    description?: string;
    relatedRecordId?: string;
    relatedRecordType?: string;
  }
): Promise<void> {
  await ctx.runMutation(internal.common.credits.deductCreditsInternal, {
    userId: args.userId,
    feature: args.feature,
    tokenUsage: args.tokenUsage,
    model: args.model,
    description: args.description,
    relatedRecordId: args.relatedRecordId,
    relatedRecordType: args.relatedRecordType,
  });
}

// ==================== ERROR CLASSES ====================

/**
 * Error thrown when user has insufficient credits
 */
export class InsufficientCreditsError extends Error {
  constructor(
    public currentBalance: number,
    public feature: MeteringFeature
  ) {
    super(
      `Insufficient credits. Current balance: ${currentBalance}. ` +
        `Please request more credits to use ${feature}.`
    );
    this.name = "InsufficientCreditsError";
  }
}

/**
 * Error thrown when user has no credits at all
 */
export class NoCreditsError extends Error {
  constructor() {
    super(
      "You have no credits available. Please request access to get started."
    );
    this.name = "NoCreditsError";
  }
}
