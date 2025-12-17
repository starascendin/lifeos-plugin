/**
 * PM AI Agent
 * AI assistant for managing projects, issues, cycles, and labels
 * Using @convex-dev/agent for built-in thread persistence and tool execution
 */
import { Agent, createTool } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { v } from "convex/values";
import { action, query } from "../_generated/server";
import { components, internal, api } from "../_generated/api";
import type { Id, Doc } from "../_generated/dataModel";
import type { ActionCtx, QueryCtx } from "../_generated/server";

// Type aliases for tool context
type ToolCtx = {
  runMutation: ActionCtx["runMutation"];
  runQuery: ActionCtx["runQuery"];
};

// ==================== TOOL DEFINITIONS ====================

const createIssueTool = createTool({
  description: "Create a new issue/task in the project management system",
  args: z.object({
    title: z.string().describe("Issue title (required)"),
    description: z.string().optional().describe("Issue description (markdown supported)"),
    status: z
      .enum(["backlog", "todo", "in_progress", "in_review", "done", "cancelled"])
      .optional()
      .describe("Issue status. Default: backlog"),
    priority: z
      .enum(["urgent", "high", "medium", "low", "none"])
      .optional()
      .describe("Issue priority. Default: none"),
    projectId: z.string().optional().describe("Project ID to add issue to"),
    cycleId: z.string().optional().describe("Cycle ID to assign issue to"),
    dueDate: z.string().optional().describe("Due date in ISO format (YYYY-MM-DD)"),
    estimate: z.number().optional().describe("Story points estimate"),
  }),
  handler: async (ctx: ToolCtx, args): Promise<{ success: boolean; issueId: string; identifier: string }> => {
    const result = await ctx.runMutation(internal.lifeos.pm_ai_internal.createIssue, {
      title: args.title,
      description: args.description,
      status: args.status,
      priority: args.priority,
      projectId: args.projectId as Id<"lifeos_pmProjects"> | undefined,
      cycleId: args.cycleId as Id<"lifeos_pmCycles"> | undefined,
      dueDate: args.dueDate ? new Date(args.dueDate).getTime() : undefined,
      estimate: args.estimate,
    });
    return { success: true, issueId: String(result.issueId), identifier: result.identifier };
  },
});

