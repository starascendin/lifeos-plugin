import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Id } from "../_generated/dataModel";

// ==================== QUERIES ====================

/**
 * Get all snapshots for a cycle (for burnup chart)
 */
export const getCycleSnapshots = query({
  args: {
    cycleId: v.id("lifeos_pmCycles"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify user owns the cycle
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.userId !== user._id) {
      return [];
    }

    const snapshots = await ctx.db
      .query("lifeos_pmCycleSnapshots")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();

    // Sort by date ascending
    return snapshots.sort((a, b) => a.date.localeCompare(b.date));
  },
});

/**
 * Get current real-time stats for a cycle
 */
export const getCycleStats = query({
  args: {
    cycleId: v.id("lifeos_pmCycles"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.userId !== user._id) {
      return null;
    }

    // Get all issues in this cycle
    const issues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();

    // Calculate counts by status
    const scopeCount = issues.length;
    const startedCount = issues.filter(
      (i) => i.status === "in_progress" || i.status === "in_review"
    ).length;
    const completedCount = issues.filter((i) => i.status === "done").length;
    const todoCount = issues.filter(
      (i) => i.status === "backlog" || i.status === "todo"
    ).length;

    // Calculate weekdays remaining
    const now = new Date();
    const endDate = new Date(cycle.endDate);
    let weekdaysLeft = 0;
    const current = new Date(now);
    current.setHours(0, 0, 0, 0);

    while (current <= endDate) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) weekdaysLeft++;
      current.setDate(current.getDate() + 1);
    }

    // Calculate capacity percentage (completed / scope)
    const capacityPercent =
      scopeCount > 0 ? Math.round((completedCount / scopeCount) * 100) : 0;

    // Calculate started percentage
    const startedPercent =
      scopeCount > 0 ? Math.round((startedCount / scopeCount) * 100) : 0;

    return {
      scopeCount,
      startedCount,
      completedCount,
      todoCount,
      weekdaysLeft,
      capacityPercent,
      startedPercent,
      completedPercent: capacityPercent,
    };
  },
});

// ==================== MUTATIONS ====================

/**
 * Record a snapshot for a cycle (can be called manually or by cron)
 */
export const recordSnapshot = mutation({
  args: {
    cycleId: v.id("lifeos_pmCycles"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.userId !== user._id) {
      throw new Error("Cycle not found or access denied");
    }

    // Get current date string
    const today = new Date().toISOString().split("T")[0];

    // Check if snapshot already exists for today
    const existing = await ctx.db
      .query("lifeos_pmCycleSnapshots")
      .withIndex("by_cycle_date", (q) =>
        q.eq("cycleId", args.cycleId).eq("date", today)
      )
      .first();

    // Get all issues in this cycle
    const issues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();

    const scopeCount = issues.length;
    const startedCount = issues.filter(
      (i) => i.status === "in_progress" || i.status === "in_review"
    ).length;
    const completedCount = issues.filter((i) => i.status === "done").length;

    if (existing) {
      // Update existing snapshot
      await ctx.db.patch(existing._id, {
        scopeCount,
        startedCount,
        completedCount,
      });
      return existing._id;
    } else {
      // Create new snapshot
      const snapshotId = await ctx.db.insert("lifeos_pmCycleSnapshots", {
        userId: user._id,
        cycleId: args.cycleId,
        date: today,
        scopeCount,
        startedCount,
        completedCount,
        createdAt: now,
      });
      return snapshotId;
    }
  },
});

/**
 * Internal mutation to record snapshot (called by cron)
 */
export const _recordSnapshotInternal = internalMutation({
  args: {
    userId: v.id("users"),
    cycleId: v.id("lifeos_pmCycles"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const today = new Date().toISOString().split("T")[0];

    // Check if snapshot already exists for today
    const existing = await ctx.db
      .query("lifeos_pmCycleSnapshots")
      .withIndex("by_cycle_date", (q) =>
        q.eq("cycleId", args.cycleId).eq("date", today)
      )
      .first();

    // Get all issues in this cycle
    const issues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();

    const scopeCount = issues.length;
    const startedCount = issues.filter(
      (i) => i.status === "in_progress" || i.status === "in_review"
    ).length;
    const completedCount = issues.filter((i) => i.status === "done").length;

    if (existing) {
      await ctx.db.patch(existing._id, {
        scopeCount,
        startedCount,
        completedCount,
      });
    } else {
      await ctx.db.insert("lifeos_pmCycleSnapshots", {
        userId: args.userId,
        cycleId: args.cycleId,
        date: today,
        scopeCount,
        startedCount,
        completedCount,
        createdAt: now,
      });
    }
  },
});

/**
 * Get all active cycles for snapshot recording (internal, for cron)
 */
export const _getActiveCyclesForSnapshot = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all active cycles
    const activeCycles = await ctx.db
      .query("lifeos_pmCycles")
      .collect();

    // Filter to only active cycles
    return activeCycles
      .filter((c) => c.status === "active")
      .map((c) => ({ cycleId: c._id, userId: c.userId }));
  },
});

/**
 * Backfill snapshots for a cycle (creates historical data from issue timestamps)
 */
export const backfillSnapshots = mutation({
  args: {
    cycleId: v.id("lifeos_pmCycles"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.userId !== user._id) {
      throw new Error("Cycle not found or access denied");
    }

    // Get all issues in this cycle
    const issues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();

    // Generate date range from cycle start to today (or cycle end if completed)
    const startDate = new Date(cycle.startDate);
    const endDate = cycle.status === "completed"
      ? new Date(cycle.endDate)
      : new Date();

    const dates: string[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    while (current <= endDate) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }

    // For each date, calculate what the counts would have been
    let snapshotsCreated = 0;
    for (const date of dates) {
      const dateTime = new Date(date).getTime();
      const dateEndTime = dateTime + 24 * 60 * 60 * 1000;

      // Check if snapshot already exists
      const existing = await ctx.db
        .query("lifeos_pmCycleSnapshots")
        .withIndex("by_cycle_date", (q) =>
          q.eq("cycleId", args.cycleId).eq("date", date)
        )
        .first();

      if (existing) continue;

      // Calculate counts as of this date
      // Scope: issues created before or on this date
      const scopeCount = issues.filter((i) => i.createdAt <= dateEndTime).length;

      // Completed: issues completed before or on this date
      const completedCount = issues.filter(
        (i) => i.completedAt && i.completedAt <= dateEndTime
      ).length;

      // Started: this is harder to track historically without status change history
      // For now, estimate based on current status of issues that existed at this time
      const existingIssues = issues.filter((i) => i.createdAt <= dateEndTime);
      const startedCount = existingIssues.filter(
        (i) =>
          (i.status === "in_progress" || i.status === "in_review") &&
          (!i.completedAt || i.completedAt > dateEndTime)
      ).length;

      await ctx.db.insert("lifeos_pmCycleSnapshots", {
        userId: user._id,
        cycleId: args.cycleId,
        date,
        scopeCount,
        startedCount,
        completedCount,
        createdAt: now,
      });
      snapshotsCreated++;
    }

    return { snapshotsCreated, totalDates: dates.length };
  },
});
