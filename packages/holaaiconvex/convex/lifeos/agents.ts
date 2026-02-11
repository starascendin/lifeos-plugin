/**
 * Custom AI Agents - CRUD + Scheduling
 *
 * Public mutations/queries for agent config management and triggering runs.
 */

import { v } from "convex/values";
import {
  query,
  mutation,
  action,
  internalQuery,
  internalMutation,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { Cron } from "croner";
import { requireUser, getAuthUserId } from "../_lib/auth";

// ==================== QUERIES ====================

/**
 * List all agent configs for the current user
 */
export const getAgentConfigs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return ctx.db
      .query("lifeos_customAgentConfigs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

/**
 * Get a single agent config
 */
export const getAgentConfig = query({
  args: { agentConfigId: v.id("lifeos_customAgentConfigs") },
  handler: async (ctx, { agentConfigId }) => {
    return ctx.db.get(agentConfigId);
  },
});

/**
 * Internal query for the runner
 */
export const getAgentConfigInternal = internalQuery({
  args: { agentConfigId: v.id("lifeos_customAgentConfigs") },
  handler: async (ctx, { agentConfigId }) => {
    return ctx.db.get(agentConfigId);
  },
});

/**
 * List runs for an agent
 */
export const getAgentRuns = query({
  args: {
    agentConfigId: v.id("lifeos_customAgentConfigs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { agentConfigId, limit }) => {
    return ctx.db
      .query("lifeos_customAgentRuns")
      .withIndex("by_agent", (q) => q.eq("agentConfigId", agentConfigId))
      .order("desc")
      .take(limit || 20);
  },
});

/**
 * Get a single run with full details
 */
export const getAgentRun = query({
  args: { runId: v.id("lifeos_customAgentRuns") },
  handler: async (ctx, { runId }) => {
    return ctx.db.get(runId);
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new agent config
 */
export const createAgentConfig = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    instructions: v.string(),
    enabledTools: v.array(v.string()),
    model: v.string(),
    greeting: v.optional(v.string()),
    cronSchedule: v.optional(v.string()),
    cronPrompt: v.optional(v.string()),
    cronEnabled: v.optional(v.boolean()),
    cronTimezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Check slug uniqueness for this user
    const existing = await ctx.db
      .query("lifeos_customAgentConfigs")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", user._id).eq("slug", args.slug)
      )
      .unique();
    if (existing) {
      throw new Error(`Agent with slug "${args.slug}" already exists`);
    }

    const now = Date.now();
    const configId = await ctx.db.insert("lifeos_customAgentConfigs", {
      userId: user._id,
      name: args.name,
      slug: args.slug,
      instructions: args.instructions,
      enabledTools: args.enabledTools,
      model: args.model,
      greeting: args.greeting,
      cronSchedule: args.cronSchedule,
      cronPrompt: args.cronPrompt,
      cronEnabled: args.cronEnabled,
      cronTimezone: args.cronTimezone,
      createdAt: now,
      updatedAt: now,
    });

    // Schedule first cron run if enabled
    if (args.cronEnabled && args.cronSchedule) {
      await ctx.scheduler.runAfter(
        0,
        internal.lifeos.agents.scheduleNextRun,
        { agentConfigId: configId }
      );
    }

    return configId;
  },
});

/**
 * Update an agent config
 */
export const updateAgentConfig = mutation({
  args: {
    agentConfigId: v.id("lifeos_customAgentConfigs"),
    name: v.optional(v.string()),
    instructions: v.optional(v.string()),
    enabledTools: v.optional(v.array(v.string())),
    model: v.optional(v.string()),
    greeting: v.optional(v.string()),
    cronSchedule: v.optional(v.string()),
    cronPrompt: v.optional(v.string()),
    cronEnabled: v.optional(v.boolean()),
    cronTimezone: v.optional(v.string()),
  },
  handler: async (ctx, { agentConfigId, ...updates }) => {
    const config = await ctx.db.get(agentConfigId);
    if (!config) throw new Error("Agent config not found");

    // Cancel old schedule if cron settings changed
    const cronChanged =
      updates.cronSchedule !== undefined ||
      updates.cronEnabled !== undefined ||
      updates.cronTimezone !== undefined;

    if (cronChanged && config.scheduledFnId) {
      try {
        await ctx.scheduler.cancel(config.scheduledFnId);
      } catch {
        // Already executed or cancelled
      }
    }

    // Apply updates
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    await ctx.db.patch(agentConfigId, patch);

    // Reschedule if cron enabled
    const newCronEnabled =
      updates.cronEnabled !== undefined ? updates.cronEnabled : config.cronEnabled;
    const newCronSchedule =
      updates.cronSchedule !== undefined
        ? updates.cronSchedule
        : config.cronSchedule;

    if (cronChanged && newCronEnabled && newCronSchedule) {
      await ctx.scheduler.runAfter(
        0,
        internal.lifeos.agents.scheduleNextRun,
        { agentConfigId }
      );
    }
  },
});

/**
 * Delete an agent config and its runs
 */
export const deleteAgentConfig = mutation({
  args: { agentConfigId: v.id("lifeos_customAgentConfigs") },
  handler: async (ctx, { agentConfigId }) => {
    const config = await ctx.db.get(agentConfigId);
    if (!config) return;

    // Cancel scheduled function
    if (config.scheduledFnId) {
      try {
        await ctx.scheduler.cancel(config.scheduledFnId);
      } catch {
        // Already executed or cancelled
      }
    }

    // Delete runs
    const runs = await ctx.db
      .query("lifeos_customAgentRuns")
      .withIndex("by_agent", (q) => q.eq("agentConfigId", agentConfigId))
      .collect();
    for (const run of runs) {
      await ctx.db.delete(run._id);
    }

    // Delete config
    await ctx.db.delete(agentConfigId);
  },
});

// ==================== TRIGGER ====================

/**
 * Manually trigger an agent run
 */
export const triggerAgentRun = action({
  args: {
    agentConfigId: v.id("lifeos_customAgentConfigs"),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, { agentConfigId, prompt }) => {
    await ctx.runAction(internal.lifeos.agents_runner.runAgentInternal, {
      agentConfigId,
      trigger: "manual",
      prompt,
    });
  },
});

// ==================== INTERNAL MUTATIONS (for runner) ====================

/**
 * Create a run record
 */
export const createRunRecord = internalMutation({
  args: {
    userId: v.id("users"),
    agentConfigId: v.id("lifeos_customAgentConfigs"),
    trigger: v.union(v.literal("cron"), v.literal("manual")),
    prompt: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("lifeos_customAgentRuns", {
      userId: args.userId,
      agentConfigId: args.agentConfigId,
      trigger: args.trigger,
      status: "running",
      prompt: args.prompt,
      model: args.model,
      startedAt: Date.now(),
    });
  },
});

/**
 * Update a run record
 */
export const updateRunRecord = internalMutation({
  args: {
    runId: v.id("lifeos_customAgentRuns"),
    status: v.union(
      v.literal("completed"),
      v.literal("failed")
    ),
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
    threadId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { runId, ...updates }) => {
    await ctx.db.patch(runId, {
      ...updates,
      completedAt: Date.now(),
    });
  },
});

/**
 * Update agent's lastRunAt
 */
export const updateAgentLastRun = internalMutation({
  args: {
    agentConfigId: v.id("lifeos_customAgentConfigs"),
    lastRunAt: v.number(),
  },
  handler: async (ctx, { agentConfigId, lastRunAt }) => {
    await ctx.db.patch(agentConfigId, { lastRunAt });
  },
});

// ==================== SCHEDULING ====================

/**
 * Schedule the next cron run for an agent.
 * Uses croner (zero-dependency, works in Convex default runtime).
 */
export const scheduleNextRun = internalMutation({
  args: {
    agentConfigId: v.id("lifeos_customAgentConfigs"),
  },
  handler: async (ctx, { agentConfigId }) => {
    const config = await ctx.db.get(agentConfigId);
    if (!config || !config.cronEnabled || !config.cronSchedule) return;

    // Cancel existing scheduled function
    if (config.scheduledFnId) {
      try {
        await ctx.scheduler.cancel(config.scheduledFnId);
      } catch {
        // Already executed or cancelled
      }
    }

    // Parse cron and get next run time
    try {
      const job = new Cron(config.cronSchedule, {
        timezone: config.cronTimezone || "America/New_York",
      });
      const nextDate = job.nextRun();
      if (!nextDate) return;

      // Schedule the run
      const scheduledFnId = await ctx.scheduler.runAt(
        nextDate,
        internal.lifeos.agents_runner.runAgentInternal,
        {
          agentConfigId,
          trigger: "cron" as const,
        }
      );

      // Save the scheduled function ID
      await ctx.db.patch(agentConfigId, { scheduledFnId });
    } catch (error) {
      console.error(
        `Failed to schedule next run for agent ${agentConfigId}:`,
        error
      );
    }
  },
});
