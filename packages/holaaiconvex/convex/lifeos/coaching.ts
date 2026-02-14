/**
 * AI Coaching - CRUD + Session Management
 *
 * Public mutations/queries for coach profile management,
 * coaching sessions (interactive chat), and action items.
 * Uses @convex-dev/agent for thread/message persistence.
 */

import { v } from "convex/values";
import {
  query,
  mutation,
  action,
  internalQuery,
  internalMutation,
} from "../_generated/server";
import { components, internal } from "../_generated/api";
import { getAuthUserId, requireUser } from "../_lib/auth";
import { Id } from "../_generated/dataModel";

// ==================== COACH PROFILE QUERIES ====================

/**
 * List all coach profiles for the current user
 */
export const getCoachProfiles = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return ctx.db
      .query("lifeos_coachingProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

/**
 * Get a single coach profile
 */
export const getCoachProfile = query({
  args: { profileId: v.id("lifeos_coachingProfiles") },
  handler: async (ctx, { profileId }) => {
    return ctx.db.get(profileId);
  },
});

/**
 * Internal query for the runner
 */
export const getCoachProfileInternal = internalQuery({
  args: { profileId: v.id("lifeos_coachingProfiles") },
  handler: async (ctx, { profileId }) => {
    return ctx.db.get(profileId);
  },
});

// ==================== COACH PROFILE MUTATIONS ====================

/**
 * Create a new coach profile
 */
export const createCoachProfile = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    instructions: v.string(),
    focusAreas: v.array(v.string()),
    enabledTools: v.array(v.string()),
    model: v.string(),
    greeting: v.optional(v.string()),
    sessionCadence: v.optional(
      v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("biweekly"),
        v.literal("monthly"),
        v.literal("ad_hoc"),
      ),
    ),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Check slug uniqueness
    const existing = await ctx.db
      .query("lifeos_coachingProfiles")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", user._id).eq("slug", args.slug),
      )
      .unique();
    if (existing) {
      throw new Error(`Coach with slug "${args.slug}" already exists`);
    }

    const now = Date.now();
    return ctx.db.insert("lifeos_coachingProfiles", {
      userId: user._id,
      name: args.name,
      slug: args.slug,
      instructions: args.instructions,
      focusAreas: args.focusAreas,
      enabledTools: args.enabledTools,
      model: args.model,
      greeting: args.greeting,
      sessionCadence: args.sessionCadence,
      color: args.color,
      icon: args.icon,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update a coach profile
 */
export const updateCoachProfile = mutation({
  args: {
    profileId: v.id("lifeos_coachingProfiles"),
    name: v.optional(v.string()),
    instructions: v.optional(v.string()),
    focusAreas: v.optional(v.array(v.string())),
    enabledTools: v.optional(v.array(v.string())),
    model: v.optional(v.string()),
    greeting: v.optional(v.string()),
    sessionCadence: v.optional(
      v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("biweekly"),
        v.literal("monthly"),
        v.literal("ad_hoc"),
      ),
    ),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, { profileId, ...updates }) => {
    const profile = await ctx.db.get(profileId);
    if (!profile) throw new Error("Coach profile not found");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    await ctx.db.patch(profileId, patch);
  },
});

/**
 * Delete a coach profile and all related sessions/action items
 */
export const deleteCoachProfile = mutation({
  args: { profileId: v.id("lifeos_coachingProfiles") },
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get(profileId);
    if (!profile) return;

    // Delete action items
    const actionItems = await ctx.db
      .query("lifeos_coachingActionItems")
      .withIndex("by_coach", (q) => q.eq("coachProfileId", profileId))
      .collect();
    for (const item of actionItems) {
      await ctx.db.delete(item._id);
    }

    // Delete sessions
    const sessions = await ctx.db
      .query("lifeos_coachingSessions")
      .withIndex("by_coach", (q) => q.eq("coachProfileId", profileId))
      .collect();
    for (const session of sessions) {
      // Archive the agent thread if it exists
      if (session.threadId) {
        try {
          await ctx.scheduler.runAfter(
            0,
            internal.lifeos.coaching.archiveThread,
            { threadId: session.threadId },
          );
        } catch {
          // Non-critical
        }
      }
      await ctx.db.delete(session._id);
    }

    // Delete profile
    await ctx.db.delete(profileId);
  },
});

