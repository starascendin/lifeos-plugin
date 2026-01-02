/**
 * Voice Agent internal queries for project management
 * Used by LiveKit voice agent via HTTP endpoint
 */

import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Priority order for sorting
const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

/**
 * Get today's tasks for a user
 * Returns tasks due today + top priority tasks, deduplicated
 * Optimized for voice responses (simplified format)
 */
export const getTodaysTasksInternal = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;

    // Get today's date range
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    // Get all issues for the user
    const allIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter: tasks due today OR marked as top priority
    // Exclude done/cancelled
    const relevantTasks = allIssues.filter((issue) => {
      if (issue.status === "done" || issue.status === "cancelled") return false;

      const isDueToday = issue.dueDate && issue.dueDate >= startOfDay && issue.dueDate <= endOfDay;
      const isTopPriority = issue.isTopPriority === true;

      return isDueToday || isTopPriority;
    });

    // Sort by: top priority first, then by priority level, then by sortOrder
    const sortedTasks = relevantTasks.sort((a, b) => {
      // Top priority items first
      if (a.isTopPriority && !b.isTopPriority) return -1;
      if (!a.isTopPriority && b.isTopPriority) return 1;

      // Then by priority level
      const priorityDiff =
        PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] -
        PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by sort order
      return a.sortOrder - b.sortOrder;
    });

    // Build simplified response for voice
    const tasks = sortedTasks.map((task) => ({
      identifier: task.identifier,
      title: task.title,
      status: task.status,
      priority: task.priority,
      isTopPriority: task.isTopPriority || false,
      dueToday: task.dueDate ? task.dueDate >= startOfDay && task.dueDate <= endOfDay : false,
    }));

    // Build summary
    const statusCounts: Record<string, number> = {};
    for (const task of tasks) {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    }

    return {
      tasks,
      summary: {
        total: tasks.length,
        topPriority: tasks.filter((t) => t.isTopPriority).length,
        dueToday: tasks.filter((t) => t.dueToday).length,
        byStatus: statusCounts,
      },
      generatedAt: new Date().toISOString(),
    };
  },
});
