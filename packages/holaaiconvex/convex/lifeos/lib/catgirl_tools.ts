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
    initiativeId: z.string().optional().describe("Link directly to a yearly initiative ID"),
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
      initiativeId: args.initiativeId,
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
    initiativeId: z.string().optional().describe("Link to a yearly initiative ID, or empty to unlink"),
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
      initiativeId: args.initiativeId,
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

// ==================== CONTACT INTERACTION TOOLS ====================

export const getMemosForPersonTool = createTool({
  description: "Get voice memos/notes linked to a contact. Use this to see what notes are associated with a person.",
  args: z.object({
    personId: z.string().describe("The person's ID (required)"),
    limit: z.number().optional().describe("Max results (default 20)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getMemosForPersonInternal, {
      userId,
      personId: args.personId,
      limit: args.limit,
    });
  },
});

export const getPersonTimelineTool = createTool({
  description: "Get chronological timeline of interactions with a contact including meetings, messages, and notes.",
  args: z.object({
    personId: z.string().describe("The person's ID (required)"),
    limit: z.number().optional().describe("Max results (default 20)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getPersonTimelineInternal, {
      userId,
      personId: args.personId,
      limit: args.limit,
    });
  },
});

// ==================== AI CONVERSATION SUMMARY TOOLS ====================

export const getAiConvoSummariesTool = createTool({
  description: "List past AI conversation summaries/crystallized notes. Use this to recall previous insights and decisions.",
  args: z.object({
    summaryType: z.string().optional().describe("Filter by summary type"),
    limit: z.number().optional().describe("Max results (default 20)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getAiConvoSummariesInternal, {
      userId,
      summaryType: args.summaryType,
      limit: args.limit,
    });
  },
});

export const searchAiConvoSummariesTool = createTool({
  description: "Search AI conversation summaries by content. Use this to find specific past conversations or insights.",
  args: z.object({
    query: z.string().describe("Search terms to find in summaries (required)"),
    limit: z.number().optional().describe("Max results (default 10)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.searchAiConvoSummariesInternal, {
      userId,
      query: args.query,
      limit: args.limit,
    });
  },
});

export const getAiConvoSummaryTool = createTool({
  description: "Get a single AI conversation summary with full details including key insights and action items.",
  args: z.object({
    summaryId: z.string().describe("The summary ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getAiConvoSummaryInternal, {
      userId,
      summaryId: args.summaryId,
    });
  },
});