// ==================== SESSION QUERIES ====================

/**
 * List coaching sessions for a coach profile
 */
export const getCoachingSessions = query({
  args: {
    coachProfileId: v.id("lifeos_coachingProfiles"),
    limit: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("summarizing"),
        v.literal("completed"),
      ),
    ),
  },
  handler: async (ctx, { coachProfileId, limit, status }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    let sessions = await ctx.db
      .query("lifeos_coachingSessions")
      .withIndex("by_coach_created", (q) =>
        q.eq("coachProfileId", coachProfileId),
      )
      .order("desc")
      .take(limit || 20);

    if (status) {
      sessions = sessions.filter((s) => s.status === status);
    }

    return sessions;
  },
});

/**
 * Get all sessions for the current user across all coaches
 */
export const getAllSessions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return ctx.db
      .query("lifeos_coachingSessions")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit || 30);
  },
});

/**
 * Get a single session
 */
export const getSession = query({
  args: { sessionId: v.id("lifeos_coachingSessions") },
  handler: async (ctx, { sessionId }) => {
    return ctx.db.get(sessionId);
  },
});

/**
 * Get the active session for a coach (if any)
 */
export const getActiveSession = query({
  args: { coachProfileId: v.id("lifeos_coachingProfiles") },
  handler: async (ctx, { coachProfileId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const sessions = await ctx.db
      .query("lifeos_coachingSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "active"),
      )
      .collect();

    return sessions.find((s) => s.coachProfileId === coachProfileId) ?? null;
  },
});

// ==================== SESSION MANAGEMENT ====================

/**
 * Start a new coaching session - creates a thread and session record
 */
export const startSession = action({
  args: {
    coachProfileId: v.id("lifeos_coachingProfiles"),
    moodAtStart: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { coachProfileId, moodAtStart },
  ): Promise<{
    sessionId: Id<"lifeos_coachingSessions">;
    threadId: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");

    const user = await ctx.runQuery(
      internal.common.users.getUserByTokenIdentifier,
      { tokenIdentifier: identity.tokenIdentifier },
    );
    if (!user) throw new Error("User not found");

    const userId = user._id as Id<"users">;

    // Load coach profile
    const profile = await ctx.runQuery(
      internal.lifeos.coaching.getCoachProfileInternal,
      { profileId: coachProfileId },
    );
    if (!profile) throw new Error("Coach profile not found");

    // Create agent thread
    const { thread, threadId } = await createCoachAgent(
      profile.model,
      profile.instructions,
      profile.enabledTools,
      profile.name,
    ).createThread(ctx, {
      userId: identity.subject,
      title: `${profile.name} Session`,
    });

    // Create session record
    const now = Date.now();
    const sessionId = await ctx.runMutation(
      internal.lifeos.coaching.createSessionInternal,
      {
        userId,
        coachProfileId,
        threadId,
        moodAtStart,
        startedAt: now,
      },
    );

    return { sessionId, threadId };
  },
});

/**
 * Send a message in a coaching session
 */
export const sendMessage = action({
  args: {
    sessionId: v.id("lifeos_coachingSessions"),
    message: v.string(),
  },
  handler: async (
    ctx,
    { sessionId, message },
  ): Promise<{
    text: string;
    toolCalls?: Array<{ name: string; args: unknown }>;
    toolResults?: Array<{ name: string; result: unknown }>;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");

    const user = await ctx.runQuery(
      internal.common.users.getUserByTokenIdentifier,
      { tokenIdentifier: identity.tokenIdentifier },
    );
    if (!user) throw new Error("User not found");

    const userId = user._id as Id<"users">;

    // Load session
    const session = await ctx.runQuery(
      internal.lifeos.coaching.getSessionInternal,
      { sessionId },
    );
    if (!session || session.userId !== userId) {
      throw new Error("Session not found or access denied");
    }
    if (session.status !== "active") {
      throw new Error("Session is not active");
    }
    if (!session.threadId) {
      throw new Error("Session has no thread");
    }

    // Load coach profile for config
    const profile = await ctx.runQuery(
      internal.lifeos.coaching.getCoachProfileInternal,
      { profileId: session.coachProfileId },
    );
    if (!profile) throw new Error("Coach profile not found");

    // Check credits
    const creditCheck = await ctx.runQuery(
      internal.common.credits.checkCreditsForAction,
    );
    if (!creditCheck.allowed) {
      throw new Error(creditCheck.reason || "OUT_OF_CREDITS");
    }

    // Build context prefix with past session data
    const contextPrefix = await buildCoachingContext(
      ctx,
      userId,
      session.coachProfileId,
      sessionId,
    );

    // Create agent and continue the thread
    const agent = createCoachAgent(
      profile.model,
      profile.instructions,
      profile.enabledTools,
      profile.name,
      contextPrefix,
    );

    const { thread } = await agent.continueThread(ctx, {
      threadId: session.threadId,
    });
    const result = await thread.generateText({
      prompt: message,
    });

    // Extract tool calls and results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyResult = result as any;
    const toolCalls: Array<{ name: string; args: unknown }> = [];
    const toolResults: Array<{ name: string; result: unknown }> = [];
    const textParts: string[] = [];

    if (anyResult.steps && Array.isArray(anyResult.steps)) {
      for (const step of anyResult.steps) {
        if (step.text && typeof step.text === "string" && step.text.trim()) {
          textParts.push(step.text);
        }
        if (step.content && Array.isArray(step.content)) {
          for (const item of step.content) {
            if (item.type === "tool-call" && item.toolName) {
              toolCalls.push({ name: item.toolName, args: item.input });
            }
            if (item.type === "tool-result" && item.toolName) {
              toolResults.push({
                name: item.toolName,
                result: item.output,
              });
            }
            if (item.type === "text" && item.text) {
              textParts.push(item.text);
            }
          }
        }
      }
    }

    const finalText = result.text || textParts.join("\n");

    // Auto-title first message
    try {
      const existingMessages = await ctx.runQuery(
        components.agent.messages.listMessagesByThreadId,
        {
          threadId: session.threadId,
          order: "asc",
          statuses: ["success"],
          paginationOpts: { numItems: 5, cursor: null },
        },
      );
      if (existingMessages.page.length <= 2) {
        const title =
          message.length > 60 ? message.slice(0, 57) + "..." : message;
        await ctx.runMutation(components.agent.threads.updateThread, {
          threadId: session.threadId,
          patch: { title },
        });
        await ctx.runMutation(internal.lifeos.coaching.updateSessionInternal, {
          sessionId,
          title,
        });
      }
    } catch {
      // Non-critical
    }

    return {
      text: finalText,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      toolResults: toolResults.length > 0 ? toolResults : undefined,
    };
  },
});

/**
 * End a coaching session and trigger auto-summarization
 */
export const endSession = action({
  args: {
    sessionId: v.id("lifeos_coachingSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");

    const user = await ctx.runQuery(
      internal.common.users.getUserByTokenIdentifier,
      { tokenIdentifier: identity.tokenIdentifier },
    );
    if (!user) throw new Error("User not found");

    const session = await ctx.runQuery(
      internal.lifeos.coaching.getSessionInternal,
      { sessionId },
    );
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found");
    }

    // Mark as summarizing
    await ctx.runMutation(internal.lifeos.coaching.updateSessionInternal, {
      sessionId,
      status: "summarizing",
    });

    // Schedule auto-summarization (actions cannot call other actions directly)
    await ctx.scheduler.runAfter(
      0,
      internal.lifeos.coaching_runner.summarizeSession,
      { sessionId },
    );

    return { success: true };
  },
});

