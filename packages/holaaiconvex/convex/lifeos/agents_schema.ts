import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Custom AI Agents Tables
 *
 * Tables for user-configurable AI agents with tool selection and cron scheduling.
 * All table names are prefixed with `lifeos_customAgent` to avoid conflicts.
 */
export const customAgentTables = {
  // ==================== AGENT CONFIGS ====================
  lifeos_customAgentConfigs: defineTable({
    userId: v.id("users"),
    name: v.string(),
    slug: v.string(),
    instructions: v.string(),
    enabledTools: v.array(v.string()),
    model: v.string(),
    greeting: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    // Cron scheduling
    cronSchedule: v.optional(v.string()),
    cronPrompt: v.optional(v.string()),
    cronEnabled: v.optional(v.boolean()),
    cronTimezone: v.optional(v.string()),
    scheduledFnId: v.optional(v.id("_scheduled_functions")),
    lastRunAt: v.optional(v.number()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_slug", ["userId", "slug"])
    .index("by_user_default", ["userId", "isDefault"]),

  // ==================== AGENT RUNS ====================
  lifeos_customAgentRuns: defineTable({
    userId: v.id("users"),
    agentConfigId: v.id("lifeos_customAgentConfigs"),
    trigger: v.union(v.literal("cron"), v.literal("manual")),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    prompt: v.string(),
    output: v.optional(v.string()),
    toolCallLog: v.optional(
      v.array(
        v.object({
          tool: v.string(),
          params: v.optional(v.string()),
          result: v.optional(v.string()),
        })
      )
    ),
    model: v.string(),
    threadId: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_agent", ["agentConfigId"])
    .index("by_user_created", ["userId", "startedAt"])
    .index("by_status", ["status"]),
};
