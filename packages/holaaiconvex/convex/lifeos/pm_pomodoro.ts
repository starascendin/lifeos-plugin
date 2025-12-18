import { v } from "convex/values";
import { mutation, query, MutationCtx } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc, Id } from "../_generated/dataModel";
import { pomodoroStatusValidator } from "./pm_schema";

// ==================== TYPES ====================

type PomodoroStatus = "active" | "paused" | "completed" | "abandoned";

// ==================== QUERIES ====================

/**
 * Get the user's currently active pomodoro (only 1 allowed at a time)
 */
export const getActivePomodoro = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // Check for active pomodoro
    const active = await ctx.db
      .query("lifeos_pmPomodoroSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .first();

    if (active) return active;

    // Also check for paused pomodoro
    const paused = await ctx.db
      .query("lifeos_pmPomodoroSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "paused")
      )
      .first();

    return paused ?? null;
  },
});

/**
 * Get active pomodoro with issue details
 */
export const getActivePomodoroWithIssue = query({
  args: {},
  handler: async (ctx) => {
    console.log("[pm_pomodoro] getActivePomodoroWithIssue called");
    const user = await requireUser(ctx);
    console.log("[pm_pomodoro] User found:", user._id);

    // Check for active pomodoro
    let session = await ctx.db
      .query("lifeos_pmPomodoroSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .first();

    // Also check for paused pomodoro
    if (!session) {
      session = await ctx.db
        .query("lifeos_pmPomodoroSessions")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", user._id).eq("status", "paused")
        )
        .first();
    }

    if (!session) {
      console.log("[pm_pomodoro] No active session found, returning null");
      return null;
    }

    console.log("[pm_pomodoro] Found session:", session._id, "status:", session.status);
    const issue = session.issueId ? await ctx.db.get(session.issueId) : null;
    const project = session.projectId
      ? await ctx.db.get(session.projectId)
      : null;

    console.log("[pm_pomodoro] Returning session with issue:", issue?._id);
    return { session, issue, project };
  },
});

/**
 * Get today's pomodoro stats
 */
export const getTodayStats = query({
  args: {},
  handler: async (ctx) => {
    console.log("[pm_pomodoro] getTodayStats called");
    const user = await requireUser(ctx);
    console.log("[pm_pomodoro] getTodayStats - User found:", user._id);
    const today = new Date().toISOString().split("T")[0];

    return await ctx.db
      .query("lifeos_pmPomodoroDailyStats")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", today)
      )
      .unique();
  },
});

/**
 * Get daily stats for a date range
 */
export const getDailyStats = query({
  args: {
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const stats = await ctx.db
      .query("lifeos_pmPomodoroDailyStats")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Filter by date range
    return stats.filter(
      (s) => s.date >= args.startDate && s.date <= args.endDate
    );
  },
});

/**
 * Get pomodoro history for an issue
 */
export const getIssuePomodoroHistory = query({
  args: {
    issueId: v.id("lifeos_pmIssues"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const sessions = await ctx.db
      .query("lifeos_pmPomodoroSessions")
      .withIndex("by_issue", (q) => q.eq("issueId", args.issueId))
      .order("desc")
      .take(50);

    return sessions.filter((s) => s.userId === user._id);
  },
});

/**
 * Get recent pomodoro sessions
 */
export const getRecentSessions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 20;

    const sessions = await ctx.db
      .query("lifeos_pmPomodoroSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    // Enrich with issue data
    const enriched = await Promise.all(
      sessions.map(async (session) => {
        const issue = session.issueId
          ? await ctx.db.get(session.issueId)
          : null;
        return { ...session, issue };
      })
    );

    return enriched;
  },
});

// ==================== MUTATIONS ====================

/**
 * Start a new pomodoro
 */