/**
 * Get messages for a coaching session
 */
export const getSessionMessages = query({
  args: {
    sessionId: v.id("lifeos_coachingSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || !session.threadId) return [];

    const result = await ctx.runQuery(
      components.agent.messages.listMessagesByThreadId,
      {
        threadId: session.threadId,
        order: "asc",
        statuses: ["success"],
        paginationOpts: { numItems: 100, cursor: null },
      },
    );

    return result.page
      .map((msg) => {
        const message = msg.message;
        if (!message) return null;

        let textContent = "";
        const toolCalls: Array<{ name: string; args: unknown }> = [];
        const toolResults: Array<{ name: string; result: unknown }> = [];

        if (typeof message.content === "string") {
          textContent = message.content;
        } else if (Array.isArray(message.content)) {
          for (const part of message.content) {
            if (part.type === "text" && "text" in part) {
              textContent += part.text;
            } else if (part.type === "tool-call" && "toolName" in part) {
              toolCalls.push({ name: part.toolName, args: part.args });
            } else if (part.type === "tool-result" && "toolName" in part) {
              toolResults.push({
                name: part.toolName,
                result: "output" in part ? part.output : undefined,
              });
            }
          }
        }

        return {
          id: msg._id,
          role: message.role as "user" | "assistant",
          content: textContent,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          toolResults: toolResults.length > 0 ? toolResults : undefined,
          createdAt: msg._creationTime,
        };
      })
      .filter(Boolean);
  },
});

// ==================== ACTION ITEM QUERIES ====================

/**
 * Get action items for a coach profile
 */
export const getActionItems = query({
  args: {
    coachProfileId: v.optional(v.id("lifeos_coachingProfiles")),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("cancelled"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { coachProfileId, status, limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    let items;
    if (coachProfileId) {
      items = await ctx.db
        .query("lifeos_coachingActionItems")
        .withIndex("by_coach", (q) => q.eq("coachProfileId", coachProfileId))
        .order("desc")
        .take(limit || 50);
    } else {
      items = await ctx.db
        .query("lifeos_coachingActionItems")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(limit || 50);
    }

    if (status) {
      items = items.filter((i) => i.status === status);
    }

    return items;
  },
});

/**
 * Get pending action items count per coach
 */
export const getActionItemCounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return {};

    const items = await ctx.db
      .query("lifeos_coachingActionItems")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "pending"),
      )
      .collect();

    const counts: Record<string, number> = {};
    for (const item of items) {
      const key = item.coachProfileId as string;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  },
});

