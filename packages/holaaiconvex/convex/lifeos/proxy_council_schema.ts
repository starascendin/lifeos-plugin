import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Proxy Council Settings Schema
 *
 * User settings for the Proxy LLM Council iframe.
 * Stores URL and basic auth credentials for the external council server.
 */

export const proxyCouncilTables = {
  lifeos_proxyCouncilSettings: defineTable({
    userId: v.id("users"),
    // Server URL
    url: v.string(),
    // Basic auth credentials
    username: v.string(),
    password: v.string(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
};
