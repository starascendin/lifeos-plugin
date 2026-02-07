/**
 * CatGirl Agent Tools Library
 * Zod-based tools for LifeOS data access
 * These tools call existing internal functions from tool_call.ts
 *
 * Note: Tools get userId from the getCurrentUserId() function which is set
 * before each agent request in catgirl_agent.ts
 */
import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import { getCurrentUserId } from "./catgirl_context";

// Helper to get userId from the module-level state
function getUserId(): string {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("User not authenticated - no userId set");
  return userId;
}

// ==================== PROJECT TOOLS ====================

export const getProjectsTool = createTool({
  description: "Get user's projects with issue counts and completion stats. Use this to see all projects and their status.",
  args: z.object({
    status: z.enum(["planned", "in_progress", "paused", "completed", "cancelled"]).optional().describe("Filter by project status"),
    includeArchived: z.boolean().optional().describe("Include archived projects (default: false)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getProjectsInternal, {
      userId,
      status: args.status,
      includeArchived: args.includeArchived,
    });
  },
});

export const getProjectTool = createTool({
  description: "Get a single project's full details with stats. Use this to see detailed project info.",
  args: z.object({
    projectIdOrKey: z.string().describe("Project ID or key like 'ACME' (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getProjectInternal, {
      userId,
      projectIdOrKey: args.projectIdOrKey,
    });
  },
});

// ==================== TASK TOOLS ====================

export const getTasksTool = createTool({
  description: "Get tasks/issues with optional filters. Use this to list tasks in a project or by status/priority.",
  args: z.object({
    projectId: z.string().optional().describe("Filter by project ID"),
    status: z.enum(["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]).optional().describe("Filter by task status"),
    priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional().describe("Filter by priority level"),
    limit: z.number().optional().describe("Max results (default 50, max 100)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getTasksInternal, {
      userId,
      projectId: args.projectId,
      status: args.status,
      priority: args.priority,
      limit: args.limit,
    });
  },
});

export const getTodaysTasksTool = createTool({
  description: "Get today's tasks including tasks due today and top priority items. Best for daily planning.",
  args: z.object({}),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getTodaysTasksInternal, {
      userId,
    });
  },
});

