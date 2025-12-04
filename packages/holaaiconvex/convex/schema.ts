import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
    // Timestamps
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  messages: defineTable({
    content: v.string(),
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),
});
