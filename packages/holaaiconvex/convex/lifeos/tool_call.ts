/**
 * Tool Call API - Internal queries for external tool integrations
 * Used by LiveKit voice agents and other external services via HTTP endpoint
 *
 * Available tools:
 * - get_todays_tasks: Get today's tasks (due today + top priority)
 * - get_projects: Get user's projects with summary stats
 * - get_tasks: Get tasks with optional filters
 */

import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// ==================== TOOL DEFINITIONS ====================

/**
 * Tool registry - defines available tools and their parameters
 * Used for validation and documentation
 */
export const TOOL_DEFINITIONS = {
  get_todays_tasks: {
    description: "Get today's tasks including top priority items",
    params: {},
  },
  get_projects: {
    description: "Get user's projects with issue counts and completion stats",
    params: {
      status: "optional - filter by status (planned, in_progress, paused, completed, cancelled)",
      includeArchived: "optional - include archived projects (default false)",
    },
  },
  get_tasks: {
    description: "Get tasks with optional filters",
    params: {
      projectId: "optional - filter by project ID",
      status: "optional - filter by status (backlog, todo, in_progress, in_review, done, cancelled)",
      priority: "optional - filter by priority (urgent, high, medium, low, none)",
      limit: "optional - max results (default 50, max 100)",
    },
  },
} as const;

export type ToolName = keyof typeof TOOL_DEFINITIONS;

// Priority order for sorting
const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

// ==================== TOOL 1: GET TODAY'S TASKS ====================

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

// ==================== TOOL 2: GET PROJECTS ====================

/**
 * Get user's projects with stats
 * Returns projects with issue counts and completion percentage
 */
export const getProjectsInternal = internalQuery({
  args: {
    userId: v.string(),
    status: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const includeArchived = args.includeArchived ?? false;

    // Get all projects for the user
    let projects = await ctx.db
      .query("lifeos_pmProjects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Filter by archived status
    if (!includeArchived) {
      projects = projects.filter((p) => !p.archivedAt);
    }

    // Filter by status if provided
    if (args.status) {
      projects = projects.filter((p) => p.status === args.status);
    }

    // Build response with stats
    const projectsWithStats = projects.map((project) => {
      const issueCount = project.issueCount ?? 0;
      const completedIssueCount = project.completedIssueCount ?? 0;
      const completionPercentage =
        issueCount > 0 ? Math.round((completedIssueCount / issueCount) * 100) : 0;

      return {
        id: project._id,
        key: project.key,
        name: project.name,
        description: project.description,
        status: project.status,
        health: project.health,
        priority: project.priority,
        issueCount,
        completedIssueCount,
        completionPercentage,
      };
    });

    // Build summary
    const statusCounts: Record<string, number> = {};
    for (const project of projectsWithStats) {
      statusCounts[project.status] = (statusCounts[project.status] || 0) + 1;
    }

    return {
      projects: projectsWithStats,
      summary: {
        total: projectsWithStats.length,
        byStatus: statusCounts,
      },
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== TOOL 3: GET TASKS ====================

/**
 * Get tasks with optional filters
 * Returns tasks with project info and pagination
 */
export const getTasksInternal = internalQuery({
  args: {
    userId: v.string(),
    projectId: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const limit = Math.min(args.limit ?? 50, 100); // Cap at 100

    // Type guard for status
    type IssueStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled";
    const validStatuses: IssueStatus[] = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"];
    const status = args.status && validStatuses.includes(args.status as IssueStatus)
      ? (args.status as IssueStatus)
      : undefined;

    // Get issues based on filters
    let issues;

    if (args.projectId) {
      const projectId = args.projectId as Id<"lifeos_pmProjects">;
      if (status) {
        issues = await ctx.db
          .query("lifeos_pmIssues")
          .withIndex("by_project_status", (q) =>
            q.eq("projectId", projectId).eq("status", status)
          )
          .collect();
      } else {
        issues = await ctx.db
          .query("lifeos_pmIssues")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .collect();
      }
      // Filter by user ownership
      issues = issues.filter((i) => i.userId === userId);
    } else if (status) {
      issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_status", (q) => q.eq("userId", userId).eq("status", status))
        .collect();
    } else {
      issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect();
    }

    // Filter by priority if specified
    if (args.priority) {
      issues = issues.filter((i) => i.priority === args.priority);
    }

    // Sort by priority then sortOrder
    issues.sort((a, b) => {
      const priorityDiff =
        PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] -
        PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER];
      if (priorityDiff !== 0) return priorityDiff;
      return a.sortOrder - b.sortOrder;
    });

    // Check if there are more results
    const total = issues.length;
    const hasMore = total > limit;

    // Apply limit
    const limitedIssues = issues.slice(0, limit);

    // Get project info for each issue (filter out undefined projectIds)
    const projectIds = [...new Set(limitedIssues.map((i) => i.projectId).filter((id): id is Id<"lifeos_pmProjects"> => id !== undefined))];
    const projects = await Promise.all(projectIds.map((id) => ctx.db.get(id)));
    const projectMap = new Map(projects.filter(Boolean).map((p) => [p!._id, p!]));

    // Build response
    const tasks = limitedIssues.map((issue) => {
      const project = issue.projectId ? projectMap.get(issue.projectId) : undefined;
      return {
        id: issue._id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        priority: issue.priority,
        projectId: issue.projectId,
        projectKey: project?.key ?? "",
        projectName: project?.name ?? "",
        isTopPriority: issue.isTopPriority || false,
        dueDate: issue.dueDate,
        estimate: issue.estimate,
      };
    });

    return {
      tasks,
      total,
      hasMore,
      generatedAt: new Date().toISOString(),
    };
  },
});
