/**
 * PM AI Internal Mutations/Queries
 * Internal functions called by the PM AI agent tools
 * These wrap the existing PM mutations with internal access
 */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc, Id } from "../_generated/dataModel";
import {
  priorityValidator,
  issueStatusValidator,
  projectStatusValidator,
  projectHealthValidator,
  cycleStatusValidator,
} from "./pm_schema";

// ==================== ISSUE INTERNALS ====================

export const createIssue = internalMutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(issueStatusValidator),
    priority: v.optional(priorityValidator),
    projectId: v.optional(v.id("lifeos_pmProjects")),
    cycleId: v.optional(v.id("lifeos_pmCycles")),
    dueDate: v.optional(v.number()),
    estimate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    let identifier: string;
    let number: number;

    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId !== user._id) {
        throw new Error("Project not found or access denied");
      }

      number = project.nextIssueNumber;
      identifier = `${project.key}-${number}`;

      await ctx.db.patch(args.projectId, {
        nextIssueNumber: number + 1,
        issueCount: project.issueCount + 1,
        updatedAt: now,
      });
    } else {
      const allIssues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      number = allIssues.length + 1;
      identifier = `ISS-${number}`;
    }

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

    const status = args.status ?? "backlog";
    const existingInStatus = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_status", (q) => q.eq("userId", user._id).eq("status", status))
      .collect();

    const maxSortOrder = existingInStatus.reduce((max, i) => Math.max(max, i.sortOrder), 0);

    const issueId = await ctx.db.insert("lifeos_pmIssues", {
      userId: user._id,
      projectId: args.projectId,
      cycleId: args.cycleId,
      parentId: undefined,
      identifier,
      number,
      title: args.title,
      description: args.description,
      status,
      priority: args.priority ?? "none",
      estimate: args.estimate,
      labelIds: [],
      dueDate: args.dueDate,
      sortOrder: maxSortOrder + 1000,
      createdAt: now,
      updatedAt: now,
    });

    return { issueId, identifier };
  },
});

export const updateIssue = internalMutation({
  args: {
    issueIdOrIdentifier: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(issueStatusValidator),
    priority: v.optional(priorityValidator),
    dueDate: v.optional(v.number()),
    estimate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Find issue by ID or identifier
    let issue: Doc<"lifeos_pmIssues"> | null = null;

    // Try as direct ID first
    try {
      issue = await ctx.db.get(args.issueIdOrIdentifier as Id<"lifeos_pmIssues">);
    } catch {
      // Not a valid ID, try as identifier
    }

    if (!issue) {
      issue = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_identifier", (q) =>
          q.eq("userId", user._id).eq("identifier", args.issueIdOrIdentifier.toUpperCase())
        )
        .first();
    }

    if (!issue || issue.userId !== user._id) {
      throw new Error("Issue not found or access denied");
    }

    const updates: Partial<Doc<"lifeos_pmIssues">> = { updatedAt: now };

    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.estimate !== undefined) updates.estimate = args.estimate;
    if (args.dueDate !== undefined) updates.dueDate = args.dueDate;

    // Handle status change with completion tracking
    if (args.status !== undefined && args.status !== issue.status) {
      const oldStatus = issue.status;
      const newStatus = args.status;
      updates.status = newStatus;

      if (newStatus === "done" && oldStatus !== "done") {
        updates.completedAt = now;
        if (issue.projectId) {
          const project = await ctx.db.get(issue.projectId);
          if (project) {
            await ctx.db.patch(issue.projectId, {
              completedIssueCount: project.completedIssueCount + 1,
              updatedAt: now,
            });
          }
        }
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
        if (issue.projectId) {
          const project = await ctx.db.get(issue.projectId);
          if (project && project.completedIssueCount > 0) {
            await ctx.db.patch(issue.projectId, {
              completedIssueCount: project.completedIssueCount - 1,
              updatedAt: now,
            });
          }
        }
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
    }

    await ctx.db.patch(issue._id, updates);
    return issue._id;
  },
});

