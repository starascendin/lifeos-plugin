import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Credit System Tables
 *
 * Provides usage metering and access control for AI features across all apps.
 * - Developers (bsliu17@gmail.com, bryanshliu@gmail.com, bryan@rocketjump.tech) have unlimited access
 * - Other users start with 0 credits and must request access
 */

// Credit transaction types
export const creditTransactionType = v.union(
  v.literal("grant"), // Admin grants credits
  v.literal("deduction"), // AI usage consumed credits
  v.literal("adjustment") // Manual adjustment
);

// Credit request status
export const creditRequestStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("denied")
);

// Token usage object
export const tokenUsageObject = v.object({
  promptTokens: v.number(),
  completionTokens: v.number(),
  totalTokens: v.number(),
});

export const creditsTables = {
  // ==================== USER CREDITS ====================
  // Tracks each user's credit balance and access level
  lifeos_userCredits: defineTable({
    // Reference to user
    userId: v.id("users"),
    // Current credit balance (starts at 0 for new users)
    balance: v.number(),
    // Total credits ever granted to this user
    totalGranted: v.number(),
    // Total credits consumed by this user
    totalConsumed: v.number(),
    // Whether user has unlimited access (true for developers)
    hasUnlimitedAccess: v.boolean(),
    // Last time user requested credits
    lastCreditRequestAt: v.optional(v.number()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ==================== CREDIT TRANSACTIONS ====================
  // Audit log of all credit operations
  lifeos_creditTransactions: defineTable({
    // Reference to user
    userId: v.id("users"),
    // Type of transaction
    type: creditTransactionType,
    // Amount (positive for grants, negative for deductions)
    amount: v.number(),
    // Balance after this transaction
    balanceAfter: v.number(),
    // Description/reason for the transaction
    description: v.string(),
    // For deductions: which AI feature was used
    feature: v.optional(v.string()),
    // For deductions: detailed token usage
    tokenUsage: v.optional(tokenUsageObject),
    // Model used (for analytics)
    model: v.optional(v.string()),
    // Reference to related record (e.g., message ID, summary ID)
    relatedRecordId: v.optional(v.string()),
    relatedRecordType: v.optional(v.string()),
    // Timestamp
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_type", ["type"])
    .index("by_feature", ["feature"]),

  // ==================== CREDIT REQUESTS ====================
  // User requests for credits (new users start with 0)
  lifeos_creditRequests: defineTable({
    // Reference to user
    userId: v.id("users"),
    // Request status
    status: creditRequestStatus,
    // User's message/reason for requesting credits
    message: v.optional(v.string()),
    // Admin's response message
    adminResponse: v.optional(v.string()),
    // Credits granted (if approved)
    creditsGranted: v.optional(v.number()),
    // Email of admin who processed the request
    processedBy: v.optional(v.string()),
    // When the request was processed
    processedAt: v.optional(v.number()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"]),
};