export const createAiConvoSummaryTool = createTool({
  description: "Save a crystallized summary from this conversation. Use this to persist important insights, decisions, or action items.",
  args: z.object({
    title: z.string().describe("Title for the summary (required)"),
    summary: z.string().describe("The summary content (required)"),
    keyInsights: z.array(z.string()).optional().describe("Key insights from the conversation"),
    actionItems: z.array(z.string()).optional().describe("Action items identified"),
    ideas: z.array(z.string()).optional().describe("Ideas generated"),
    tags: z.array(z.string()).optional().describe("Tags for categorization"),
    relatedMemoIds: z.array(z.string()).optional().describe("IDs of related memos/notes"),
    summaryType: z.string().optional().describe("Type of summary (e.g. 'meeting', 'brainstorm', 'decision')"),
    conversationContext: z.string().optional().describe("Context about where this conversation took place"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.createAiConvoSummaryInternal, {
      userId,
      title: args.title,
      summary: args.summary,
      keyInsights: args.keyInsights,
      actionItems: args.actionItems,
      ideas: args.ideas,
      tags: args.tags,
      relatedMemoIds: args.relatedMemoIds,
      summaryType: args.summaryType,
      conversationContext: args.conversationContext,
    });
  },
});

// ==================== PROJECT MANAGEMENT (create/update/delete) ====================

export const createProjectTool = createTool({
  description: "Create a new project with a unique key.",
  args: z.object({
    name: z.string().describe("The project name (required)"),
    key: z.string().describe("Unique project key like 'ACME', uppercase (required)"),
    description: z.string().optional().describe("Project description"),
    clientId: z.string().optional().describe("Associate with a client ID"),
    status: z.enum(["planned", "in_progress", "paused", "completed", "cancelled"]).optional().describe("Project status (default: planned)"),
    priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional().describe("Priority level"),
    initiativeId: z.string().optional().describe("Link to a yearly initiative ID"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.createProjectInternal, {
      userId,
      name: args.name,
      key: args.key,
      description: args.description,
      clientId: args.clientId,
      status: args.status,
      priority: args.priority,
      initiativeId: args.initiativeId,
    });
  },
});

export const updateProjectTool = createTool({
  description: "Update a project's details.",
  args: z.object({
    projectIdOrKey: z.string().describe("Project ID or key like 'ACME' (required)"),
    name: z.string().optional().describe("Updated name"),
    description: z.string().optional().describe("Updated description"),
    status: z.enum(["planned", "in_progress", "paused", "completed", "cancelled"]).optional().describe("Updated status"),
    health: z.enum(["on_track", "at_risk", "off_track"]).optional().describe("Updated health status"),
    priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional().describe("Updated priority"),
    clientId: z.string().optional().describe("Associate with a client ID, or empty to unlink"),
    initiativeId: z.string().optional().describe("Link to a yearly initiative ID, or empty to unlink"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.updateProjectInternal, {
      userId,
      projectIdOrKey: args.projectIdOrKey,
      name: args.name,
      description: args.description,
      status: args.status,
      health: args.health,
      priority: args.priority,
      clientId: args.clientId,
      initiativeId: args.initiativeId,
    });
  },
});

export const deleteProjectTool = createTool({
  description: "Delete a project. Issues are preserved but unlinked from the project.",
  args: z.object({
    projectIdOrKey: z.string().describe("Project ID or key like 'ACME' (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.deleteProjectInternal, {
      userId,
      projectIdOrKey: args.projectIdOrKey,
    });
  },
});

// ==================== TASK TOOLS (get_issue, delete_issue) ====================

export const getIssueTool = createTool({
  description: "Get a single issue/task's full details. Accepts issue ID or identifier like 'PROJ-123'.",
  args: z.object({
    issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123 (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getIssueInternal, {
      userId,
      issueIdOrIdentifier: args.issueIdOrIdentifier,
    });
  },
});

export const deleteIssueTool = createTool({
  description: "Delete an issue/task permanently. Accepts issue ID or identifier like 'PROJ-123'.",
  args: z.object({
    issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123 (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.deleteIssueInternal, {
      userId,
      issueIdOrIdentifier: args.issueIdOrIdentifier,
    });
  },
});

// ==================== CYCLE/SPRINT TOOLS ====================

export const getCurrentCycleTool = createTool({
  description: "Get the currently active cycle/sprint with progress stats and top priority issues.",
  args: z.object({}),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getCurrentCycleInternal, {
      userId,
    });
  },
});

export const assignIssueToCycleTool = createTool({
  description: "Assign a task to a cycle. Defaults to current active cycle if no cycleId provided.",
  args: z.object({
    issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123 (required)"),
    cycleId: z.string().optional().describe("Cycle ID (optional, defaults to active cycle)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.assignIssueToCycleInternal, {
      userId,
      issueIdOrIdentifier: args.issueIdOrIdentifier,
      cycleId: args.cycleId,
    });
  },
});

export const getCyclesTool = createTool({
  description: "Get all cycles/sprints for the user with stats and progress.",
  args: z.object({
    status: z.enum(["upcoming", "active", "completed"]).optional().describe("Filter by cycle status"),
    limit: z.number().optional().describe("Max results (default 20)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getCyclesInternal, {
      userId,
      status: args.status,
      limit: args.limit,
    });
  },
});

export const createCycleTool = createTool({
  description: "Create a new cycle/sprint.",
  args: z.object({
    startDate: z.string().describe("Start date in ISO format like '2024-01-15' (required)"),
    endDate: z.string().describe("End date in ISO format like '2024-01-29' (required)"),
    name: z.string().optional().describe("Cycle name (optional, defaults to 'Cycle N')"),
    goals: z.string().optional().describe("Cycle goals/objectives"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.createCycleInternal, {
      userId,
      startDate: args.startDate,
      endDate: args.endDate,
      name: args.name,
      goals: args.goals,
    });
  },
});

export const updateCycleTool = createTool({
  description: "Update a cycle's details.",
  args: z.object({
    cycleId: z.string().describe("Cycle ID (required)"),
    name: z.string().optional().describe("Updated name"),
    startDate: z.string().optional().describe("Updated start date in ISO format"),
    endDate: z.string().optional().describe("Updated end date in ISO format"),
    status: z.enum(["upcoming", "active", "completed"]).optional().describe("Updated status"),
    goals: z.string().optional().describe("Updated goals"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.updateCycleInternal, {
      userId,
      cycleId: args.cycleId,
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
      status: args.status,
      goals: args.goals,
    });
  },
});

export const deleteCycleTool = createTool({
  description: "Delete a cycle. Issues in the cycle are unlinked (not deleted).",
  args: z.object({
    cycleId: z.string().describe("Cycle ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.deleteCycleInternal, {
      userId,
      cycleId: args.cycleId,
    });
  },
});

export const closeCycleTool = createTool({
  description: "Close/complete a cycle. Optionally rolls over incomplete issues to the next upcoming cycle.",
  args: z.object({
    cycleId: z.string().describe("Cycle ID to close (required)"),
    rolloverIncomplete: z.boolean().optional().describe("If true, move incomplete issues to the next cycle"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.closeCycleInternal, {
      userId,
      cycleId: args.cycleId,
      rolloverIncomplete: args.rolloverIncomplete,
    });
  },
});

export const generateCyclesTool = createTool({
  description: "Generate upcoming cycles based on user's cycle settings (duration, start day). Creates cycles starting after the latest existing cycle.",
  args: z.object({
    count: z.number().optional().describe("Number of cycles to generate (optional, uses default setting)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.generateCyclesInternal, {
      userId,
      count: args.count,
    });
  },
});

// ==================== AGENDA TOOLS (monthly + regenerate + prompts) ====================

export const getMonthlyAgendaTool = createTool({
  description: "Get monthly agenda: tasks and events for the month, plus AI monthly summary.",
  args: z.object({
    monthStartDate: z.string().optional().describe("First day of month in ISO format like '2024-01-01' (optional, default: current month)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getMonthlyAgendaInternal, {
      userId,
      monthStartDate: args.monthStartDate,
    });
  },
});

export const regenerateDailySummaryTool = createTool({
  description: "Regenerate the AI summary for a specific day.",
  args: z.object({
    date: z.string().describe("Date in ISO format like '2024-01-15' (required)"),
    model: z.string().optional().describe("AI model to use (optional)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.regenerateDailySummaryInternal, {
      userId,
      date: args.date,
      model: args.model,
    });
  },
});

export const regenerateWeeklySummaryTool = createTool({
  description: "Regenerate the AI summary for a specific week.",
  args: z.object({
    weekStartDate: z.string().describe("Monday of the week in ISO format like '2024-01-15' (required)"),
    model: z.string().optional().describe("AI model to use (optional)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.regenerateWeeklySummaryInternal, {
      userId,
      weekStartDate: args.weekStartDate,
      model: args.model,
    });
  },
});

export const regenerateMonthlySummaryTool = createTool({
  description: "Regenerate the AI summary for a specific month.",
  args: z.object({
    monthStartDate: z.string().describe("First day of month in ISO format like '2024-01-01' (required)"),
    model: z.string().optional().describe("AI model to use (optional)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.regenerateMonthlySummaryInternal, {
      userId,
      monthStartDate: args.monthStartDate,
      model: args.model,
    });
  },
});

export const updateWeeklyPromptTool = createTool({
  description: "Update the custom prompt used for generating weekly summaries.",
  args: z.object({
    weekStartDate: z.string().describe("Monday of the week in ISO format like '2024-01-15' (required)"),
    customPrompt: z.string().describe("Custom prompt template for AI summary generation (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.updateWeeklyPromptInternal, {
      userId,
      weekStartDate: args.weekStartDate,
      customPrompt: args.customPrompt,
    });
  },
});

export const updateMonthlyPromptTool = createTool({
  description: "Update the custom prompt used for generating monthly summaries.",
  args: z.object({
    monthStartDate: z.string().describe("First day of month in ISO format like '2024-01-01' (required)"),
    customPrompt: z.string().describe("Custom prompt template for AI summary generation (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.updateMonthlyPromptInternal, {
      userId,
      monthStartDate: args.monthStartDate,
      customPrompt: args.customPrompt,
    });
  },
});

// ==================== NOTES (add_tags_to_note) ====================

export const addTagsToNoteTool = createTool({
  description: "Add tags to an existing note.",
  args: z.object({
    noteId: z.string().describe("The note ID (required)"),
    tags: z.array(z.string()).describe("Tags to add (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.addTagsToNoteInternal, {
      userId,
      noteId: args.noteId,
      tags: args.tags,
    });
  },
});

// ==================== VOICE MEMO TOOLS ====================

export const getVoiceMemoTool = createTool({
  description: "Get a single voice memo with full details including transcript and AI extraction (summary, labels, action items, key points, sentiment).",
  args: z.object({
    memoId: z.string().describe("The voice memo ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getVoiceMemoInternal, {
      userId,
      memoId: args.memoId,
    });
  },
});

export const getVoiceMemosByDateTool = createTool({
  description: "Get voice memos within a date range, including transcripts and AI extractions.",
  args: z.object({
    startDate: z.string().describe("Start date in ISO format like '2024-01-15' (required)"),
    endDate: z.string().describe("End date in ISO format like '2024-01-22' (required)"),
    limit: z.number().optional().describe("Max results (default 50, max 100)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getVoiceMemosByDateInternal, {
      userId,
      startDate: args.startDate,
      endDate: args.endDate,
      limit: args.limit,
    });
  },
});

export const getVoiceMemosByLabelsTool = createTool({
  description: "Get voice memos that have specific labels/tags from AI extraction. Use this to find memos about specific topics.",
  args: z.object({
    labels: z.array(z.string()).describe("Labels to search for (required). Matches are fuzzy/partial."),
    limit: z.number().optional().describe("Max results (default 50, max 100)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getVoiceMemosByLabelsInternal, {
      userId,
      labels: args.labels,
      limit: args.limit,
    });
  },
});

export const getVoiceMemoLabelsTool = createTool({
  description: "Get all unique labels from voice memo AI extractions with counts. Use this to discover what topics exist in voice notes.",
  args: z.object({}),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getVoiceMemoLabelsInternal, {
      userId,
    });
  },
});

// ==================== AI CONVERSATION SUMMARY TOOLS (update/delete) ====================

export const updateAiConvoSummaryTool = createTool({
  description: "Update an existing AI conversation summary.",
  args: z.object({
    summaryId: z.string().describe("The summary ID (required)"),
    title: z.string().optional().describe("Updated title"),
    summary: z.string().optional().describe("Updated summary"),
    keyInsights: z.array(z.string()).optional().describe("Updated key insights"),
    actionItems: z.array(z.string()).optional().describe("Updated action items"),
    ideas: z.array(z.string()).optional().describe("Updated ideas"),
    tags: z.array(z.string()).optional().describe("Updated tags"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.updateAiConvoSummaryInternal, {
      userId,
      summaryId: args.summaryId,
      title: args.title,
      summary: args.summary,
      keyInsights: args.keyInsights,
      actionItems: args.actionItems,
      ideas: args.ideas,
      tags: args.tags,
    });
  },
});

export const deleteAiConvoSummaryTool = createTool({
  description: "Delete an AI conversation summary.",
  args: z.object({
    summaryId: z.string().describe("The summary ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.deleteAiConvoSummaryInternal, {
      userId,
      summaryId: args.summaryId,
    });
  },
});

// ==================== PEOPLE TOOLS (create/update/link) ====================

export const createPersonTool = createTool({
  description: "Create a new contact/person.",
  args: z.object({
    name: z.string().describe("The person's name (required)"),
    nickname: z.string().optional().describe("Nickname or alias"),
    relationshipType: z.enum(["family", "friend", "colleague", "acquaintance", "mentor", "other"]).optional().describe("Relationship type"),
    avatarEmoji: z.string().optional().describe("Emoji to represent this person"),
    notes: z.string().optional().describe("User notes about this person"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.createPersonInternal, {
      userId,
      name: args.name,
      nickname: args.nickname,
      relationshipType: args.relationshipType,
      avatarEmoji: args.avatarEmoji,
      notes: args.notes,
    });
  },
});

export const updatePersonTool = createTool({
  description: "Update a contact's details.",
  args: z.object({
    personId: z.string().describe("The person's ID (required)"),
    name: z.string().optional().describe("Updated name"),
    nickname: z.string().optional().describe("Updated nickname"),
    relationshipType: z.enum(["family", "friend", "colleague", "acquaintance", "mentor", "other"]).optional().describe("Updated relationship type"),
    email: z.string().optional().describe("Email address"),
    phone: z.string().optional().describe("Phone number"),
    notes: z.string().optional().describe("Updated notes"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.updatePersonInternal, {
      userId,
      personId: args.personId,
      name: args.name,
      nickname: args.nickname,
      relationshipType: args.relationshipType,
      email: args.email,
      phone: args.phone,
      notes: args.notes,
    });
  },
});

export const linkMemoToPersonTool = createTool({
  description: "Link a voice memo to a person.",
  args: z.object({
    personId: z.string().describe("The person's ID (required)"),
    voiceMemoId: z.string().describe("The voice memo's ID (required)"),
    context: z.string().optional().describe("Context for the link, e.g., 'Phone call', 'Coffee meetup'"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.linkMemoToPersonInternal, {
      userId,
      personId: args.personId,
      voiceMemoId: args.voiceMemoId,
      context: args.context,
    });
  },
});

// ==================== CLIENT TOOLS ====================

export const getClientsTool = createTool({
  description: "Get all clients for consulting/freelance work with optional status filter.",
  args: z.object({
    status: z.enum(["active", "archived"]).optional().describe("Filter by status"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getClientsInternal, {
      userId,
      status: args.status,
    });
  },
});

export const getClientTool = createTool({
  description: "Get a single client's details with project statistics.",
  args: z.object({
    clientId: z.string().describe("The client's ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getClientInternal, {
      userId,
      clientId: args.clientId,
    });
  },
});

export const getProjectsForClientTool = createTool({
  description: "Get all projects associated with a client, including completion stats.",
  args: z.object({
    clientId: z.string().describe("The client's ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getProjectsForClientInternal, {
      userId,
      clientId: args.clientId,
    });
  },
});

export const createClientTool = createTool({
  description: "Create a new client for consulting/freelance work.",
  args: z.object({
    name: z.string().describe("The client's name (required)"),
    description: z.string().optional().describe("Description of the client"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.createClientInternal, {
      userId,
      name: args.name,
      description: args.description,
    });
  },
});

export const updateClientTool = createTool({
  description: "Update a client's details.",
  args: z.object({
    clientId: z.string().describe("The client's ID (required)"),
    name: z.string().optional().describe("Updated name"),
    description: z.string().optional().describe("Updated description"),
    status: z.enum(["active", "archived"]).optional().describe("Updated status"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.updateClientInternal, {
      userId,
      clientId: args.clientId,
      name: args.name,
      description: args.description,
      status: args.status,
    });
  },
});

export const deleteClientTool = createTool({
  description: "Delete a client. Projects are unlinked (not deleted).",
  args: z.object({
    clientId: z.string().describe("The client's ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.deleteClientInternal, {
      userId,
      clientId: args.clientId,
    });
  },
});

// ==================== PHASE TOOLS ====================

export const getPhasesTool = createTool({
  description: "Get all phases for a project with issue stats.",
  args: z.object({
    projectId: z.string().describe("The project's ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getPhasesInternal, {
      userId,
      projectId: args.projectId,
    });
  },
});

export const getPhaseTool = createTool({
  description: "Get a single phase with its issues.",
  args: z.object({
    phaseId: z.string().describe("The phase's ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getPhaseInternal, {
      userId,
      phaseId: args.phaseId,
    });
  },
});

export const createPhaseTool = createTool({
  description: "Create a new phase in a project. Use this to organize project work into distinct stages.",
  args: z.object({
    projectId: z.string().describe("The project's ID (required)"),
    name: z.string().describe("The phase name (required)"),
    description: z.string().optional().describe("Phase description"),
    status: z.enum(["not_started", "in_progress", "completed"]).optional().describe("Phase status (default: not_started)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.createPhaseInternal, {
      userId,
      projectId: args.projectId,
      name: args.name,
      description: args.description,
      status: args.status,
    });
  },
});

export const updatePhaseTool = createTool({
  description: "Update a phase's details.",
  args: z.object({
    phaseId: z.string().describe("The phase's ID (required)"),
    name: z.string().optional().describe("Updated name"),
    description: z.string().optional().describe("Updated description"),
    status: z.enum(["not_started", "in_progress", "completed"]).optional().describe("Updated status"),
    startDate: z.string().optional().describe("Start date in ISO format"),
    endDate: z.string().optional().describe("End date in ISO format"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.updatePhaseInternal, {
      userId,
      phaseId: args.phaseId,
      name: args.name,
      description: args.description,
      status: args.status,
      startDate: args.startDate,
      endDate: args.endDate,
    });
  },
});

export const deletePhaseTool = createTool({
  description: "Delete a phase. Issues in the phase are unlinked (not deleted).",
  args: z.object({
    phaseId: z.string().describe("The phase's ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.deletePhaseInternal, {
      userId,
      phaseId: args.phaseId,
    });
  },
});

export const assignIssueToPhaseTool = createTool({
  description: "Assign an issue to a phase, or unassign by omitting phaseId.",
  args: z.object({
    issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123 (required)"),
    phaseId: z.string().optional().describe("Phase ID (optional - omit to unassign from current phase)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.assignIssueToPhaseInternal, {
      userId,
      issueIdOrIdentifier: args.issueIdOrIdentifier,
      phaseId: args.phaseId,
    });
  },
});

// ==================== BEEPER TOOLS ====================

export const getBeeperThreadsTool = createTool({
  description: "List all business-marked Beeper threads (WhatsApp contacts synced via Beeper).",
  args: z.object({
    limit: z.number().optional().describe("Max results (default 50)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getBeeperThreadsInternal, {
      userId,
      limit: args.limit,
    });
  },
});

export const getBeeperThreadTool = createTool({
  description: "Get a single Beeper thread by its Beeper thread ID.",
  args: z.object({
    threadId: z.string().describe("The Beeper thread ID string (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getBeeperThreadInternal, {
      userId,
      threadId: args.threadId,
    });
  },
});

export const getBeeperThreadMessagesTool = createTool({
  description: "Get messages for a Beeper thread.",
  args: z.object({
    threadId: z.string().describe("The Beeper thread ID string (required)"),
    limit: z.number().optional().describe("Max results (default 100)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getBeeperThreadMessagesInternal, {
      userId,
      threadId: args.threadId,
      limit: args.limit,
    });
  },
});

export const searchBeeperMessagesTool = createTool({
  description: "Full-text search across all synced Beeper messages.",
  args: z.object({
    query: z.string().describe("Search terms to find in messages (required)"),
    limit: z.number().optional().describe("Max results (default 50)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.searchBeeperMessagesInternal, {
      userId,
      query: args.query,
      limit: args.limit,
    });
  },
});

export const getBeeperThreadsForPersonTool = createTool({
  description: "Get Beeper threads linked to a FRM person/contact.",
  args: z.object({
    personId: z.string().describe("The person's ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getBeeperThreadsForPersonInternal, {
      userId,
      personId: args.personId,
    });
  },
});

export const getBeeperThreadsForClientTool = createTool({
  description: "Get Beeper threads linked to a PM client.",
  args: z.object({
    clientId: z.string().describe("The client's ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getBeeperThreadsForClientInternal, {
      userId,
      clientId: args.clientId,
    });
  },
});

// ==================== GRANOLA MEETING TOOLS ====================

export const getGranolaMeetingsTool = createTool({
  description: "List all synced Granola meeting notes.",
  args: z.object({
    limit: z.number().optional().describe("Max results (default 50)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getGranolaMeetingsInternal, {
      userId,
      limit: args.limit,
    });
  },
});

export const getGranolaMeetingTool = createTool({
  description: "Get a single Granola meeting by its Granola document ID. Includes full AI-generated notes.",
  args: z.object({
    granolaDocId: z.string().describe("The Granola document ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getGranolaMeetingInternal, {
      userId,
      granolaDocId: args.granolaDocId,
    });
  },
});

export const getGranolaTranscriptTool = createTool({
  description: "Get the full transcript for a Granola meeting.",
  args: z.object({
    meetingId: z.string().describe("The Convex meeting ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getGranolaTranscriptInternal, {
      userId,
      meetingId: args.meetingId,
    });
  },
});

export const searchGranolaMeetingsTool = createTool({
  description: "Search Granola meetings by title or content.",
  args: z.object({
    query: z.string().describe("Search terms to find in meeting titles and notes (required)"),
    limit: z.number().optional().describe("Max results (default 20)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.searchGranolaMeetingsInternal, {
      userId,
      query: args.query,
      limit: args.limit,
    });
  },
});

export const getGranolaMeetingsForPersonTool = createTool({
  description: "Get Granola meetings linked to a FRM person/contact.",
  args: z.object({
    personId: z.string().describe("The person's ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getGranolaMeetingsForPersonInternal, {
      userId,
      personId: args.personId,
    });
  },
});

export const getGranolaMeetingsForThreadTool = createTool({
  description: "Get Granola meetings linked to a Beeper thread.",
  args: z.object({
    beeperThreadId: z.string().describe("The Beeper thread Convex ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getGranolaMeetingsForThreadInternal, {
      userId,
      beeperThreadId: args.beeperThreadId,
    });
  },
});

// ==================== COMPOSITE/DOSSIER TOOLS ====================

export const getContactDossierTool = createTool({
  description: "Get everything about a contact in one call: person info, AI profile, Beeper threads, Granola meetings, voice memos. Supports lookup by personId OR fuzzy name search.",
  args: z.object({
    personId: z.string().optional().describe("The person's ID (provide this OR nameQuery)"),
    nameQuery: z.string().optional().describe("Fuzzy name search (provide this OR personId)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getContactDossierInternal, {
      userId,
      personId: args.personId,
      nameQuery: args.nameQuery,
    });
  },
});

export const getMeetingCalendarLinksTool = createTool({
  description: "Get calendar events linked to a Granola meeting, including attendees and event details.",
  args: z.object({
    meetingId: z.string().describe("The Convex meeting ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getMeetingCalendarLinksInternal, {
      userId,
      meetingId: args.meetingId,
    });
  },
});

// ==================== CRM/BUSINESS CONTACT TOOLS ====================

export const getBusinessContactsTool = createTool({
  description: "Get all business contacts (Beeper threads marked as business) with linked person/client info and meeting counts.",
  args: z.object({}),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getBusinessContactsInternal, {
      userId,
    });
  },
});

export const getMergeSuggestionsTool = createTool({
  description: "Get pending contact merge suggestions. Returns pairs of contacts that may be duplicates.",
  args: z.object({}),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getMergeSuggestionsInternal, {
      userId,
    });
  },
});

export const acceptMergeSuggestionTool = createTool({
  description: "Accept a merge suggestion and merge the source contact into the target contact.",
  args: z.object({
    suggestionId: z.string().describe("The merge suggestion ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.acceptMergeSuggestionInternal, {
      userId,
      suggestionId: args.suggestionId,
    });
  },
});

export const rejectMergeSuggestionTool = createTool({
  description: "Reject a merge suggestion. The suggestion will be marked as rejected and won't appear again.",
  args: z.object({
    suggestionId: z.string().describe("The merge suggestion ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.rejectMergeSuggestionInternal, {
      userId,
      suggestionId: args.suggestionId,
    });
  },
});

export const dismissAllMergeSuggestionsTool = createTool({
  description: "Dismiss all pending merge suggestions at once.",
  args: z.object({}),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.dismissAllMergeSuggestionsInternal, {
      userId,
    });
  },
});

export const syncBeeperContactsToFrmTool = createTool({
  description: "Bulk sync all unlinked business DM Beeper threads to FRM people. Creates a new contact for each unlinked thread.",
  args: z.object({
    dryRun: z.boolean().optional().describe("Preview without making changes (default: false)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.syncBeeperContactsToFrmInternal, {
      userId,
      dryRun: args.dryRun,
    });
  },
});

export const linkBeeperThreadToPersonTool = createTool({
  description: "Link a single Beeper thread to an existing or new FRM person.",
  args: z.object({
    threadId: z.string().describe("The Beeper thread ID string (required)"),
    personId: z.string().optional().describe("Existing person ID to link to (optional - omit to create new person)"),
    personName: z.string().optional().describe("Name for the new person (optional - defaults to thread name)"),
    relationshipType: z.string().optional().describe("Relationship type (default: colleague)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.linkBeeperThreadToPersonInternal, {
      userId,
      threadId: args.threadId,
      personId: args.personId,
      personName: args.personName,
      relationshipType: args.relationshipType,
    });
  },
});

export const unlinkMeetingFromBusinessContactTool = createTool({
  description: "Remove the link between a meeting and a business contact.",
  args: z.object({
    threadConvexId: z.string().describe("The Convex ID of the Beeper thread (required)"),
    meetingSource: z.enum(["granola", "fathom"]).describe("The meeting source: 'granola' or 'fathom' (required)"),
    meetingId: z.string().describe("The meeting ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.unlinkMeetingFromBusinessContactInternal, {
      userId,
      threadConvexId: args.threadConvexId,
      meetingSource: args.meetingSource,
      meetingId: args.meetingId,
    });
  },
});

// ==================== INITIATIVE TOOLS ====================

export const getInitiativesTool = createTool({
  description: "Get yearly initiatives with optional filters. Initiatives are the highest-order goals that cascade down to projects, tasks, and habits.",
  args: z.object({
    year: z.number().optional().describe("Filter by year, e.g. 2026"),
    status: z.enum(["active", "completed", "paused", "cancelled"]).optional().describe("Filter by status"),
    category: z.enum(["career", "health", "learning", "relationships", "finance", "personal"]).optional().describe("Filter by category"),
    includeArchived: z.boolean().optional().describe("Include archived initiatives (default: false)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getInitiativesInternal, {
      userId,
      year: args.year,
      status: args.status,
      category: args.category,
      includeArchived: args.includeArchived,
    });
  },
});

export const getInitiativeTool = createTool({
  description: "Get a single initiative's details by ID.",
  args: z.object({
    initiativeId: z.string().describe("The initiative ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getInitiativeInternal, {
      userId,
      initiativeId: args.initiativeId,
    });
  },
});

export const getInitiativeWithStatsTool = createTool({
  description: "Get an initiative with full stats: linked projects, habits, directly linked issues, task completion counts, and calculated progress.",
  args: z.object({
    initiativeId: z.string().describe("The initiative ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getInitiativeWithStatsInternal, {
      userId,
      initiativeId: args.initiativeId,
    });
  },
});

export const createInitiativeTool = createTool({
  description: "Create a new yearly initiative. Initiatives are the highest-order goals that organize projects, tasks, and habits.",
  args: z.object({
    year: z.number().describe("The year for this initiative, e.g. 2026 (required)"),
    title: z.string().describe("Initiative title (required)"),
    category: z.enum(["career", "health", "learning", "relationships", "finance", "personal"]).describe("Category for grouping (required)"),
    description: z.string().optional().describe("Detailed description"),
    status: z.enum(["active", "completed", "paused", "cancelled"]).optional().describe("Status (default: active)"),
    targetMetric: z.string().optional().describe("Target metric description, e.g. 'Complete 3 projects'"),
    manualProgress: z.number().optional().describe("Manual progress override 0-100"),
    color: z.string().optional().describe("Hex color for visual display"),
    icon: z.string().optional().describe("Emoji icon"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.createInitiativeInternal, {
      userId,
      year: args.year,
      title: args.title,
      category: args.category,
      description: args.description,
      status: args.status,
      targetMetric: args.targetMetric,
      manualProgress: args.manualProgress,
      color: args.color,
      icon: args.icon,
    });
  },
});

export const updateInitiativeTool = createTool({
  description: "Update an initiative's details.",
  args: z.object({
    initiativeId: z.string().describe("The initiative ID (required)"),
    title: z.string().optional().describe("Updated title"),
    description: z.string().optional().describe("Updated description"),
    category: z.enum(["career", "health", "learning", "relationships", "finance", "personal"]).optional().describe("Updated category"),
    status: z.enum(["active", "completed", "paused", "cancelled"]).optional().describe("Updated status"),
    targetMetric: z.string().optional().describe("Updated target metric"),
    manualProgress: z.number().optional().describe("Updated manual progress 0-100"),
    color: z.string().optional().describe("Updated hex color"),
    icon: z.string().optional().describe("Updated emoji icon"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.updateInitiativeInternal, {
      userId,
      initiativeId: args.initiativeId,
      title: args.title,
      description: args.description,
      category: args.category,
      status: args.status,
      targetMetric: args.targetMetric,
      manualProgress: args.manualProgress,
      color: args.color,
      icon: args.icon,
    });
  },
});

export const archiveInitiativeTool = createTool({
  description: "Archive an initiative (soft delete). Can be unarchived later.",
  args: z.object({
    initiativeId: z.string().describe("The initiative ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.archiveInitiativeInternal, {
      userId,
      initiativeId: args.initiativeId,
    });
  },
});

export const deleteInitiativeTool = createTool({
  description: "Permanently delete an initiative. Linked projects, habits, and issues are unlinked (not deleted).",
  args: z.object({
    initiativeId: z.string().describe("The initiative ID (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.deleteInitiativeInternal, {
      userId,
      initiativeId: args.initiativeId,
    });
  },
});

export const linkProjectToInitiativeTool = createTool({
  description: "Link a project to an initiative, or unlink by omitting initiativeId.",
  args: z.object({
    projectIdOrKey: z.string().describe("Project ID or key like 'ACME' (required)"),
    initiativeId: z.string().optional().describe("Initiative ID to link to (omit to unlink)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.linkProjectToInitiativeInternal, {
      userId,
      projectIdOrKey: args.projectIdOrKey,
      initiativeId: args.initiativeId,
    });
  },
});

export const linkIssueToInitiativeTool = createTool({
  description: "Link an issue/task directly to an initiative, or unlink by omitting initiativeId.",
  args: z.object({
    issueIdOrIdentifier: z.string().describe("Issue ID or identifier like 'PROJ-123' (required)"),
    initiativeId: z.string().optional().describe("Initiative ID to link to (omit to unlink)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runMutation(internal.lifeos.tool_call.linkIssueToInitiativeInternal, {
      userId,
      issueIdOrIdentifier: args.issueIdOrIdentifier,
      initiativeId: args.initiativeId,
    });
  },
});

export const getInitiativeYearlyRollupTool = createTool({
  description: "Get yearly rollup of all initiatives with aggregated stats: task counts, project counts, habit counts, and progress per initiative.",
  args: z.object({
    year: z.number().describe("The year to get rollup for, e.g. 2026 (required)"),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    const userId = getUserId();
    return await ctx.runQuery(internal.lifeos.tool_call.getInitiativeYearlyRollupInternal, {
      userId,
      year: args.year,
    });
  },
});

// ==================== ALL TOOLS EXPORT ====================

export const catgirlTools = {
  // Projects
  get_projects: getProjectsTool,
  get_project: getProjectTool,
  create_project: createProjectTool,
  update_project: updateProjectTool,
  delete_project: deleteProjectTool,
  // Tasks
  get_tasks: getTasksTool,
  get_todays_tasks: getTodaysTasksTool,
  create_issue: createIssueTool,
  get_issue: getIssueTool,
  update_issue: updateIssueTool,
  delete_issue: deleteIssueTool,
  mark_issue_complete: markIssueCompleteTool,
  // Cycles/Sprints
  get_current_cycle: getCurrentCycleTool,
  get_cycles: getCyclesTool,
  create_cycle: createCycleTool,
  update_cycle: updateCycleTool,
  delete_cycle: deleteCycleTool,
  close_cycle: closeCycleTool,
  generate_cycles: generateCyclesTool,
  assign_issue_to_cycle: assignIssueToCycleTool,
  // Agenda
  get_daily_agenda: getDailyAgendaTool,
  get_weekly_agenda: getWeeklyAgendaTool,
  get_monthly_agenda: getMonthlyAgendaTool,
  regenerate_daily_summary: regenerateDailySummaryTool,
  regenerate_weekly_summary: regenerateWeeklySummaryTool,
  regenerate_monthly_summary: regenerateMonthlySummaryTool,
  update_weekly_prompt: updateWeeklyPromptTool,
  update_monthly_prompt: updateMonthlyPromptTool,
  // People/Contacts
  get_people: getPeopleTool,
  search_people: searchPeopleTool,
  get_person: getPersonTool,
  create_person: createPersonTool,
  update_person: updatePersonTool,
  link_memo_to_person: linkMemoToPersonTool,
  get_memos_for_person: getMemosForPersonTool,
  get_person_timeline: getPersonTimelineTool,
  // Notes
  search_notes: searchNotesTool,
  get_recent_notes: getRecentNotesTool,
  create_quick_note: createQuickNoteTool,
  add_tags_to_note: addTagsToNoteTool,
  // Voice Memos
  get_voice_memo: getVoiceMemoTool,
  get_voice_memos_by_date: getVoiceMemosByDateTool,
  get_voice_memos_by_labels: getVoiceMemosByLabelsTool,
  get_voice_memo_labels: getVoiceMemoLabelsTool,
  // AI Conversation Summaries
  get_ai_convo_summaries: getAiConvoSummariesTool,
  search_ai_convo_summaries: searchAiConvoSummariesTool,
  get_ai_convo_summary: getAiConvoSummaryTool,
  create_ai_convo_summary: createAiConvoSummaryTool,
  update_ai_convo_summary: updateAiConvoSummaryTool,
  delete_ai_convo_summary: deleteAiConvoSummaryTool,
  // Clients
  get_clients: getClientsTool,
  get_client: getClientTool,
  get_projects_for_client: getProjectsForClientTool,
  create_client: createClientTool,
  update_client: updateClientTool,
  delete_client: deleteClientTool,
  // Phases
  get_phases: getPhasesTool,
  get_phase: getPhaseTool,
  create_phase: createPhaseTool,
  update_phase: updatePhaseTool,
  delete_phase: deletePhaseTool,
  assign_issue_to_phase: assignIssueToPhaseTool,
  // Beeper
  get_beeper_threads: getBeeperThreadsTool,
  get_beeper_thread: getBeeperThreadTool,
  get_beeper_thread_messages: getBeeperThreadMessagesTool,
  search_beeper_messages: searchBeeperMessagesTool,
  get_beeper_threads_for_person: getBeeperThreadsForPersonTool,
  get_beeper_threads_for_client: getBeeperThreadsForClientTool,
  // Granola Meetings
  get_granola_meetings: getGranolaMeetingsTool,
  get_granola_meeting: getGranolaMeetingTool,
  get_granola_transcript: getGranolaTranscriptTool,
  search_granola_meetings: searchGranolaMeetingsTool,
  get_granola_meetings_for_person: getGranolaMeetingsForPersonTool,
  get_granola_meetings_for_thread: getGranolaMeetingsForThreadTool,
  // Composite/Dossier
  get_contact_dossier: getContactDossierTool,
  get_meeting_calendar_links: getMeetingCalendarLinksTool,
  // CRM/Business Contacts
  get_business_contacts: getBusinessContactsTool,
  get_merge_suggestions: getMergeSuggestionsTool,
  accept_merge_suggestion: acceptMergeSuggestionTool,
  reject_merge_suggestion: rejectMergeSuggestionTool,
  dismiss_all_merge_suggestions: dismissAllMergeSuggestionsTool,
  sync_beeper_contacts_to_frm: syncBeeperContactsToFrmTool,
  link_beeper_thread_to_person: linkBeeperThreadToPersonTool,
  unlink_meeting_from_business_contact: unlinkMeetingFromBusinessContactTool,
  // Initiatives
  get_initiatives: getInitiativesTool,
  get_initiative: getInitiativeTool,
  get_initiative_with_stats: getInitiativeWithStatsTool,
  create_initiative: createInitiativeTool,
  update_initiative: updateInitiativeTool,
  archive_initiative: archiveInitiativeTool,
  delete_initiative: deleteInitiativeTool,
  link_project_to_initiative: linkProjectToInitiativeTool,
  link_issue_to_initiative: linkIssueToInitiativeTool,
  get_initiative_yearly_rollup: getInitiativeYearlyRollupTool,
};