export const deleteIssue = internalMutation({
  args: {
    issueIdOrIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Find issue by ID or identifier
    let issue: Doc<"lifeos_pmIssues"> | null = null;

    try {
      issue = await ctx.db.get(args.issueIdOrIdentifier as Id<"lifeos_pmIssues">);
    } catch {
      // Not a valid ID, try as identifier
    }

    if (!issue) {
      issue = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_identifier", (q) =>
          q.eq("userId", user._id).eq("identifier", args.issueIdOrIdentifier.toUpperCase())
        )
        .first();
    }

    if (!issue || issue.userId !== user._id) {
      throw new Error("Issue not found or access denied");
    }

    // Update project counts
    if (issue.projectId) {
      const project = await ctx.db.get(issue.projectId);
      if (project) {
        await ctx.db.patch(issue.projectId, {
          issueCount: Math.max(0, project.issueCount - 1),
          completedIssueCount:
            issue.status === "done"
              ? Math.max(0, project.completedIssueCount - 1)
              : project.completedIssueCount,
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

    await ctx.db.delete(issue._id);
  },
});

export const listIssues = internalQuery({
  args: {
    projectId: v.optional(v.id("lifeos_pmProjects")),
    cycleId: v.optional(v.id("lifeos_pmCycles")),
    status: v.optional(issueStatusValidator),
    priority: v.optional(priorityValidator),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    let issues;
    if (args.projectId) {
      issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .take(args.limit);
      issues = issues.filter((i) => i.userId === user._id);
    } else if (args.cycleId) {
      issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
        .take(args.limit);
      issues = issues.filter((i) => i.userId === user._id);
    } else {
      issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(args.limit);
    }

    // Apply filters
    if (args.status) {
      issues = issues.filter((i) => i.status === args.status);
    }
    if (args.priority) {
      issues = issues.filter((i) => i.priority === args.priority);
    }

    return issues;
  },
});

// ==================== PROJECT INTERNALS ====================

function generateProjectKey(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 4).toUpperCase();
  }
  return words
    .map((w) => w[0])
    .join("")
    .substring(0, 4)
    .toUpperCase();
}

export const createProject = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    status: v.optional(projectStatusValidator),
    priority: v.optional(priorityValidator),
    color: v.optional(v.string()),
    startDate: v.optional(v.number()),
    targetDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    let baseKey = generateProjectKey(args.name);
    let key = baseKey;
    let suffix = 1;

    while (true) {
      const existing = await ctx.db
        .query("lifeos_pmProjects")
        .withIndex("by_key", (q) => q.eq("userId", user._id).eq("key", key))
        .first();
      if (!existing) break;
      key = `${baseKey}${suffix}`;
      suffix++;
    }

    const projectId = await ctx.db.insert("lifeos_pmProjects", {
      userId: user._id,
      key,
      name: args.name,
      description: args.description,
      color: args.color ?? "#6366f1",
      status: args.status ?? "planned",
      health: "on_track",
      priority: args.priority ?? "none",
      startDate: args.startDate,
      targetDate: args.targetDate,
      issueCount: 0,
      completedIssueCount: 0,
      nextIssueNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    return projectId;
  },
});

export const updateProject = internalMutation({
  args: {
    projectId: v.id("lifeos_pmProjects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(projectStatusValidator),
    health: v.optional(projectHealthValidator),
    priority: v.optional(priorityValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found or access denied");
    }

    const updates: Partial<Doc<"lifeos_pmProjects">> = { updatedAt: now };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.status !== undefined) {
      updates.status = args.status;
      if (args.status === "completed") {
        updates.completedAt = now;
      }
    }
    if (args.health !== undefined) updates.health = args.health;
    if (args.priority !== undefined) updates.priority = args.priority;

    await ctx.db.patch(args.projectId, updates);
    return args.projectId;
  },
});