export const createIssueTool = createTool({
  description: "Create a new task/issue. Optionally assign to a project, set priority, and due date.",
  args: z.object({
    title: z.string().describe("The task title (required)"),
    description: z.string().optional().describe("Detailed description"),
    projectIdOrKey: z.string().optional().describe("Project ID or key like 'ACME'"),
    priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional().describe("Priority level"),
    dueDate: z.string().optional().describe("Due date in ISO format like '2024-01-15'"),
    cycleId: z.string().optional().describe("Assign to a specific cycle"),
    phaseId: z.string().optional().describe("Assign to a specific phase within the project"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.createIssueInternal, {
      userId,
      title: args.title,
      description: args.description,
      projectIdOrKey: args.projectIdOrKey,
      priority: args.priority,
      dueDate: args.dueDate,
      cycleId: args.cycleId,
      phaseId: args.phaseId,
    });
  },
});

export const updateIssueTool = createTool({
  description: "Update an issue/task's details. Accepts issue ID or identifier like 'PROJ-123'.",
  args: z.object({
    issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123 (required)"),
    title: z.string().optional().describe("Updated title"),
    description: z.string().optional().describe("Updated description"),
    status: z.enum(["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]).optional().describe("Updated status"),
    priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional().describe("Updated priority"),
    dueDate: z.string().optional().describe("Due date in ISO format, or empty to clear"),
    isTopPriority: z.boolean().optional().describe("Mark as top priority"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.updateIssueInternal, {
      userId,
      issueIdOrIdentifier: args.issueIdOrIdentifier,
      title: args.title,
      description: args.description,
      status: args.status,
      priority: args.priority,
      dueDate: args.dueDate,
      isTopPriority: args.isTopPriority,
    });
  },
});

export const markIssueCompleteTool = createTool({
  description: "Mark a task as complete. Accepts issue ID or identifier like 'PROJ-123'.",
  args: z.object({
    issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123 (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.markIssueCompleteInternal, {
      userId,
      issueIdOrIdentifier: args.issueIdOrIdentifier,
    });
  },
});

// ==================== AGENDA TOOLS ====================

export const getDailyAgendaTool = createTool({
  description: "Get today's full agenda: tasks due today, calendar events, and top priorities.",
  args: z.object({
    date: z.string().optional().describe("Specific date in ISO format (optional, default: today)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getDailyAgendaInternal, {
      userId,
      date: args.date,
    });
  },
});

export const getWeeklyAgendaTool = createTool({
  description: "Get weekly agenda: tasks and events for the next 7 days, plus AI weekly summary.",
  args: z.object({
    startDate: z.string().optional().describe("Start date in ISO format (optional, default: today)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getWeeklyAgendaInternal, {
      userId,
      startDate: args.startDate,
    });
  },
});

// ==================== PEOPLE/CONTACTS TOOLS ====================

export const getPeopleTool = createTool({
  description: "Get all contacts/people with optional filters. Use this to list all your contacts.",
  args: z.object({
    relationshipType: z.enum(["family", "friend", "colleague", "acquaintance", "mentor", "other"]).optional().describe("Filter by relationship type"),
    includeArchived: z.boolean().optional().describe("Include archived people (default: false)"),
    limit: z.number().optional().describe("Max results (default 100)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getPeopleInternal, {
      userId,
      relationshipType: args.relationshipType,
      includeArchived: args.includeArchived,
      limit: args.limit,
    });
  },
});

export const searchPeopleTool = createTool({
  description: "Search contacts by name using full-text search.",
  args: z.object({
    query: z.string().describe("Search terms to find in names (required)"),
    limit: z.number().optional().describe("Max results (default 20)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.searchPeopleInternal, {
      userId,
      query: args.query,
      limit: args.limit,
    });
  },
});

export const getPersonTool = createTool({
  description: "Get a single person's details with their AI-generated profile including communication style and personality insights.",
  args: z.object({
    personId: z.string().describe("The person's ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getPersonInternal, {
      userId,
      personId: args.personId,
    });
  },
});

// ==================== NOTES TOOLS ====================

export const searchNotesTool = createTool({
  description: "Search voice memos/notes by content.",
  args: z.object({
    query: z.string().describe("Search terms to find in notes (required)"),
    limit: z.number().optional().describe("Max results (default 10, max 50)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.searchNotesInternal, {
      userId,
      query: args.query,
      limit: args.limit,
    });
  },
});

export const getRecentNotesTool = createTool({
  description: "Get recent voice memos/notes with transcripts.",
  args: z.object({
    limit: z.number().optional().describe("Number of notes to return (default 5, max 20)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getRecentNotesInternal, {
      userId,
      limit: args.limit,
    });
  },
});

export const createQuickNoteTool = createTool({
  description: "Create a quick text note. Useful for capturing thoughts.",
  args: z.object({
    content: z.string().describe("The note content (required)"),
    tags: z.array(z.string()).optional().describe("Tags for categorization"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.createQuickNoteInternal, {
      userId,
      content: args.content,
      tags: args.tags,
    });
  },
});

// ==================== ALL TOOLS EXPORT ====================

export const catgirlTools = {
  get_projects: getProjectsTool,
  get_project: getProjectTool,
  get_tasks: getTasksTool,
  get_todays_tasks: getTodaysTasksTool,
  create_issue: createIssueTool,
  update_issue: updateIssueTool,
  mark_issue_complete: markIssueCompleteTool,
  get_daily_agenda: getDailyAgendaTool,
  get_weekly_agenda: getWeeklyAgendaTool,
  get_people: getPeopleTool,
  search_people: searchPeopleTool,
  get_person: getPersonTool,
  search_notes: searchNotesTool,
  get_recent_notes: getRecentNotesTool,
  create_quick_note: createQuickNoteTool,
};
