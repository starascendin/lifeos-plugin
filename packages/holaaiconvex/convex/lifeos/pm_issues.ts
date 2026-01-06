import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc, Id } from "../_generated/dataModel";
import { priorityValidator, issueStatusValidator } from "./pm_schema";

// ==================== TYPES ====================

type IssueStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "cancelled";

// ==================== QUERIES ====================

/**
 * Get all issues for the authenticated user with filters
 */
export const getIssues = query({
  args: {
    projectId: v.optional(v.id("lifeos_pmProjects")),
    cycleId: v.optional(v.id("lifeos_pmCycles")),
    status: v.optional(issueStatusValidator),
    priority: v.optional(priorityValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 100;

    let issues;

    if (args.projectId && args.status) {
      issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_project_status", (q) =>
          q.eq("projectId", args.projectId).eq("status", args.status!)
        )
        .take(limit);
    } else if (args.projectId) {
      issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .take(limit);
    } else if (args.cycleId) {
      issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
        .take(limit);
    } else if (args.status) {
      issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!)
        )
        .take(limit);
    } else {
      issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(limit);
    }

    // Filter by user ownership and priority if specified
    let filteredIssues = issues.filter((i) => i.userId === user._id);
    if (args.priority) {
      filteredIssues = filteredIssues.filter(
        (i) => i.priority === args.priority
      );
    }

    // Sort by sortOrder within each status
    return filteredIssues.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/**
 * Get issues grouped by status (for Kanban board)
 */
export const getIssuesByStatus = query({
  args: {
    projectId: v.optional(v.id("lifeos_pmProjects")),
    cycleId: v.optional(v.id("lifeos_pmCycles")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    let issues;
    if (args.projectId) {
      issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
      issues = issues.filter((i) => i.userId === user._id);
    } else if (args.cycleId) {
      issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
        .collect();
      issues = issues.filter((i) => i.userId === user._id);
    } else {
      issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
    }

    // Group by status
    const statuses: IssueStatus[] = [
      "backlog",
      "todo",
      "in_progress",
      "in_review",
      "done",
      "cancelled",
    ];

    const grouped: Record<IssueStatus, Doc<"lifeos_pmIssues">[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
      cancelled: [],
    };

    for (const issue of issues) {
      grouped[issue.status as IssueStatus].push(issue);
    }

    // Sort each group by sortOrder
    for (const status of statuses) {
      grouped[status].sort((a, b) => a.sortOrder - b.sortOrder);
    }

    return grouped;
  },
});

/**
 * Get a single issue by ID
 */
export const getIssue = query({
  args: {
    issueId: v.id("lifeos_pmIssues"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.userId !== user._id) {
      return null;
    }

    return issue;
  },
});

/**
 * Get issue by identifier (e.g., "PROJ-123")
 */
export const getIssueByIdentifier = query({
  args: {
    identifier: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_identifier", (q) =>
        q.eq("userId", user._id).eq("identifier", args.identifier.toUpperCase())
      )
      .first();
  },
});

/**
 * Get sub-issues for a parent issue
 */
export const getSubIssues = query({
  args: {
    parentId: v.id("lifeos_pmIssues"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const subIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();

    return subIssues
      .filter((i) => i.userId === user._id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/**
 * Get issue with related data (labels, project, cycle)
 */
export const getIssueWithRelations = query({
  args: {
    issueId: v.id("lifeos_pmIssues"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.userId !== user._id) {
      return null;
    }

    // Get related data
    const [project, cycle, labels] = await Promise.all([
      issue.projectId ? ctx.db.get(issue.projectId) : null,
      issue.cycleId ? ctx.db.get(issue.cycleId) : null,
      Promise.all(issue.labelIds.map((id) => ctx.db.get(id))),
    ]);

    // Get sub-issues count
    const subIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_parent", (q) => q.eq("parentId", args.issueId))
      .collect();

    return {
      ...issue,
      project,
      cycle,
      labels: labels.filter(Boolean),
      subIssueCount: subIssues.length,
      completedSubIssueCount: subIssues.filter((i) => i.status === "done")
        .length,
    };
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new issue
 */
export const createIssue = mutation({
  args: {
    projectId: v.optional(v.id("lifeos_pmProjects")),
    cycleId: v.optional(v.id("lifeos_pmCycles")),
    parentId: v.optional(v.id("lifeos_pmIssues")),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(issueStatusValidator),
    priority: v.optional(priorityValidator),
    estimate: v.optional(v.number()),
    labelIds: v.optional(v.array(v.id("lifeos_pmLabels"))),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    let identifier: string;
    let number: number;

    if (args.projectId) {
      // Get the project to generate identifier
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId !== user._id) {
        throw new Error("Project not found or access denied");
      }

      number = project.nextIssueNumber;
      identifier = `${project.key}-${number}`;

      // Increment project's next issue number
      await ctx.db.patch(args.projectId, {
        nextIssueNumber: number + 1,
        issueCount: project.issueCount + 1,
        updatedAt: now,
      });
    } else {
      // No project - use a global counter
      const allIssues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      number = allIssues.length + 1;
      identifier = `ISS-${number}`;
    }

    // If cycleId provided, verify and update counts
    if (args.cycleId) {
      const cycle = await ctx.db.get(args.cycleId);
      if (!cycle || cycle.userId !== user._id) {
        throw new Error("Cycle not found or access denied");
      }
      await ctx.db.patch(args.cycleId, {
        issueCount: cycle.issueCount + 1,
        updatedAt: now,
      });
    }

    // Calculate sort order (add to bottom of the column)
    const status = args.status ?? "backlog";
    const existingInStatus = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_status", (q) => q.eq("userId", user._id).eq("status", status))
      .collect();

    const maxSortOrder = existingInStatus.reduce(
      (max, i) => Math.max(max, i.sortOrder),
      0
    );

    const issueId = await ctx.db.insert("lifeos_pmIssues", {
      userId: user._id,
      projectId: args.projectId,
      cycleId: args.cycleId,
      parentId: args.parentId,
      identifier,
      number,
      title: args.title,
      description: args.description,
      status,
      priority: args.priority ?? "none",
      estimate: args.estimate,
      labelIds: args.labelIds ?? [],
      dueDate: args.dueDate,
      sortOrder: maxSortOrder + 1000, // Leave gaps for reordering
      createdAt: now,
      updatedAt: now,
    });

    return { issueId, identifier };
  },
});

/**
 * Update an issue
 */
export const updateIssue = mutation({
  args: {
    issueId: v.id("lifeos_pmIssues"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    estimate: v.optional(v.number()),
    labelIds: v.optional(v.array(v.id("lifeos_pmLabels"))),
    dueDate: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.userId !== user._id) {
      throw new Error("Issue not found or access denied");
    }

    const updates: Partial<Doc<"lifeos_pmIssues">> = {
      updatedAt: now,
    };

    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.estimate !== undefined) updates.estimate = args.estimate;
    if (args.labelIds !== undefined) updates.labelIds = args.labelIds;
    // Handle dueDate: null means clear, undefined means don't change
    if (args.dueDate !== undefined) {
      updates.dueDate = args.dueDate === null ? undefined : args.dueDate;
    }

    await ctx.db.patch(args.issueId, updates);
    return args.issueId;
  },
});

/**
 * Update issue status (for Kanban drag-drop)
 */
export const updateIssueStatus = mutation({
  args: {
    issueId: v.id("lifeos_pmIssues"),
    status: issueStatusValidator,
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.userId !== user._id) {
      throw new Error("Issue not found or access denied");
    }

    const oldStatus = issue.status;
    const newStatus = args.status;

    const updates: Partial<Doc<"lifeos_pmIssues">> = {
      status: newStatus,
      updatedAt: now,
    };

    if (args.sortOrder !== undefined) {
      updates.sortOrder = args.sortOrder;
    }

    // Track completion
    if (newStatus === "done" && oldStatus !== "done") {
      updates.completedAt = now;

      // Update project counts
      if (issue.projectId) {
        const project = await ctx.db.get(issue.projectId);
        if (project) {
          await ctx.db.patch(issue.projectId, {
            completedIssueCount: project.completedIssueCount + 1,
            updatedAt: now,
          });
        }
      }

      // Update cycle counts
      if (issue.cycleId) {
        const cycle = await ctx.db.get(issue.cycleId);
        if (cycle) {
          await ctx.db.patch(issue.cycleId, {
            completedIssueCount: cycle.completedIssueCount + 1,
            updatedAt: now,
          });
        }
      }
    } else if (oldStatus === "done" && newStatus !== "done") {
      updates.completedAt = undefined;

      // Update project counts
      if (issue.projectId) {
        const project = await ctx.db.get(issue.projectId);
        if (project && project.completedIssueCount > 0) {
          await ctx.db.patch(issue.projectId, {
            completedIssueCount: project.completedIssueCount - 1,
            updatedAt: now,
          });
        }
      }

      // Update cycle counts
      if (issue.cycleId) {
        const cycle = await ctx.db.get(issue.cycleId);
        if (cycle && cycle.completedIssueCount > 0) {
          await ctx.db.patch(issue.cycleId, {
            completedIssueCount: cycle.completedIssueCount - 1,
            updatedAt: now,
          });
        }
      }
    }

    await ctx.db.patch(args.issueId, updates);
    return args.issueId;
  },
});

/**
 * Reorder issues within a column (batch update sortOrder)
 */
export const reorderIssues = mutation({
  args: {
    updates: v.array(
      v.object({
        issueId: v.id("lifeos_pmIssues"),
        sortOrder: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    for (const update of args.updates) {
      const issue = await ctx.db.get(update.issueId);
      if (issue && issue.userId === user._id) {
        await ctx.db.patch(update.issueId, {
          sortOrder: update.sortOrder,
          updatedAt: now,
        });
      }
    }
  },
});

/**
 * Move issue to a different project
 */
export const moveIssueToProject = mutation({
  args: {
    issueId: v.id("lifeos_pmIssues"),
    projectId: v.optional(v.id("lifeos_pmProjects")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.userId !== user._id) {
      throw new Error("Issue not found or access denied");
    }

    const oldProjectId = issue.projectId;

    // Update old project counts
    if (oldProjectId) {
      const oldProject = await ctx.db.get(oldProjectId);
      if (oldProject) {
        await ctx.db.patch(oldProjectId, {
          issueCount: Math.max(0, oldProject.issueCount - 1),
          completedIssueCount:
            issue.status === "done"
              ? Math.max(0, oldProject.completedIssueCount - 1)
              : oldProject.completedIssueCount,
          updatedAt: now,
        });
      }
    }

    let newIdentifier = issue.identifier;

    // Update new project counts and generate new identifier
    if (args.projectId) {
      const newProject = await ctx.db.get(args.projectId);
      if (!newProject || newProject.userId !== user._id) {
        throw new Error("Target project not found or access denied");
      }

      const newNumber = newProject.nextIssueNumber;
      newIdentifier = `${newProject.key}-${newNumber}`;

      await ctx.db.patch(args.projectId, {
        issueCount: newProject.issueCount + 1,
        completedIssueCount:
          issue.status === "done"
            ? newProject.completedIssueCount + 1
            : newProject.completedIssueCount,
        nextIssueNumber: newNumber + 1,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.issueId, {
      projectId: args.projectId,
      identifier: newIdentifier,
      updatedAt: now,
    });

    return { newIdentifier };
  },
});

/**
 * Assign issue to a cycle
 */
export const moveIssueToCycle = mutation({
  args: {
    issueId: v.id("lifeos_pmIssues"),
    cycleId: v.optional(v.id("lifeos_pmCycles")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.userId !== user._id) {
      throw new Error("Issue not found or access denied");
    }

    const oldCycleId = issue.cycleId;

    // Update old cycle counts
    if (oldCycleId) {
      const oldCycle = await ctx.db.get(oldCycleId);
      if (oldCycle) {
        await ctx.db.patch(oldCycleId, {
          issueCount: Math.max(0, oldCycle.issueCount - 1),
          completedIssueCount:
            issue.status === "done"
              ? Math.max(0, oldCycle.completedIssueCount - 1)
              : oldCycle.completedIssueCount,
          updatedAt: now,
        });
      }
    }

    // Update new cycle counts
    if (args.cycleId) {
      const newCycle = await ctx.db.get(args.cycleId);
      if (!newCycle || newCycle.userId !== user._id) {
        throw new Error("Target cycle not found or access denied");
      }

      await ctx.db.patch(args.cycleId, {
        issueCount: newCycle.issueCount + 1,
        completedIssueCount:
          issue.status === "done"
            ? newCycle.completedIssueCount + 1
            : newCycle.completedIssueCount,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.issueId, {
      cycleId: args.cycleId,
      updatedAt: now,
    });
  },
});

/**
 * Delete an issue
 */
export const deleteIssue = mutation({
  args: {
    issueId: v.id("lifeos_pmIssues"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.userId !== user._id) {
      throw new Error("Issue not found or access denied");
    }

    // Delete sub-issues first
    const subIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_parent", (q) => q.eq("parentId", args.issueId))
      .collect();

    for (const subIssue of subIssues) {
      await ctx.db.delete(subIssue._id);
    }

    // Update project counts
    if (issue.projectId) {
      const project = await ctx.db.get(issue.projectId);
      if (project) {
        await ctx.db.patch(issue.projectId, {
          issueCount: Math.max(0, project.issueCount - 1 - subIssues.length),
          completedIssueCount: Math.max(
            0,
            project.completedIssueCount -
              (issue.status === "done" ? 1 : 0) -
              subIssues.filter((i) => i.status === "done").length
          ),
          updatedAt: now,
        });
      }
    }

    // Update cycle counts
    if (issue.cycleId) {
      const cycle = await ctx.db.get(issue.cycleId);
      if (cycle) {
        await ctx.db.patch(issue.cycleId, {
          issueCount: Math.max(0, cycle.issueCount - 1),
          completedIssueCount:
            issue.status === "done"
              ? Math.max(0, cycle.completedIssueCount - 1)
              : cycle.completedIssueCount,
          updatedAt: now,
        });
      }
    }

    // Delete the issue
    await ctx.db.delete(args.issueId);
  },
});

/**
 * Bulk update issues (e.g., move multiple to a cycle)
 */
export const bulkUpdateIssues = mutation({
  args: {
    issueIds: v.array(v.id("lifeos_pmIssues")),
    status: v.optional(issueStatusValidator),
    priority: v.optional(priorityValidator),
    cycleId: v.optional(v.id("lifeos_pmCycles")),
    labelIds: v.optional(v.array(v.id("lifeos_pmLabels"))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    for (const issueId of args.issueIds) {
      const issue = await ctx.db.get(issueId);
      if (!issue || issue.userId !== user._id) continue;

      const updates: Partial<Doc<"lifeos_pmIssues">> = {
        updatedAt: now,
      };

      if (args.status !== undefined) updates.status = args.status;
      if (args.priority !== undefined) updates.priority = args.priority;
      if (args.cycleId !== undefined) updates.cycleId = args.cycleId;
      if (args.labelIds !== undefined) updates.labelIds = args.labelIds;

      await ctx.db.patch(issueId, updates);
    }

    return { updatedCount: args.issueIds.length };
  },
});

// ==================== DAILY AGENDA QUERIES ====================

/**
 * Get tasks due on a specific date (for Daily Agenda view)
 * Returns tasks with dueDate matching the given date
 * By default excludes done/cancelled, use includeCompleted=true for completed tasks
 */
export const getTasksForDate = query({
  args: {
    date: v.string(), // YYYY-MM-DD format
    includeCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Parse the date to get start and end timestamps for the day
    const startOfDay = new Date(args.date).setHours(0, 0, 0, 0);
    const endOfDay = new Date(args.date).setHours(23, 59, 59, 999);

    // Get all issues for the user
    const allIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Filter by due date
    const tasksForDate = allIssues.filter((issue) => {
      if (!issue.dueDate) return false;
      // Always exclude cancelled
      if (issue.status === "cancelled") return false;
      // Exclude done unless includeCompleted is true
      if (!args.includeCompleted && issue.status === "done") return false;
      return issue.dueDate >= startOfDay && issue.dueDate <= endOfDay;
    });

    // Sort by priority (urgent first) then by sortOrder
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
    return tasksForDate.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.sortOrder - b.sortOrder;
    });
  },
});

/**
 * Get overdue tasks (past due date, not completed/cancelled)
 * Returns tasks with dueDate before the start of the given date
 */
export const getOverdueTasks = query({
  args: {
    date: v.string(), // YYYY-MM-DD format
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Get start of the given date (anything before this is overdue)
    const startOfDay = new Date(args.date).setHours(0, 0, 0, 0);

    // Get all issues for the user
    const allIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Filter: dueDate < startOfDay AND not done/cancelled
    const overdueTasks = allIssues.filter((issue) => {
      if (!issue.dueDate) return false;
      if (issue.status === "done" || issue.status === "cancelled") return false;
      return issue.dueDate < startOfDay;
    });

    // Sort by due date (oldest first) then priority
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
    return overdueTasks.sort((a, b) => {
      const dateDiff = (a.dueDate ?? 0) - (b.dueDate ?? 0);
      if (dateDiff !== 0) return dateDiff;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  },
});

/**
 * Get top priority tasks (marked for "Top 3" in Daily Agenda)
 * Returns active tasks with isTopPriority=true
 */
export const getTopPriorityTasks = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const allIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_user_top_priority", (q) =>
        q.eq("userId", user._id).eq("isTopPriority", true)
      )
      .collect();

    // Exclude completed/cancelled
    const activeTasks = allIssues.filter(
      (issue) => issue.status !== "done" && issue.status !== "cancelled"
    );

    // Sort by priority then sortOrder
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
    return activeTasks.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.sortOrder - b.sortOrder;
    });
  },
});

/**
 * Get tasks for a date range (used by Week View)
 * Returns tasks grouped by day
 */
export const getTasksForDateRange = query({
  args: {
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD
    includeCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Parse dates to timestamps
    const startOfWeek = new Date(args.startDate).setHours(0, 0, 0, 0);
    const endOfWeek = new Date(args.endDate).setHours(23, 59, 59, 999);

    // Get all issues for the user
    const allIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Filter by date range
    const tasksForWeek = allIssues.filter((issue) => {
      if (!issue.dueDate) return false;
      if (issue.status === "cancelled") return false;
      if (!args.includeCompleted && issue.status === "done") return false;
      return issue.dueDate >= startOfWeek && issue.dueDate <= endOfWeek;
    });

    // Group by day (YYYY-MM-DD format)
    const tasksByDay: Record<string, typeof tasksForWeek> = {};
    for (const task of tasksForWeek) {
      const date = new Date(task.dueDate!);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const dayStr = `${year}-${month}-${day}`;

      if (!tasksByDay[dayStr]) {
        tasksByDay[dayStr] = [];
      }
      tasksByDay[dayStr].push(task);
    }

    // Sort tasks within each day by priority then sortOrder
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
    for (const day of Object.keys(tasksByDay)) {
      tasksByDay[day].sort((a, b) => {
        const priorityDiff =
          priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.sortOrder - b.sortOrder;
      });
    }

    return tasksByDay;
  },
});

/**
 * Get tasks completed on a specific date (by completedAt timestamp)
 * Used by Daily Agenda to show tasks completed that day
 */
export const getCompletedTasksForDate = query({
  args: {
    date: v.string(), // YYYY-MM-DD format
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Parse the date to get start and end timestamps for the day
    const startOfDay = new Date(args.date).setHours(0, 0, 0, 0);
    const endOfDay = new Date(args.date).setHours(23, 59, 59, 999);

    // Get all issues for the user
    const allIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Filter by completedAt date
    const completedTasks = allIssues.filter((issue) => {
      if (issue.status !== "done") return false;
      if (!issue.completedAt) return false;
      return issue.completedAt >= startOfDay && issue.completedAt <= endOfDay;
    });

    // Sort by completedAt (most recent first)
    return completedTasks.sort(
      (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)
    );
  },
});

/**
 * Get tasks completed in a date range (by completedAt timestamp)
 * Used by Weekly View to show completed tasks rollup
 */
export const getCompletedTasksForDateRange = query({
  args: {
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Parse dates to timestamps
    const startOfRange = new Date(args.startDate).setHours(0, 0, 0, 0);
    const endOfRange = new Date(args.endDate).setHours(23, 59, 59, 999);

    // Get all issues for the user
    const allIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Filter by completedAt in date range
    const completedTasks = allIssues.filter((issue) => {
      if (issue.status !== "done") return false;
      if (!issue.completedAt) return false;
      return issue.completedAt >= startOfRange && issue.completedAt <= endOfRange;
    });

    // Sort by completedAt (most recent first)
    return completedTasks.sort(
      (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)
    );
  },
});

/**
 * Toggle top priority status for an issue (for Daily Agenda "Top 3" selection)
 */
export const toggleTopPriority = mutation({
  args: {
    issueId: v.id("lifeos_pmIssues"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.userId !== user._id) {
      throw new Error("Issue not found or access denied");
    }

    await ctx.db.patch(args.issueId, {
      isTopPriority: !issue.isTopPriority,
      updatedAt: now,
    });

    return { issueId: args.issueId, isTopPriority: !issue.isTopPriority };
  },
});
