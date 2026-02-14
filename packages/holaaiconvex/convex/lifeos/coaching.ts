/**
 * AI Coaching - CRUD + Session Management
 *
 * Public mutations/queries for coach profile management,
 * coaching sessions (interactive chat), and action items.
 * Uses @convex-dev/agent for thread/message persistence.
 * Reuses the same tools as CatGirl agent via catgirlTools.
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
import { Agent } from "@convex-dev/agent";
import { gateway } from "@ai-sdk/gateway";
import { catgirlTools } from "./lib/catgirl_tools";
import { setCurrentUserId, getCurrentUserId } from "./lib/catgirl_context";

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

// ==================== AGENT FACTORY ====================

/**
 * Filter catgirlTools to only the enabled subset for this coach.
 * Reuses the exact same tool instances that CatGirl uses, so
 * userId flows via the shared module-level context (catgirl_context.ts).
 */
function getFilteredTools(enabledTools: string[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered: Record<string, any> = {};
  for (const toolName of enabledTools) {
    if (toolName in catgirlTools) {
      filtered[toolName] = catgirlTools[toolName as keyof typeof catgirlTools];
    }
  }
  return filtered;
}

/**
 * Create a coach agent instance with the given profile config.
 * Tools are the CatGirl tools filtered to the coach's enabledTools list.
 */
function createCoachAgent(
  model: string,
  instructions: string,
  enabledTools: string[],
  coachName: string,
  contextPrefix?: string,
) {
  const fullInstructions = contextPrefix
    ? `${instructions}\n\n--- SESSION CONTEXT ---\n${contextPrefix}`
    : instructions;

  const tools = getFilteredTools(enabledTools);

  return new Agent(components.agent, {
    name: coachName,
    languageModel: gateway(model),
    instructions: fullInstructions,
    tools,
    maxSteps: 15,
  });
}

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

    // Create agent thread (set userId context for tools)
    setCurrentUserId(userId);
    const agent = createCoachAgent(
      profile.model,
      profile.instructions,
      profile.enabledTools,
      profile.name,
    );
    const { threadId } = await agent.createThread(ctx, {
      userId: identity.subject,
      title: `${profile.name} Session`,
    });
    setCurrentUserId(null);

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
 * Send a message in a coaching session.
 * Uses the same module-level userId pattern as CatGirl agent.
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

    // Set userId for tool context (same pattern as CatGirl)
    setCurrentUserId(userId);

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

    // Clear userId after request
    setCurrentUserId(null);

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
 * Get messages for a coaching session (reactive query)
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

// ==================== COACHING CONTEXT BUILDER ====================

/**
 * Build coaching context to prepend to the session.
 * Loads past session summaries and pending action items.
 */
async function buildCoachingContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  userId: Id<"users">,
  coachProfileId: Id<"lifeos_coachingProfiles">,
  _currentSessionId: Id<"lifeos_coachingSessions">,
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