export const listProjects = internalQuery({
  args: {
    includeArchived: v.optional(v.boolean()),
    status: v.optional(projectStatusValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    let projects;
    if (args.status) {
      projects = await ctx.db
        .query("lifeos_pmProjects")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    } else if (args.includeArchived) {
      projects = await ctx.db
        .query("lifeos_pmProjects")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .collect();
    } else {
      projects = await ctx.db
        .query("lifeos_pmProjects")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .filter((q) => q.eq(q.field("archivedAt"), undefined))
        .collect();
    }

    return projects;
  },
});

export const archiveProject = internalMutation({
  args: {
    projectId: v.id("lifeos_pmProjects"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found or access denied");
    }

    await ctx.db.patch(args.projectId, {
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// ==================== CYCLE INTERNALS ====================

export const createCycle = internalMutation({
  args: {
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    projectId: v.optional(v.id("lifeos_pmProjects")),
    goals: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId !== user._id) {
        throw new Error("Project not found or access denied");
      }
    }

    const existingCycles = await ctx.db
      .query("lifeos_pmCycles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const maxNumber = existingCycles.reduce((max, c) => Math.max(max, c.number), 0);

    let status: "upcoming" | "active" | "completed" = "upcoming";
    if (now >= args.startDate && now <= args.endDate) {
      status = "active";
    } else if (now > args.endDate) {
      status = "completed";
    }

    const cycleId = await ctx.db.insert("lifeos_pmCycles", {
      userId: user._id,
      projectId: args.projectId,
      number: maxNumber + 1,
      name: args.name,
      description: args.description,
      startDate: args.startDate,
      endDate: args.endDate,
      status,
      goals: args.goals,
      issueCount: 0,
      completedIssueCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return cycleId;
  },
});

export const updateCycle = internalMutation({
  args: {
    cycleId: v.id("lifeos_pmCycles"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(cycleStatusValidator),
    goals: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.userId !== user._id) {
      throw new Error("Cycle not found or access denied");
    }

    const updates: Partial<Doc<"lifeos_pmCycles">> = { updatedAt: now };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.status !== undefined) updates.status = args.status;
    if (args.goals !== undefined) updates.goals = args.goals;

    await ctx.db.patch(args.cycleId, updates);
    return args.cycleId;
  },
});

export const deleteCycle = internalMutation({
  args: {
    cycleId: v.id("lifeos_pmCycles"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.userId !== user._id) {
      throw new Error("Cycle not found or access denied");
    }

    // Remove cycle assignment from all issues
    const issues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();

    for (const issue of issues) {
      await ctx.db.patch(issue._id, {
        cycleId: undefined,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.delete(args.cycleId);
  },
});

export const listCycles = internalQuery({
  args: {
    projectId: v.optional(v.id("lifeos_pmProjects")),
    status: v.optional(cycleStatusValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    let cycles;
    if (args.projectId) {
      cycles = await ctx.db
        .query("lifeos_pmCycles")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .order("desc")
        .collect();
      cycles = cycles.filter((c) => c.userId === user._id);
    } else if (args.status) {
      cycles = await ctx.db
        .query("lifeos_pmCycles")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    } else {
      cycles = await ctx.db
        .query("lifeos_pmCycles")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .collect();
    }

    return cycles;
  },
});

// ==================== LABEL INTERNALS ====================

export const createLabel = internalMutation({
  args: {
    name: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
    projectId: v.optional(v.id("lifeos_pmProjects")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("lifeos_pmLabels")
      .withIndex("by_name", (q) => q.eq("userId", user._id).eq("name", args.name))
      .first();

    if (existing) {
      throw new Error("A label with this name already exists");
    }

    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId !== user._id) {
        throw new Error("Project not found or access denied");
      }
    }

    const labelId = await ctx.db.insert("lifeos_pmLabels", {
      userId: user._id,
      projectId: args.projectId,
      name: args.name,
      color: args.color,
      description: args.description,
      createdAt: now,
      updatedAt: now,
    });

    return labelId;
  },
});

export const listLabels = internalQuery({
  args: {
    projectId: v.optional(v.id("lifeos_pmProjects")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (args.projectId) {
      const projectLabels = await ctx.db
        .query("lifeos_pmLabels")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
      return projectLabels.filter((l) => l.userId === user._id);
    }

    return await ctx.db
      .query("lifeos_pmLabels")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// ==================== CONTEXT INTERNAL ====================

export const getPMContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // Get projects summary
    const projects = await ctx.db
      .query("lifeos_pmProjects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();

    // Get active cycle
    const activeCycles = await ctx.db
      .query("lifeos_pmCycles")
      .withIndex("by_user_status", (q) => q.eq("userId", user._id).eq("status", "active"))
      .collect();
    const activeCycle = activeCycles[0] ?? null;

    // Get recent issues
    const recentIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(10);

    // Count total issues
    const allIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return {
      projectCount: projects.length,
      projects: projects.map((p) => ({
        id: p._id,
        key: p.key,
        name: p.name,
        status: p.status,
        issueCount: p.issueCount,
      })),
      activeCycle: activeCycle
        ? {
            id: activeCycle._id,
            name: activeCycle.name ?? `Cycle ${activeCycle.number}`,
            startDate: new Date(activeCycle.startDate).toISOString().split("T")[0],
            endDate: new Date(activeCycle.endDate).toISOString().split("T")[0],
            issueCount: activeCycle.issueCount,
            completedIssueCount: activeCycle.completedIssueCount,
          }
        : null,
      totalIssueCount: allIssues.length,
      recentIssues: recentIssues.map((i) => ({
        id: i._id,
        identifier: i.identifier,
        title: i.title,
        status: i.status,
        priority: i.priority,
      })),
    };
  },
});