const updateIssueTool = createTool({
  description: "Update an existing issue by ID or identifier (e.g., PROJ-123)",
  args: z.object({
    issueId: z.string().describe("Issue ID or identifier (e.g., PROJ-123)"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    status: z
      .enum(["backlog", "todo", "in_progress", "in_review", "done", "cancelled"])
      .optional(),
    priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
    dueDate: z.string().optional().describe("Due date in ISO format (YYYY-MM-DD)"),
    estimate: z.number().optional().describe("Story points estimate"),
  }),
  handler: async (ctx: ToolCtx, args): Promise<{ success: boolean; issueId: string }> => {
    const result = await ctx.runMutation(internal.lifeos.pm_ai_internal.updateIssue, {
      issueIdOrIdentifier: args.issueId,
      title: args.title,
      description: args.description,
      status: args.status,
      priority: args.priority,
      dueDate: args.dueDate ? new Date(args.dueDate).getTime() : undefined,
      estimate: args.estimate,
    });
    return { success: true, issueId: String(result) };
  },
});

const deleteIssueTool = createTool({
  description: "Delete an issue by ID or identifier",
  args: z.object({
    issueId: z.string().describe("Issue ID or identifier to delete"),
  }),
  handler: async (ctx: ToolCtx, args): Promise<{ success: boolean; message: string }> => {
    await ctx.runMutation(internal.lifeos.pm_ai_internal.deleteIssue, {
      issueIdOrIdentifier: args.issueId,
    });
    return { success: true, message: "Issue deleted successfully" };
  },
});

const listIssuesTool = createTool({
  description:
    "List issues with optional filters. Returns issue details including ID, title, status, priority.",
  args: z.object({
    projectId: z.string().optional().describe("Filter by project ID"),
    cycleId: z.string().optional().describe("Filter by cycle ID"),
    status: z
      .enum(["backlog", "todo", "in_progress", "in_review", "done", "cancelled"])
      .optional(),
    priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
    limit: z.number().optional().describe("Max issues to return. Default: 20"),
  }),
  handler: async (ctx: ToolCtx, args): Promise<Array<{
    id: string;
    identifier: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    estimate: number | undefined;
  }>> => {
    const issues = await ctx.runQuery(internal.lifeos.pm_ai_internal.listIssues, {
      projectId: args.projectId as Id<"lifeos_pmProjects"> | undefined,
      cycleId: args.cycleId as Id<"lifeos_pmCycles"> | undefined,
      status: args.status,
      priority: args.priority,
      limit: args.limit ?? 20,
    });
    return issues.map((issue) => ({
      id: String(issue._id),
      identifier: issue.identifier,
      title: issue.title,
      status: issue.status,
      priority: issue.priority,
      dueDate: issue.dueDate ? new Date(issue.dueDate).toISOString().split("T")[0] : null,
      estimate: issue.estimate,
    }));
  },
});

const createProjectTool = createTool({
  description: "Create a new project",
  args: z.object({
    name: z.string().describe("Project name (required)"),
    description: z.string().optional().describe("Project description"),
    status: z
      .enum(["planned", "in_progress", "paused", "completed", "cancelled"])
      .optional(),
    priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
    color: z.string().optional().describe("Hex color for the project (e.g., #6366f1)"),
    startDate: z.string().optional().describe("Start date in ISO format"),
    targetDate: z.string().optional().describe("Target completion date in ISO format"),
  }),
  handler: async (ctx: ToolCtx, args): Promise<{ success: boolean; projectId: string }> => {
    const projectId = await ctx.runMutation(internal.lifeos.pm_ai_internal.createProject, {
      name: args.name,
      description: args.description,
      status: args.status,
      priority: args.priority,
      color: args.color,
      startDate: args.startDate ? new Date(args.startDate).getTime() : undefined,
      targetDate: args.targetDate ? new Date(args.targetDate).getTime() : undefined,
    });
    return { success: true, projectId: String(projectId) };
  },
});

const updateProjectTool = createTool({
  description: "Update an existing project",
  args: z.object({
    projectId: z.string().describe("Project ID (required)"),
    name: z.string().optional().describe("New project name"),
    description: z.string().optional().describe("New description"),
    status: z
      .enum(["planned", "in_progress", "paused", "completed", "cancelled"])
      .optional(),
    health: z.enum(["on_track", "at_risk", "off_track"]).optional(),
    priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
  }),
  handler: async (ctx: ToolCtx, args): Promise<{ success: boolean; projectId: string }> => {
    await ctx.runMutation(internal.lifeos.pm_ai_internal.updateProject, {
      projectId: args.projectId as Id<"lifeos_pmProjects">,
      name: args.name,
      description: args.description,
      status: args.status,
      health: args.health,
      priority: args.priority,
    });
    return { success: true, projectId: args.projectId };
  },
});

const listProjectsTool = createTool({
  description: "List all projects with their status and issue counts",
  args: z.object({
    includeArchived: z.boolean().optional().describe("Include archived projects"),
    status: z
      .enum(["planned", "in_progress", "paused", "completed", "cancelled"])
      .optional(),
  }),
  handler: async (ctx: ToolCtx, args): Promise<Array<{
    id: string;
    key: string;
    name: string;
    status: string;
    health: string;
    priority: string;
    issueCount: number;
    completedIssueCount: number;
  }>> => {
    const projects = await ctx.runQuery(internal.lifeos.pm_ai_internal.listProjects, {
      includeArchived: args.includeArchived,
      status: args.status,
    });
    return projects.map((project) => ({
      id: String(project._id),
      key: project.key,
      name: project.name,
      status: project.status,
      health: project.health,
      priority: project.priority,
      issueCount: project.issueCount,
      completedIssueCount: project.completedIssueCount,
    }));
  },
});

const archiveProjectTool = createTool({
  description: "Archive a project (soft delete)",
  args: z.object({
    projectId: z.string().describe("Project ID to archive"),
  }),
  handler: async (ctx: ToolCtx, args): Promise<{ success: boolean; message: string }> => {
    await ctx.runMutation(internal.lifeos.pm_ai_internal.archiveProject, {
      projectId: args.projectId as Id<"lifeos_pmProjects">,
    });
    return { success: true, message: "Project archived successfully" };
  },
});

const createCycleTool = createTool({
  description: "Create a new cycle/sprint for organizing work within a time period",
  args: z.object({
    name: z.string().optional().describe("Cycle name (optional, auto-generated if not provided)"),
    description: z.string().optional().describe("Cycle description"),
    startDate: z.string().describe("Start date in ISO format (YYYY-MM-DD)"),
    endDate: z.string().describe("End date in ISO format (YYYY-MM-DD)"),
    projectId: z.string().optional().describe("Project ID to associate cycle with"),
    goals: z.array(z.string()).optional().describe("List of cycle goals"),
  }),
  handler: async (ctx: ToolCtx, args): Promise<{ success: boolean; cycleId: string }> => {
    const cycleId = await ctx.runMutation(internal.lifeos.pm_ai_internal.createCycle, {
      name: args.name,
      description: args.description,
      startDate: new Date(args.startDate).getTime(),
      endDate: new Date(args.endDate).getTime(),
      projectId: args.projectId as Id<"lifeos_pmProjects"> | undefined,
      goals: args.goals,
    });
    return { success: true, cycleId: String(cycleId) };
  },
});

const updateCycleTool = createTool({
  description: "Update an existing cycle",
  args: z.object({
    cycleId: z.string().describe("Cycle ID (required)"),
    name: z.string().optional().describe("New cycle name"),
    description: z.string().optional().describe("New description"),
    status: z.enum(["upcoming", "active", "completed"]).optional(),
    goals: z.array(z.string()).optional(),
  }),
  handler: async (ctx: ToolCtx, args): Promise<{ success: boolean; cycleId: string }> => {
    await ctx.runMutation(internal.lifeos.pm_ai_internal.updateCycle, {
      cycleId: args.cycleId as Id<"lifeos_pmCycles">,
      name: args.name,
      description: args.description,
      status: args.status,
      goals: args.goals,
    });
    return { success: true, cycleId: args.cycleId };
  },
});

const deleteCycleTool = createTool({
  description: "Delete a cycle (issues are unassigned, not deleted)",
  args: z.object({
    cycleId: z.string().describe("Cycle ID to delete"),
  }),
  handler: async (ctx: ToolCtx, args): Promise<{ success: boolean; message: string }> => {
    await ctx.runMutation(internal.lifeos.pm_ai_internal.deleteCycle, {
      cycleId: args.cycleId as Id<"lifeos_pmCycles">,
    });
    return { success: true, message: "Cycle deleted successfully" };
  },
});

const listCyclesTool = createTool({
  description: "List all cycles with their status and issue counts",
  args: z.object({
    projectId: z.string().optional().describe("Filter by project ID"),
    status: z.enum(["upcoming", "active", "completed"]).optional(),
  }),
  handler: async (ctx: ToolCtx, args): Promise<Array<{
    id: string;
    number: number;
    name: string | undefined;
    status: string;
    startDate: string;
    endDate: string;
    issueCount: number;
    completedIssueCount: number;
  }>> => {
    const cycles = await ctx.runQuery(internal.lifeos.pm_ai_internal.listCycles, {
      projectId: args.projectId as Id<"lifeos_pmProjects"> | undefined,
      status: args.status,
    });
    return cycles.map((cycle) => ({
      id: String(cycle._id),
      number: cycle.number,
      name: cycle.name,
      status: cycle.status,
      startDate: new Date(cycle.startDate).toISOString().split("T")[0],
      endDate: new Date(cycle.endDate).toISOString().split("T")[0],
      issueCount: cycle.issueCount,
      completedIssueCount: cycle.completedIssueCount,
    }));
  },
});

const createLabelTool = createTool({
  description: "Create a new label for categorizing issues",
  args: z.object({
    name: z.string().describe("Label name (required)"),
    color: z.string().describe("Hex color (required, e.g., #ef4444)"),
    description: z.string().optional().describe("Label description"),
    projectId: z.string().optional().describe("Project ID for project-specific label"),
  }),
  handler: async (ctx: ToolCtx, args): Promise<{ success: boolean; labelId: string }> => {
    const labelId = await ctx.runMutation(internal.lifeos.pm_ai_internal.createLabel, {
      name: args.name,
      color: args.color,
      description: args.description,
      projectId: args.projectId as Id<"lifeos_pmProjects"> | undefined,
    });
    return { success: true, labelId: String(labelId) };
  },
});

const listLabelsTool = createTool({
  description: "List all available labels",
  args: z.object({
    projectId: z.string().optional().describe("Filter by project ID"),
  }),
  handler: async (ctx: ToolCtx, args): Promise<Array<{
    id: string;
    name: string;
    color: string;
    description: string | undefined;
  }>> => {
    const labels = await ctx.runQuery(internal.lifeos.pm_ai_internal.listLabels, {
      projectId: args.projectId as Id<"lifeos_pmProjects"> | undefined,
    });
    return labels.map((label) => ({
      id: String(label._id),
      name: label.name,
      color: label.color,
      description: label.description,
    }));
  },
});

const getPMContextTool = createTool({
  description:
    "Get current PM context including projects summary, active cycle, and recent issues. Call this to understand the current state before making changes.",
  args: z.object({
    _placeholder: z.string().optional().describe("Unused placeholder"),
  }),
  handler: async (ctx: ToolCtx, _args): Promise<{
    projectCount: number;
    projects: Array<{ id: string; key: string; name: string; status: string; issueCount: number }>;
    activeCycle: {
      id: string;
      name: string;
      startDate: string;
      endDate: string;
      issueCount: number;
      completedIssueCount: number;
    } | null;
    totalIssueCount: number;
    recentIssues: Array<{
      id: string;
      identifier: string;
      title: string;
      status: string;
      priority: string;
    }>;
  }> => {
    const result = await ctx.runQuery(internal.lifeos.pm_ai_internal.getPMContext, {});
    return result;
  },
});

// ==================== AGENT DEFINITION ====================

export const pmAgent = new Agent(components.agent, {
  name: "PM Assistant",
  languageModel: openai.chat("gpt-4o-mini"),
  instructions: `You are a helpful project management assistant for LifeOS.
You can help users manage their projects, issues, cycles, and labels.

Available actions:
- Create, update, delete issues
- Create, update, archive projects
- Create, update, delete cycles
- Create labels

Guidelines:
- When creating issues, use clear, actionable titles
- When listing items, format the response in a clear, readable way
- Be concise but helpful
- Ask clarifying questions when the request is ambiguous
- Confirm destructive actions (delete, archive) before executing
- After creating items, report the ID/identifier so the user can reference it
- Always call get_pm_context first to understand the current state if you need context`,
  tools: {
    create_issue: createIssueTool,
    update_issue: updateIssueTool,
    delete_issue: deleteIssueTool,
    list_issues: listIssuesTool,
    create_project: createProjectTool,
    update_project: updateProjectTool,
    list_projects: listProjectsTool,
    archive_project: archiveProjectTool,
    create_cycle: createCycleTool,
    update_cycle: updateCycleTool,
    delete_cycle: deleteCycleTool,
    list_cycles: listCyclesTool,
    create_label: createLabelTool,
    list_labels: listLabelsTool,
    get_pm_context: getPMContextTool,
  },
});

// ==================== EXPOSED ACTIONS ====================

/**
 * Create a new thread for PM AI chat
 */
export const createThread = action({
  args: {},
  handler: async (ctx): Promise<{ threadId: string }> => {
    const { threadId } = await pmAgent.createThread(ctx, {});
    return { threadId };
  },
});

/**
 * Send a message to the PM AI and get a response
 */
export const sendMessage = action({
  args: {
    threadId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { threadId, message }): Promise<{
    text: string;
    toolCalls?: Array<{ name: string; args: unknown }>;
    toolResults?: Array<{ name: string; result: unknown }>;
  }> => {
    const { thread } = await pmAgent.continueThread(ctx, { threadId });
    const result = await thread.generateText({ prompt: message });
    return {
      text: result.text,
      toolCalls: result.toolCalls?.map((tc: any) => ({
        name: tc.toolName,
        args: tc.args,
      })),
      toolResults: result.toolResults?.map((tr: any) => ({
        name: tr.toolName,
        result: tr.result,
      })),
    };
  },
});

// Note: Message listing will be handled via the agent's built-in thread context
// Each sendMessage call includes the full conversation history automatically
