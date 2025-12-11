import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * User role union type for validation
 * To add a new role, update this and _lib/roles.ts
 */
export const userRoles = v.union(v.literal("user"), v.literal("developer"));

/**
 * Common tables shared across all apps
 * These tables are used by holaai, lifeos, and any future apps
 */
export const commonTables = {
  // ==================== USERS ====================
  users: defineTable({
    // Clerk token identifier (format: "issuer|subject")
    tokenIdentifier: v.optional(v.string()),
    // User email from Clerk
    email: v.string(),
    // User's full name
    name: v.optional(v.string()),
    // Profile picture URL
    pictureUrl: v.optional(v.string()),
    // Email verification timestamp
    emailVerificationTime: v.optional(v.number()),
    // User role (defaults to "user" if not set)
    role: v.optional(userRoles),
    // Timestamps
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  // ==================== MESSAGES ====================
  messages: defineTable({
    content: v.string(),
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),
};