export const startPomodoro = mutation({
  args: {
    issueId: v.optional(v.id("lifeos_pmIssues")),
    durationMinutes: v.optional(v.number()),
    breakMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    console.log("[pm_pomodoro] startPomodoro called with:", args);
    const user = await requireUser(ctx);
    console.log("[pm_pomodoro] startPomodoro - User:", user._id);
    const now = Date.now();

    // Check for existing active pomodoro
    const existingActive = await ctx.db
      .query("lifeos_pmPomodoroSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .first();

    if (existingActive) {
      throw new Error(
        "A pomodoro is already active. Complete or abandon it first."
      );
    }

    // Also check for paused pomodoro
    const existingPaused = await ctx.db
      .query("lifeos_pmPomodoroSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "paused")
      )
      .first();

    if (existingPaused) {
      throw new Error("A paused pomodoro exists. Resume or abandon it first.");
    }

    // Get project ID if issue provided
    let projectId: Id<"lifeos_pmProjects"> | undefined;
    if (args.issueId) {
      const issue = await ctx.db.get(args.issueId);
      if (issue && issue.userId === user._id) {
        projectId = issue.projectId;
      } else if (issue && issue.userId !== user._id) {
        throw new Error("Issue not found or access denied");
      }
    }

    const sessionId = await ctx.db.insert("lifeos_pmPomodoroSessions", {
      userId: user._id,
      issueId: args.issueId,
      projectId,
      durationMinutes: args.durationMinutes ?? 25,
      breakMinutes: args.breakMinutes ?? 5,
      status: "active",
      startedAt: now,
      totalPausedMs: 0,
      createdAt: now,
      updatedAt: now,
    });

    console.log("[pm_pomodoro] Created session:", sessionId, "for user:", user._id);
    return sessionId;
  },
});

/**
 * Pause the active pomodoro
 */
export const pausePomodoro = mutation({
  args: {
    sessionId: v.id("lifeos_pmPomodoroSessions"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found or access denied");
    }

    if (session.status !== "active") {
      throw new Error("Can only pause an active pomodoro");
    }

    await ctx.db.patch(args.sessionId, {
      status: "paused",
      pausedAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Resume a paused pomodoro
 */
export const resumePomodoro = mutation({
  args: {
    sessionId: v.id("lifeos_pmPomodoroSessions"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found or access denied");
    }

    if (session.status !== "paused") {
      throw new Error("Can only resume a paused pomodoro");
    }

    // Calculate additional paused time
    const additionalPausedMs = session.pausedAt ? now - session.pausedAt : 0;

    await ctx.db.patch(args.sessionId, {
      status: "active",
      pausedAt: undefined,
      totalPausedMs: session.totalPausedMs + additionalPausedMs,
      updatedAt: now,
    });
  },
});

/**
 * Complete a pomodoro (called when timer finishes)
 */
export const completePomodoro = mutation({
  args: {
    sessionId: v.id("lifeos_pmPomodoroSessions"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found or access denied");
    }

    if (session.status === "completed" || session.status === "abandoned") {
      throw new Error("Session already ended");
    }

    // Calculate actual focus time
    let actualFocusTimeMs: number;
    if (session.status === "active") {
      actualFocusTimeMs = now - session.startedAt - session.totalPausedMs;
    } else if (session.status === "paused" && session.pausedAt) {
      actualFocusTimeMs =
        session.pausedAt - session.startedAt - session.totalPausedMs;
    } else {
      actualFocusTimeMs = 0;
    }

    await ctx.db.patch(args.sessionId, {
      status: "completed",
      completedAt: now,
      updatedAt: now,
    });

    // Update daily stats
    await updateDailyStats(ctx, user._id, session, "completed", actualFocusTimeMs);

    return { actualFocusTimeMs };
  },
});

/**
 * Abandon a pomodoro
 */
export const abandonPomodoro = mutation({
  args: {
    sessionId: v.id("lifeos_pmPomodoroSessions"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found or access denied");
    }

    if (session.status === "completed" || session.status === "abandoned") {
      throw new Error("Session already ended");
    }

    // Calculate focus time before abandon
    let actualFocusTimeMs: number;
    if (session.status === "active") {
      actualFocusTimeMs = now - session.startedAt - session.totalPausedMs;
    } else if (session.status === "paused" && session.pausedAt) {
      actualFocusTimeMs =
        session.pausedAt - session.startedAt - session.totalPausedMs;
    } else {
      actualFocusTimeMs = 0;
    }

    await ctx.db.patch(args.sessionId, {
      status: "abandoned",
      completedAt: now,
      updatedAt: now,
    });

    // Update daily stats
    await updateDailyStats(ctx, user._id, session, "abandoned", actualFocusTimeMs);

    return { actualFocusTimeMs };
  },
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Update daily stats when a pomodoro ends
 */
async function updateDailyStats(
  ctx: MutationCtx,
  userId: Id<"users">,
  session: Doc<"lifeos_pmPomodoroSessions">,
  outcome: "completed" | "abandoned",
  focusTimeMs: number
) {
  const date = new Date(session.startedAt).toISOString().split("T")[0];
  const now = Date.now();

  const existing = await ctx.db
    .query("lifeos_pmPomodoroDailyStats")
    .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
    .unique();

  if (existing) {
    // Update existing stats
    const issueBreakdown = [...existing.issueBreakdown];

    if (session.issueId) {
      const issue = await ctx.db.get(session.issueId);
      const idx = issueBreakdown.findIndex(
        (i) => i.issueId === session.issueId
      );

      if (idx >= 0) {
        issueBreakdown[idx] = {
          ...issueBreakdown[idx],
          completedCount:
            issueBreakdown[idx].completedCount +
            (outcome === "completed" ? 1 : 0),
          totalFocusTimeMs: issueBreakdown[idx].totalFocusTimeMs + focusTimeMs,
        };
      } else if (issue) {
        issueBreakdown.push({
          issueId: session.issueId,
          issueIdentifier: issue.identifier,
          issueTitle: issue.title,
          completedCount: outcome === "completed" ? 1 : 0,
          totalFocusTimeMs: focusTimeMs,
        });
      }
    }

    await ctx.db.patch(existing._id, {
      completedCount:
        existing.completedCount + (outcome === "completed" ? 1 : 0),
      abandonedCount:
        existing.abandonedCount + (outcome === "abandoned" ? 1 : 0),
      totalFocusTimeMs: existing.totalFocusTimeMs + focusTimeMs,
      issueBreakdown,
      updatedAt: now,
    });
  } else {
    // Create new stats
    const issueBreakdown: Doc<"lifeos_pmPomodoroDailyStats">["issueBreakdown"] =
      [];

    if (session.issueId) {
      const issue = await ctx.db.get(session.issueId);
      if (issue) {
        issueBreakdown.push({
          issueId: session.issueId,
          issueIdentifier: issue.identifier,
          issueTitle: issue.title,
          completedCount: outcome === "completed" ? 1 : 0,
          totalFocusTimeMs: focusTimeMs,
        });
      }
    }

    await ctx.db.insert("lifeos_pmPomodoroDailyStats", {
      userId,
      date,
      completedCount: outcome === "completed" ? 1 : 0,
      abandonedCount: outcome === "abandoned" ? 1 : 0,
      totalFocusTimeMs: focusTimeMs,
      issueBreakdown,
      createdAt: now,
      updatedAt: now,
    });
  }
}