// ==================== ACTION ITEM MUTATIONS ====================

/**
 * Create a coaching action item
 */
export const createActionItem = mutation({
  args: {
    sessionId: v.id("lifeos_coachingSessions"),
    coachProfileId: v.id("lifeos_coachingProfiles"),
    text: v.string(),
    priority: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    ),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    return ctx.db.insert("lifeos_coachingActionItems", {
      userId: user._id,
      sessionId: args.sessionId,
      coachProfileId: args.coachProfileId,
      text: args.text,
      status: "pending",
      priority: args.priority,
      dueDate: args.dueDate,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update a coaching action item
 */
export const updateActionItem = mutation({
  args: {
    actionItemId: v.id("lifeos_coachingActionItems"),
    text: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("cancelled"),
      ),
    ),
    priority: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    ),
    dueDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    linkedIssueId: v.optional(v.id("lifeos_pmIssues")),
  },
  handler: async (ctx, { actionItemId, ...updates }) => {
    const item = await ctx.db.get(actionItemId);
    if (!item) throw new Error("Action item not found");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    // Set completedAt if marking as completed
    if (updates.status === "completed") {
      patch.completedAt = Date.now();
    }

    await ctx.db.patch(actionItemId, patch);
  },
});

/**
 * Delete a coaching action item
 */
export const deleteActionItem = mutation({
  args: { actionItemId: v.id("lifeos_coachingActionItems") },
  handler: async (ctx, { actionItemId }) => {
    await ctx.db.delete(actionItemId);
  },
});

// ==================== INTERNAL MUTATIONS ====================

export const createSessionInternal = internalMutation({
  args: {
    userId: v.id("users"),
    coachProfileId: v.id("lifeos_coachingProfiles"),
    threadId: v.string(),
    moodAtStart: v.optional(v.string()),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("lifeos_coachingSessions", {
      userId: args.userId,
      coachProfileId: args.coachProfileId,
      threadId: args.threadId,
      status: "active",
      moodAtStart: args.moodAtStart,
      startedAt: args.startedAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateSessionInternal = internalMutation({
  args: {
    sessionId: v.id("lifeos_coachingSessions"),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("summarizing"),
        v.literal("completed"),
      ),
    ),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    keyInsights: v.optional(v.array(v.string())),
    endedAt: v.optional(v.number()),
  },
  handler: async (ctx, { sessionId, ...updates }) => {
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    await ctx.db.patch(sessionId, patch);
  },
});

export const getSessionInternal = internalQuery({
  args: { sessionId: v.id("lifeos_coachingSessions") },
  handler: async (ctx, { sessionId }) => {
    return ctx.db.get(sessionId);
  },
});

export const archiveThread = internalMutation({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    await ctx.runMutation(components.agent.threads.updateThread, {
      threadId,
      patch: { status: "archived" },
    });
  },
});

export const createActionItemInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.id("lifeos_coachingSessions"),
    coachProfileId: v.id("lifeos_coachingProfiles"),
    text: v.string(),
    priority: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("lifeos_coachingActionItems", {
      userId: args.userId,
      sessionId: args.sessionId,
      coachProfileId: args.coachProfileId,
      text: args.text,
      status: "pending",
      priority: args.priority,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ==================== HELPER: AGENT FACTORY ====================

import { Agent, createTool } from "@convex-dev/agent";
import { gateway } from "@ai-sdk/gateway";
import { TOOL_REGISTRY } from "./agents_tool_registry";
import { z } from "zod";

/**
 * Maps tool names to their internal function references.
 * Reuses the same dispatch table as agents_runner.ts
 */
const TOOL_DISPATCH: Record<
  string,
  { ref: string; type: "query" | "mutation" }
> = {
  get_todays_tasks: { ref: "getTodaysTasksInternal", type: "query" },
  get_tasks: { ref: "getTasksInternal", type: "query" },
  create_issue: { ref: "createIssueInternal", type: "mutation" },
  mark_issue_complete: { ref: "markIssueCompleteInternal", type: "mutation" },
  get_issue: { ref: "getIssueInternal", type: "query" },
  update_issue: { ref: "updateIssueInternal", type: "mutation" },
  delete_issue: { ref: "deleteIssueInternal", type: "mutation" },
  get_projects: { ref: "getProjectsInternal", type: "query" },
  get_project: { ref: "getProjectInternal", type: "query" },
  create_project: { ref: "createProjectInternal", type: "mutation" },
  update_project: { ref: "updateProjectInternal", type: "mutation" },
  delete_project: { ref: "deleteProjectInternal", type: "mutation" },
  get_current_cycle: { ref: "getCurrentCycleInternal", type: "query" },
  get_cycles: { ref: "getCyclesInternal", type: "query" },
  create_cycle: { ref: "createCycleInternal", type: "mutation" },
  update_cycle: { ref: "updateCycleInternal", type: "mutation" },
  delete_cycle: { ref: "deleteCycleInternal", type: "mutation" },
  close_cycle: { ref: "closeCycleInternal", type: "mutation" },
  generate_cycles: { ref: "generateCyclesInternal", type: "mutation" },
  assign_issue_to_cycle: {
    ref: "assignIssueToCycleInternal",
    type: "mutation",
  },
  get_phases: { ref: "getPhasesInternal", type: "query" },
  get_phase: { ref: "getPhaseInternal", type: "query" },
  create_phase: { ref: "createPhaseInternal", type: "mutation" },
  update_phase: { ref: "updatePhaseInternal", type: "mutation" },
  delete_phase: { ref: "deletePhaseInternal", type: "mutation" },
  assign_issue_to_phase: {
    ref: "assignIssueToPhaseInternal",
    type: "mutation",
  },
  get_daily_agenda: { ref: "getDailyAgendaInternal", type: "query" },
  get_weekly_agenda: { ref: "getWeeklyAgendaInternal", type: "query" },
  get_monthly_agenda: { ref: "getMonthlyAgendaInternal", type: "query" },
  regenerate_daily_summary: {
    ref: "regenerateDailySummaryInternal",
    type: "mutation",
  },
  regenerate_weekly_summary: {
    ref: "regenerateWeeklySummaryInternal",
    type: "mutation",
  },
  regenerate_monthly_summary: {
    ref: "regenerateMonthlySummaryInternal",
    type: "mutation",
  },
  update_weekly_prompt: { ref: "updateWeeklyPromptInternal", type: "mutation" },
  update_monthly_prompt: {
    ref: "updateMonthlyPromptInternal",
    type: "mutation",
  },
  get_clients: { ref: "getClientsInternal", type: "query" },
  get_client: { ref: "getClientInternal", type: "query" },
  get_projects_for_client: {
    ref: "getProjectsForClientInternal",
    type: "query",
  },
  create_client: { ref: "createClientInternal", type: "mutation" },
  update_client: { ref: "updateClientInternal", type: "mutation" },
  delete_client: { ref: "deleteClientInternal", type: "mutation" },
  get_people: { ref: "getPeopleInternal", type: "query" },
  get_person: { ref: "getPersonInternal", type: "query" },
  search_people: { ref: "searchPeopleInternal", type: "query" },
  get_memos_for_person: { ref: "getMemosForPersonInternal", type: "query" },
  get_person_timeline: { ref: "getPersonTimelineInternal", type: "query" },
  create_person: { ref: "createPersonInternal", type: "mutation" },
  update_person: { ref: "updatePersonInternal", type: "mutation" },
  link_memo_to_person: { ref: "linkMemoToPersonInternal", type: "mutation" },
  search_notes: { ref: "searchNotesInternal", type: "query" },
  get_recent_notes: { ref: "getRecentNotesInternal", type: "query" },
  create_quick_note: { ref: "createQuickNoteInternal", type: "mutation" },
  add_tags_to_note: { ref: "addTagsToNoteInternal", type: "mutation" },
  get_voice_memo: { ref: "getVoiceMemoInternal", type: "query" },
  get_voice_memos_by_date: {
    ref: "getVoiceMemosByDateInternal",
    type: "query",
  },
  get_voice_memos_by_labels: {
    ref: "getVoiceMemosByLabelsInternal",
    type: "query",
  },
  get_voice_memo_labels: { ref: "getVoiceMemoLabelsInternal", type: "query" },
  create_ai_convo_summary: {
    ref: "createAiConvoSummaryInternal",
    type: "mutation",
  },
  get_ai_convo_summaries: { ref: "getAiConvoSummariesInternal", type: "query" },
  get_ai_convo_summary: { ref: "getAiConvoSummaryInternal", type: "query" },
  search_ai_convo_summaries: {
    ref: "searchAiConvoSummariesInternal",
    type: "query",
  },
  update_ai_convo_summary: {
    ref: "updateAiConvoSummaryInternal",
    type: "mutation",
  },
  delete_ai_convo_summary: {
    ref: "deleteAiConvoSummaryInternal",
    type: "mutation",
  },
  get_beeper_threads: { ref: "getBeeperThreadsInternal", type: "query" },
  get_beeper_thread: { ref: "getBeeperThreadInternal", type: "query" },
  get_beeper_thread_messages: {
    ref: "getBeeperThreadMessagesInternal",
    type: "query",
  },
  search_beeper_messages: {
    ref: "searchBeeperMessagesInternal",
    type: "query",
  },
  get_beeper_threads_for_person: {
    ref: "getBeeperThreadsForPersonInternal",
    type: "query",
  },
  get_beeper_threads_for_client: {
    ref: "getBeeperThreadsForClientInternal",
    type: "query",
  },
  get_granola_meetings: { ref: "getGranolaMeetingsInternal", type: "query" },
  get_granola_meeting: { ref: "getGranolaMeetingInternal", type: "query" },
  get_granola_transcript: {
    ref: "getGranolaTranscriptInternal",
    type: "query",
  },
  search_granola_meetings: {
    ref: "searchGranolaMeetingsInternal",
    type: "query",
  },
  get_granola_meetings_for_person: {
    ref: "getGranolaMeetingsForPersonInternal",
    type: "query",
  },
  get_granola_meetings_for_thread: {
    ref: "getGranolaMeetingsForThreadInternal",
    type: "query",
  },
  get_contact_dossier: { ref: "getContactDossierInternal", type: "query" },
  get_meeting_calendar_links: {
    ref: "getMeetingCalendarLinksInternal",
    type: "query",
  },
  sync_beeper_contacts_to_frm: {
    ref: "syncBeeperContactsToFrmInternal",
    type: "mutation",
  },
  link_beeper_thread_to_person: {
    ref: "linkBeeperThreadToPersonInternal",
    type: "mutation",
  },
  get_business_contacts: { ref: "getBusinessContactsInternal", type: "query" },
  get_merge_suggestions: { ref: "getMergeSuggestionsInternal", type: "query" },
  accept_merge_suggestion: {
    ref: "acceptMergeSuggestionInternal",
    type: "mutation",
  },
  reject_merge_suggestion: {
    ref: "rejectMergeSuggestionInternal",
    type: "mutation",
  },
  dismiss_all_merge_suggestions: {
    ref: "dismissAllMergeSuggestionsInternal",
    type: "mutation",
  },
  unlink_meeting_from_business_contact: {
    ref: "unlinkMeetingFromBusinessContactInternal",
    type: "mutation",
  },
  get_initiatives: { ref: "getInitiativesInternal", type: "query" },
  get_initiative: { ref: "getInitiativeInternal", type: "query" },
  get_initiative_with_stats: {
    ref: "getInitiativeWithStatsInternal",
    type: "query",
  },
  create_initiative: { ref: "createInitiativeInternal", type: "mutation" },
  update_initiative: { ref: "updateInitiativeInternal", type: "mutation" },
  archive_initiative: { ref: "archiveInitiativeInternal", type: "mutation" },
  delete_initiative: { ref: "deleteInitiativeInternal", type: "mutation" },
  link_project_to_initiative: {
    ref: "linkProjectToInitiativeInternal",
    type: "mutation",
  },
  link_issue_to_initiative: {
    ref: "linkIssueToInitiativeInternal",
    type: "mutation",
  },
  get_initiative_yearly_rollup: {
    ref: "getInitiativeYearlyRollupInternal",
    type: "query",
  },
};

/**
 * Build createTool wrappers for the enabled tools, injecting userId.
 */
function buildCoachTools(enabledTools: string[], userId: Id<"users">) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  for (const toolName of enabledTools) {
    const registry = TOOL_REGISTRY[toolName];
    const dispatch = TOOL_DISPATCH[toolName];
    if (!registry || !dispatch) continue;

    const capturedRef = dispatch.ref;
    const capturedType = dispatch.type;
    const capturedUserId = userId;

    tools[toolName] = createTool({
      description: registry.description,
      args: registry.parameters,
      handler: async (ctx, args) => {
        const params = { userId: capturedUserId, ...args } as Record<
          string,
          unknown
        >;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fnRef = (internal.lifeos.tool_call as any)[capturedRef];
        if (!fnRef) return { error: `Tool function not found: ${capturedRef}` };

        try {
          if (capturedType === "query") {
            return await ctx.runQuery(fnRef, params);
          } else {
            return await ctx.runMutation(fnRef, params);
          }
        } catch (error) {
          return {
            error:
              error instanceof Error ? error.message : "Tool execution failed",
          };
        }
      },
    });
  }

  return tools;
}

/**
 * Create a coach agent instance with the given profile config.
 * Builds tools dynamically from enabledTools.
 */
function createCoachAgent(
  model: string,
  instructions: string,
  enabledTools: string[],
  coachName: string,
  contextPrefix?: string,
) {
  // We'll build tools lazily in the action since we need userId
  // For now, create agent without tools - they're added per-request
  const fullInstructions = contextPrefix
    ? `${instructions}\n\n--- SESSION CONTEXT ---\n${contextPrefix}`
    : instructions;

  return new Agent(components.agent, {
    name: coachName,
    languageModel: gateway(model),
    instructions: fullInstructions,
    // Tools are built dynamically per-request since we need userId
    // However @convex-dev/agent requires tools at instantiation
    // We'll pass empty here and use the full set via continueThread
    tools: {},
    maxSteps: 15,
  });
}

/**
 * Build coaching context to prepend to the session.
 * Loads past session summaries, action items, current goals.
 */
async function buildCoachingContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  userId: Id<"users">,
  coachProfileId: Id<"lifeos_coachingProfiles">,
  currentSessionId: Id<"lifeos_coachingSessions">,
): Promise<string> {
  const parts: string[] = [];

  // Load past completed sessions for this coach (last 5)
  const pastSessions = await ctx.runQuery(
    internal.lifeos.coaching.getPastSessionSummaries,
    { coachProfileId, limit: 5 },
  );
  if (pastSessions && pastSessions.length > 0) {
    parts.push("## Previous Session Summaries");
    for (const s of pastSessions) {
      parts.push(
        `### ${s.title || "Untitled Session"} (${new Date(s.endedAt || s.createdAt).toLocaleDateString()})`,
      );
      if (s.summary) parts.push(s.summary);
      if (s.keyInsights?.length) {
        parts.push("Key insights: " + s.keyInsights.join("; "));
      }
    }
  }

  // Load pending action items
  const pendingItems = await ctx.runQuery(
    internal.lifeos.coaching.getPendingActionItemsInternal,
    { coachProfileId, userId },
  );
  if (pendingItems && pendingItems.length > 0) {
    parts.push("\n## Outstanding Action Items");
    for (const item of pendingItems) {
      const due = item.dueDate
        ? ` (due: ${new Date(item.dueDate).toLocaleDateString()})`
        : "";
      const priority = item.priority ? ` [${item.priority}]` : "";
      parts.push(`- ${item.text}${priority}${due}`);
    }
  }

  return parts.join("\n");
}

// ==================== INTERNAL QUERIES FOR CONTEXT ====================

export const getPastSessionSummaries = internalQuery({
  args: {
    coachProfileId: v.id("lifeos_coachingProfiles"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { coachProfileId, limit }) => {
    const sessions = await ctx.db
      .query("lifeos_coachingSessions")
      .withIndex("by_coach_created", (q) =>
        q.eq("coachProfileId", coachProfileId),
      )
      .order("desc")
      .take(limit || 5);

    return sessions
      .filter((s) => s.status === "completed" && s.summary)
      .map((s) => ({
        title: s.title,
        summary: s.summary,
        keyInsights: s.keyInsights,
        endedAt: s.endedAt,
        createdAt: s.createdAt,
      }));
  },
});

export const getPendingActionItemsInternal = internalQuery({
  args: {
    coachProfileId: v.id("lifeos_coachingProfiles"),
    userId: v.id("users"),
  },
  handler: async (ctx, { coachProfileId }) => {
    return ctx.db
      .query("lifeos_coachingActionItems")
      .withIndex("by_coach_status", (q) =>
        q.eq("coachProfileId", coachProfileId).eq("status", "pending"),
      )
      .collect();
  },
});
