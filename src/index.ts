#!/usr/bin/env node

/**
 * LifeOS MCP Server
 *
 * Exposes LifeOS Project Management tools via Model Context Protocol.
 * Calls the Convex HTTP /tool-call endpoint.
 *
 * CLI flags (take precedence over env vars):
 *   --url, -u       Convex deployment URL (e.g., https://your-deployment.convex.site)
 *   --user-id, -i   User ID for API authentication
 *   --api-key, -k   API key for authentication
 *
 * Environment variables (fallback):
 *   CONVEX_URL      Convex deployment URL
 *   LIFEOS_CONVEX_URL Convex deployment URL alias used by the plugin docs
 *   LIFEOS_USER_ID  User ID for API key auth
 *   LIFEOS_API_KEY  API key for authentication
 */

import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { VERSION, BUILD_TIME } from "./build-info.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ReadResourceRequestSchema,
  type Tool,
  type Prompt,
  type Resource,
  type ResourceTemplate,
} from "@modelcontextprotocol/sdk/types.js";

// Parse CLI arguments
const program = new Command();
type DirectCliCommand =
  | {
      kind: "agenda";
      scope: string;
      date?: string;
      weekStartDate?: string;
    }
  | {
      kind: "patch";
      file: string;
      dryRun?: boolean;
    }
  | {
      kind: "ppv";
      action: string;
      file?: string;
    }
  | {
      kind: "voiceSummary";
      action: string;
      file?: string;
      summaryId?: string;
      query?: string;
      limit?: number;
    }
  | {
      kind: "personalRecords";
      action: string;
      recordId?: string;
      query?: string;
      tag?: string;
      includeArchived?: boolean;
      limit?: number;
      maxSnippetChars?: number;
    };
let directCliCommand: DirectCliCommand | null = null;

program
  .name("lifeos-mcp")
  .description("MCP server for LifeOS Project Management")
  .version(VERSION)
  .action(() => {
    // No subcommand means this process should run as the stdio MCP server.
  })
  .option("-u, --url <url>", "Convex deployment URL")
  .option("-i, --user-id <id>", "User ID for API authentication")
  .option("-k, --api-key <key>", "API key for authentication");

program
  .command("agenda <scope>")
  .description(
    "Fetch planning context as JSON. Scope can be day, week, cycle, or full.",
  )
  .option("--date <date>", "Target day in YYYY-MM-DD format")
  .option("--week-start-date <date>", "Week start in YYYY-MM-DD format")
  .action(
    (
      scope: string,
      commandOptions: { date?: string; weekStartDate?: string },
    ) => {
      directCliCommand = {
        kind: "agenda",
        scope,
        date: commandOptions.date,
        weekStartDate: commandOptions.weekStartDate,
      };
    },
  );

program
  .command("patch <file>")
  .description(
    "Apply a planning patch JSON file through apply_planning_patch. Use --dry-run to preview.",
  )
  .option("--dry-run", "Preview without mutating")
  .action((file: string, commandOptions: { dryRun?: boolean }) => {
    directCliCommand = {
      kind: "patch",
      file,
      dryRun: commandOptions.dryRun,
    };
  });

program
  .command("ppv <action>")
  .description(
    "Manage PPV as JSON. Actions: workspace, graph, vision-graph, seed, vision, activate-vision, set-active-vision, identity, pillar, frictions, create-friction, update-friction.",
  )
  .option(
    "--file <file>",
    "JSON payload file for mutating actions. workspace, graph, vision-graph, and seed do not require a file.",
  )
  .action((action: string, commandOptions: { file?: string }) => {
    directCliCommand = {
      kind: "ppv",
      action,
      file: commandOptions.file,
    };
  });

program
  .command("voice-summary <action>")
  .description(
    "Manage aggregate Voice Notes AI summaries as JSON. Actions: list, get, search, add, create.",
  )
  .option("--file <file>", "JSON payload file for add/create/update actions")
  .option("--summary-id <id>", "Summary ID for get/update/delete")
  .option("--query <query>", "Search query for search")
  .option("--limit <limit>", "Result limit", Number)
  .action(
    (
      action: string,
      commandOptions: {
        file?: string;
        summaryId?: string;
        query?: string;
        limit?: number;
      },
    ) => {
      directCliCommand = {
        kind: "voiceSummary",
        action,
        file: commandOptions.file,
        summaryId: commandOptions.summaryId,
        query: commandOptions.query,
        limit: commandOptions.limit,
      };
    },
  );

program
  .command("personal-records <action>")
  .description(
    "Retrieve Personal Records as JSON. Actions: list, get, search, retrieve, rag.",
  )
  .option("--record-id <id>", "Record ID for get")
  .option("--query <query>", "Search/RAG query")
  .option("--tag <tag>", "Exact tag filter for list")
  .option("--include-archived", "Include archived records")
  .option("--limit <limit>", "Result limit", Number)
  .option("--max-snippet-chars <chars>", "RAG snippet character cap", Number)
  .action(
    (
      action: string,
      commandOptions: {
        recordId?: string;
        query?: string;
        tag?: string;
        includeArchived?: boolean;
        limit?: number;
        maxSnippetChars?: number;
      },
    ) => {
      directCliCommand = {
        kind: "personalRecords",
        action,
        recordId: commandOptions.recordId,
        query: commandOptions.query,
        tag: commandOptions.tag,
        includeArchived: commandOptions.includeArchived,
        limit: commandOptions.limit,
        maxSnippetChars: commandOptions.maxSnippetChars,
      };
    },
  );

program.parse();

const options = program.opts() as {
  url?: string;
  userId?: string;
  apiKey?: string;
};

// Tool definitions matching the Convex tool-call endpoint
const TOOLS: Tool[] = [
  // Project Management Tools
  {
    name: "get_projects",
    description:
      "Get user's projects with issue counts and completion stats. Use this to see all projects and their status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        status: {
          type: "string",
          enum: ["planned", "in_progress", "paused", "completed", "cancelled"],
          description: "Filter by project status",
        },
        includeArchived: {
          type: "boolean",
          description: "Include archived projects (default: false)",
        },
      },
    },
  },
  {
    name: "get_project",
    description:
      "Get a single project's full details with stats. Use this to see detailed project info.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        projectIdOrKey: {
          type: "string",
          description: "Project ID or key like 'ACME' (required)",
        },
      },
      required: ["projectIdOrKey"],
    },
  },
  {
    name: "create_project",
    description: "Create a new project with a unique key.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        name: {
          type: "string",
          description: "The project name (required)",
        },
        key: {
          type: "string",
          description: "Unique project key like 'ACME', uppercase (required)",
        },
        description: {
          type: "string",
          description: "Project description (optional)",
        },
        clientId: {
          type: "string",
          description: "Associate with a client ID (optional)",
        },
        status: {
          type: "string",
          enum: ["planned", "in_progress", "paused", "completed", "cancelled"],
          description: "Project status (optional, default: planned)",
        },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low", "none"],
          description: "Priority level (optional, default: none)",
        },
        initiativeId: {
          type: "string",
          description: "Link to a yearly initiative ID (optional)",
        },
      },
      required: ["name", "key"],
    },
  },
  {
    name: "update_project",
    description: "Update a project's details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        projectIdOrKey: {
          type: "string",
          description: "Project ID or key like 'ACME' (required)",
        },
        name: {
          type: "string",
          description: "Updated name (optional)",
        },
        description: {
          type: "string",
          description: "Updated description (optional)",
        },
        status: {
          type: "string",
          enum: ["planned", "in_progress", "paused", "completed", "cancelled"],
          description: "Updated status (optional)",
        },
        health: {
          type: "string",
          enum: ["on_track", "at_risk", "off_track"],
          description: "Updated health status (optional)",
        },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low", "none"],
          description: "Updated priority (optional)",
        },
        clientId: {
          type: "string",
          description:
            "Associate with a client ID, or empty to unlink (optional)",
        },
        initiativeId: {
          type: "string",
          description:
            "Link to a yearly initiative ID, or empty to unlink (optional)",
        },
      },
      required: ["projectIdOrKey"],
    },
  },
  {
    name: "delete_project",
    description:
      "Delete a project. Issues are preserved but unlinked from the project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        projectIdOrKey: {
          type: "string",
          description: "Project ID or key like 'ACME' (required)",
        },
      },
      required: ["projectIdOrKey"],
    },
  },
  {
    name: "get_tasks",
    description:
      "Get tasks/issues with optional filters. Use this to list tasks in a project or by status/priority.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        projectId: {
          type: "string",
          description: "Filter by project ID",
        },
        status: {
          type: "string",
          enum: [
            "backlog",
            "todo",
            "in_progress",
            "in_review",
            "done",
            "cancelled",
          ],
          description: "Filter by task status",
        },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low", "none"],
          description: "Filter by priority level",
        },
        limit: {
          type: "number",
          description: "Max results (default 50, max 100)",
        },
      },
    },
  },
  {
    name: "get_todays_tasks",
    description:
      "Get today's tasks including tasks due today and top priority items. Best for daily planning.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
      },
    },
  },
  {
    name: "get_overdue_tasks",
    description:
      "Get overdue tasks that are past due and still open. Best for surfacing slipped work explicitly.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        date: {
          type: "string",
          description:
            "Specific date in ISO format used as the overdue cutoff (optional, default: today)",
        },
      },
    },
  },
  {
    name: "create_issue",
    description:
      "Create a new task/issue. Assign to a project (by key like 'KORT') and optionally a phase (by name like 'Building Foundation' or by ID). Set priority, due date, calendar start/end time, cycle, and initiative.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        title: {
          type: "string",
          description: "The task title (required)",
        },
        description: {
          type: "string",
          description: "Detailed description (optional)",
        },
        projectIdOrKey: {
          type: "string",
          description:
            "Project ID or key like 'KORT'. Required if assigning to a phase by name.",
        },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low", "none"],
          description: "Priority level (optional, default: none)",
        },
        dueDate: {
          type: "string",
          description: "Due date in ISO format like '2024-01-15' (optional)",
        },
        scheduledStartAt: {
          type: "string",
          description:
            "First issue calendar block start datetime in ISO format like '2026-05-18T09:00:00-07:00' (optional, separate from dueDate)",
        },
        scheduledEndAt: {
          type: "string",
          description:
            "First issue calendar block end datetime in ISO format like '2026-05-18T10:30:00-07:00' (optional, required when scheduledStartAt is provided)",
        },
        scheduledTimezone: {
          type: "string",
          description:
            "IANA timezone for the issue calendar block, e.g. 'America/Los_Angeles' (optional)",
        },
        cycleId: {
          type: "string",
          description: "Assign to a specific cycle (optional)",
        },
        phaseNameOrId: {
          type: "string",
          description:
            "Phase name (e.g. 'Building Foundation') or phase ID. Resolved within the project specified by projectIdOrKey. Preferred over phaseId.",
        },
        phaseId: {
          type: "string",
          description: "Phase ID (deprecated, use phaseNameOrId instead)",
        },
        initiativeId: {
          type: "string",
          description: "Link directly to a yearly initiative ID (optional)",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "mark_issue_complete",
    description:
      "Mark a task as complete. Accepts issue ID or identifier like 'PROJ-123'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        issueIdOrIdentifier: {
          type: "string",
          description: "Issue ID or identifier like PROJ-123 (required)",
        },
      },
      required: ["issueIdOrIdentifier"],
    },
  },
  {
    name: "get_issue",
    description:
      "Get a single issue/task's full details. Accepts issue ID or identifier like 'PROJ-123'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        issueIdOrIdentifier: {
          type: "string",
          description: "Issue ID or identifier like PROJ-123 (required)",
        },
      },
      required: ["issueIdOrIdentifier"],
    },
  },
  {
    name: "update_issue",
    description:
      "Update an issue/task's details. Accepts issue ID or identifier like 'PROJ-123'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        issueIdOrIdentifier: {
          type: "string",
          description: "Issue ID or identifier like PROJ-123 (required)",
        },
        title: {
          type: "string",
          description: "Updated title (optional)",
        },
        description: {
          type: "string",
          description: "Updated description (optional)",
        },
        status: {
          type: "string",
          enum: [
            "backlog",
            "todo",
            "in_progress",
            "in_review",
            "done",
            "cancelled",
          ],
          description: "Updated status (optional)",
        },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low", "none"],
          description: "Updated priority (optional)",
        },
        dueDate: {
          type: "string",
          description: "Due date in ISO format, or empty to clear (optional)",
        },
        scheduledStartAt: {
          type: "string",
          description:
            "Legacy calendar start datetime. Prefer apply_planning_patch schedule_issue to add issue calendar blocks.",
        },
        scheduledEndAt: {
          type: "string",
          description:
            "Legacy calendar end datetime. Prefer apply_planning_patch schedule_issue to add issue calendar blocks.",
        },
        scheduledTimezone: {
          type: "string",
          description:
            "IANA timezone for the scheduled block, e.g. 'America/Los_Angeles' (optional)",
        },
        clearScheduledTime: {
          type: "boolean",
          description: "Clear the task's calendar start/end time (optional)",
        },
        isTopPriority: {
          type: "boolean",
          description: "Mark as top priority (optional)",
        },
        initiativeId: {
          type: "string",
          description:
            "Link to a yearly initiative ID, or empty to unlink (optional)",
        },
        estimate: {
          type: "number",
          description: "Story points / sprint points (optional)",
        },
        labelIds: {
          type: "array",
          items: { type: "string" },
          description:
            "Array of label IDs to set on the issue (replaces existing labels) (optional)",
        },
      },
      required: ["issueIdOrIdentifier"],
    },
  },
  {
    name: "delete_issue",
    description:
      "Delete an issue/task permanently. Accepts issue ID or identifier like 'PROJ-123'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        issueIdOrIdentifier: {
          type: "string",
          description: "Issue ID or identifier like PROJ-123 (required)",
        },
      },
      required: ["issueIdOrIdentifier"],
    },
  },

  // Label Management Tools
  {
    name: "get_labels",
    description:
      "Get all labels for the user. Can filter by project or get workspace-wide labels.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        projectId: {
          type: "string",
          description: "Filter by project ID (optional)",
        },
        includeWorkspaceLabels: {
          type: "boolean",
          description:
            "Include workspace-wide labels when filtering by project (default: false)",
        },
      },
    },
  },
  {
    name: "create_label",
    description: "Create a new label with a name and color.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        name: {
          type: "string",
          description: "Label name (required)",
        },
        color: {
          type: "string",
          description: "Hex color code, e.g., #ef4444 (required)",
        },
        description: {
          type: "string",
          description: "Label description (optional)",
        },
        projectId: {
          type: "string",
          description:
            "Project ID to scope label to (optional - omit for workspace-wide)",
        },
      },
      required: ["name", "color"],
    },
  },
  {
    name: "update_label",
    description: "Update an existing label's name, color, or description.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        labelId: {
          type: "string",
          description: "Label ID (required)",
        },
        name: {
          type: "string",
          description: "Updated name (optional)",
        },
        color: {
          type: "string",
          description: "Updated hex color (optional)",
        },
        description: {
          type: "string",
          description: "Updated description (optional)",
        },
      },
      required: ["labelId"],
    },
  },
  {
    name: "delete_label",
    description: "Delete a label and remove it from all issues.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        labelId: {
          type: "string",
          description: "Label ID to delete (required)",
        },
      },
      required: ["labelId"],
    },
  },

  // Cycle/Sprint Tools
  {
    name: "get_current_cycle",
    description:
      "Get the currently active cycle/sprint with progress stats and top priority issues.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
      },
    },
  },
  {
    name: "assign_issue_to_cycle",
    description:
      "Assign a task to a cycle. Defaults to current active cycle if no cycleId provided.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        issueIdOrIdentifier: {
          type: "string",
          description: "Issue ID or identifier like PROJ-123 (required)",
        },
        cycleId: {
          type: "string",
          description: "Cycle ID (optional, defaults to active cycle)",
        },
      },
      required: ["issueIdOrIdentifier"],
    },
  },
  {
    name: "get_cycles",
    description: "Get all cycles/sprints for the user with stats and progress.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        status: {
          type: "string",
          enum: ["upcoming", "active", "completed"],
          description: "Filter by cycle status (optional)",
        },
        limit: {
          type: "number",
          description: "Max results (default 20)",
        },
      },
    },
  },
  {
    name: "create_cycle",
    description: "Create a new cycle/sprint.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        name: {
          type: "string",
          description: "Cycle name (optional, defaults to 'Cycle N')",
        },
        startDate: {
          type: "string",
          description: "Start date in ISO format like '2024-01-15' (required)",
        },
        endDate: {
          type: "string",
          description: "End date in ISO format like '2024-01-29' (required)",
        },
        goals: {
          type: "string",
          description: "Cycle goals/objectives (optional)",
        },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "update_cycle",
    description: "Update a cycle's details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        cycleId: {
          type: "string",
          description: "Cycle ID (required)",
        },
        name: {
          type: "string",
          description: "Updated name (optional)",
        },
        startDate: {
          type: "string",
          description: "Updated start date in ISO format (optional)",
        },
        endDate: {
          type: "string",
          description: "Updated end date in ISO format (optional)",
        },
        status: {
          type: "string",
          enum: ["upcoming", "active", "completed"],
          description: "Updated status (optional)",
        },
        goals: {
          type: "string",
          description: "Updated goals (optional)",
        },
        whatWentWell: {
          type: "string",
          description: "Retrospective notes on what went well (optional)",
        },
        whatCouldImprove: {
          type: "string",
          description: "Retrospective notes on what could improve (optional)",
        },
        actionItems: {
          type: "array",
          items: { type: "string" },
          description: "Retrospective action items (optional)",
        },
      },
      required: ["cycleId"],
    },
  },
  {
    name: "delete_cycle",
    description:
      "Delete a cycle. Issues in the cycle are unlinked (not deleted).",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        cycleId: {
          type: "string",
          description: "Cycle ID (required)",
        },
      },
      required: ["cycleId"],
    },
  },
  {
    name: "close_cycle",
    description:
      "Close/complete a cycle. Optionally rolls over incomplete issues (not done/cancelled) to the next upcoming cycle. If rolloverIncomplete is not specified, uses the user's autoRolloverIncompleteIssues setting.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        cycleId: {
          type: "string",
          description: "Cycle ID to close (required)",
        },
        rolloverIncomplete: {
          type: "boolean",
          description:
            "If true, move incomplete issues to the next cycle. If omitted, uses user's auto-rollover setting.",
        },
      },
      required: ["cycleId"],
    },
  },
  {
    name: "generate_cycles",
    description:
      "Generate upcoming cycles based on the user's cycle settings (duration, start day, timezone). Creates cycles starting after the latest existing cycle.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        count: {
          type: "number",
          description:
            "Number of cycles to generate (optional, defaults to user's defaultCyclesToCreate setting)",
        },
      },
    },
  },

  // Agenda Tools
  {
    name: "get_daily_agenda",
    description:
      "Get today's full agenda: tasks due today, calendar events, top priorities, and Daily AI Comments.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        date: {
          type: "string",
          description: "Specific date in ISO format (optional, default: today)",
        },
      },
    },
  },
  {
    name: "get_daily_ai_comments",
    description:
      "Get AI-authored markdown comments for a specific Agenda day. Humans do not edit this surface.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        date: {
          type: "string",
          description: "Target day in YYYY-MM-DD format",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "add_daily_ai_comment",
    description:
      "Append an AI-authored markdown comment to a specific Agenda day.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        date: {
          type: "string",
          description: "Target day in YYYY-MM-DD format",
        },
        body: {
          type: "string",
          description: "Markdown comment body",
        },
        source: {
          type: "string",
          description: "Agent, workflow, or integration name (optional)",
        },
      },
      required: ["date", "body"],
    },
  },
  {
    name: "get_weekly_agenda",
    description:
      "Get weekly agenda: tasks and events for the next 7 days, plus AI weekly summary and Weekly AI Comments.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        startDate: {
          type: "string",
          description: "Start date in ISO format (optional, default: today)",
        },
      },
    },
  },
  {
    name: "get_weekly_ai_comments",
    description:
      "Get AI-authored markdown comments for a specific Agenda week. Humans do not edit this surface.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        weekStartDate: {
          type: "string",
          description: "Monday week start date in YYYY-MM-DD format",
        },
      },
      required: ["weekStartDate"],
    },
  },
  {
    name: "add_weekly_ai_comment",
    description:
      "Append an AI-authored markdown comment to a specific Agenda week.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        weekStartDate: {
          type: "string",
          description: "Monday week start date in YYYY-MM-DD format",
        },
        body: {
          type: "string",
          description: "Markdown comment body",
        },
        source: {
          type: "string",
          description: "Agent, workflow, or integration name (optional)",
        },
      },
      required: ["weekStartDate", "body"],
    },
  },
  {
    name: "get_monthly_agenda",
    description:
      "Get monthly agenda: tasks and events for the month, plus AI monthly summary and Monthly AI Comments.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        monthStartDate: {
          type: "string",
          description:
            "First day of month in ISO format like '2024-01-01' (optional, default: current month)",
        },
      },
    },
  },
  {
    name: "get_monthly_ai_comments",
    description:
      "Get AI-authored markdown comments for a specific Agenda month. Humans do not edit this surface.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        monthStartDate: {
          type: "string",
          description: "Month start date in YYYY-MM-DD format, usually the 1st",
        },
      },
      required: ["monthStartDate"],
    },
  },
  {
    name: "add_monthly_ai_comment",
    description:
      "Append an AI-authored markdown comment to a specific Agenda month.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        monthStartDate: {
          type: "string",
          description: "Month start date in YYYY-MM-DD format, usually the 1st",
        },
        body: {
          type: "string",
          description: "Markdown comment body",
        },
        source: {
          type: "string",
          description: "Agent, workflow, or integration name (optional)",
        },
      },
      required: ["monthStartDate", "body"],
    },
  },
  {
    name: "get_planning_context",
    description:
      "Get full planning context for day/week/current cycle. Mirrors the LifeOS Agenda daily tab plus current cycle, backlog, habits, daily fields, calendar, protected non-ticket calendar blocks, and notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        date: {
          type: "string",
          description: "Target day in YYYY-MM-DD format (optional)",
        },
        weekStartDate: {
          type: "string",
          description: "Week start date in YYYY-MM-DD format (optional)",
        },
        include: {
          type: "object",
          description:
            "Optional include flags for daily, weekly, currentCycle, backlog, habits, dailyFields, calendar, voiceMemos",
          properties: {
            daily: { type: "boolean" },
            weekly: { type: "boolean" },
            currentCycle: { type: "boolean" },
            backlog: { type: "boolean" },
            habits: { type: "boolean" },
            dailyFields: { type: "boolean" },
            calendar: { type: "boolean" },
            voiceMemos: { type: "boolean" },
          },
        },
      },
    },
  },
  {
    name: "apply_planning_patch",
    description:
      "Apply an agent-generated day/week/cycle planning patch. Mutates tasks, due dates, issue calendar blocks, protected non-ticket calendar blocks, top priorities, current cycle goals/assignments, daily fields, issue comments, Daily AI Comments, Weekly AI Comments, and daily/weekly notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        mode: {
          type: "string",
          enum: ["day", "week", "cycle"],
          description: "Planning mode for the patch",
        },
        date: {
          type: "string",
          description: "Target day in YYYY-MM-DD format (optional)",
        },
        weekStartDate: {
          type: "string",
          description: "Week start date in YYYY-MM-DD format (optional)",
        },
        dryRun: {
          type: "boolean",
          description:
            "Preview operations without mutating data. Use false when the user asked to plan/apply.",
        },
        operations: {
          type: "array",
          description:
            "Operations to apply. Supported types: create_issue, create_calendar_block, update_issue, schedule_issue, assign_issue_to_current_cycle, set_top_priority, mark_issue_status, save_daily_note, save_weekly_note, set_daily_field, update_cycle_goals, add_issue_comment, add_daily_ai_comment, add_weekly_ai_comment. dueDate is the issue deadline/day assignment. schedule_issue adds one issue calendar block and can be repeated for multiple blocks.",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "create_issue",
                  "create_calendar_block",
                  "update_issue",
                  "schedule_issue",
                  "assign_issue_to_current_cycle",
                  "set_top_priority",
                  "mark_issue_status",
                  "save_daily_note",
                  "save_weekly_note",
                  "set_daily_field",
                  "update_cycle_goals",
                  "add_issue_comment",
                  "add_daily_ai_comment",
                  "add_weekly_ai_comment",
                ],
              },
              payload: {
                type: "object",
                description:
                  "Operation-specific payload. Use issueIdOrIdentifier for existing tasks, dueDate for day assignment/deadlines, and schedule_issue with scheduledStartAt/scheduledEndAt or date plus startTime/endTime to add an issue calendar block. Use create_calendar_block with title, timezone, and either startAt/endAt ISO datetimes or date plus startTime/endTime for protected calendar-only blocks that must not create an issue.",
              },
            },
            required: ["type", "payload"],
          },
        },
      },
      required: ["mode", "operations"],
    },
  },
  {
    name: "create_calendar_block",
    description:
      "Create a protected LifeOS calendar-only block without creating a PM issue or Google-synced event. Use this for non-ticket time like dog walking, meals, errands, personal appointments, or holds.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        title: {
          type: "string",
          description: "Block title, e.g. Dog walking",
        },
        description: {
          type: "string",
          description: "Optional description",
        },
        location: {
          type: "string",
          description: "Optional location",
        },
        startAt: {
          type: "string",
          description:
            "ISO datetime start, e.g. 2026-05-18T16:00:00-06:00. Alternative to date/startTime.",
        },
        endAt: {
          type: "string",
          description:
            "ISO datetime end, e.g. 2026-05-18T18:00:00-06:00. Alternative to date/endTime.",
        },
        date: {
          type: "string",
          description:
            "YYYY-MM-DD date when using local clock startTime/endTime",
        },
        startTime: {
          type: "string",
          description: "Local HH:mm start time, e.g. 16:00",
        },
        endTime: {
          type: "string",
          description: "Local HH:mm end time, e.g. 18:00",
        },
        timezone: {
          type: "string",
          description: "IANA timezone, e.g. America/Denver",
        },
        blockType: {
          type: "string",
          enum: [
            "protected_time",
            "personal",
            "focus",
            "appointment",
            "travel",
            "hold",
            "other",
          ],
          description: "Block type metadata (optional, default protected_time)",
        },
        source: {
          type: "string",
          enum: ["agent", "manual", "system", "import"],
          description: "Source metadata (optional, default agent)",
        },
        sourceDetail: {
          type: "string",
          description: "Optional agent/workflow name or source note",
        },
        isProtected: {
          type: "boolean",
          description: "Whether agents should protect this time (default true)",
        },
      },
      required: ["title", "timezone"],
    },
  },
  {
    name: "regenerate_daily_summary",
    description: "Regenerate the AI summary for a specific day.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        date: {
          type: "string",
          description: "Date in ISO format like '2024-01-15' (required)",
        },
        model: {
          type: "string",
          description:
            "AI model to use (optional, default: google/gemini-3-flash)",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "regenerate_weekly_summary",
    description: "Regenerate the AI summary for a specific week.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        weekStartDate: {
          type: "string",
          description:
            "Monday of the week in ISO format like '2024-01-15' (required)",
        },
        model: {
          type: "string",
          description:
            "AI model to use (optional, default: google/gemini-3-flash)",
        },
      },
      required: ["weekStartDate"],
    },
  },
  {
    name: "regenerate_monthly_summary",
    description: "Regenerate the AI summary for a specific month.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        monthStartDate: {
          type: "string",
          description:
            "First day of month in ISO format like '2024-01-01' (required)",
        },
        model: {
          type: "string",
          description:
            "AI model to use (optional, default: google/gemini-3-flash)",
        },
      },
      required: ["monthStartDate"],
    },
  },
  {
    name: "update_weekly_prompt",
    description:
      "Update the custom prompt used for generating weekly summaries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        weekStartDate: {
          type: "string",
          description:
            "Monday of the week in ISO format like '2024-01-15' (required)",
        },
        customPrompt: {
          type: "string",
          description:
            "Custom prompt template for AI summary generation (required)",
        },
      },
      required: ["weekStartDate", "customPrompt"],
    },
  },
  {
    name: "update_monthly_prompt",
    description:
      "Update the custom prompt used for generating monthly summaries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        monthStartDate: {
          type: "string",
          description:
            "First day of month in ISO format like '2024-01-01' (required)",
        },
        customPrompt: {
          type: "string",
          description:
            "Custom prompt template for AI summary generation (required)",
        },
      },
      required: ["monthStartDate", "customPrompt"],
    },
  },

  // Notes Tools
  {
    name: "search_notes",
    description: "Search voice memos/notes by content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        query: {
          type: "string",
          description: "Search terms to find in notes (required)",
        },
        limit: {
          type: "number",
          description: "Max results (default 10, max 50)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_recent_notes",
    description: "Get recent voice memos/notes with transcripts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        limit: {
          type: "number",
          description: "Number of notes to return (default 5, max 20)",
        },
      },
    },
  },
  {
    name: "create_quick_note",
    description: "Create a quick text note. Useful for capturing thoughts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        content: {
          type: "string",
          description: "The note content (required)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for categorization (optional)",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "add_tags_to_note",
    description: "Add tags to an existing note.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        noteId: {
          type: "string",
          description: "The note ID (required)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags to add (required)",
        },
      },
      required: ["noteId", "tags"],
    },
  },
  {
    name: "get_personal_records",
    description:
      "List Personal Records with previews, tags, and metadata. Use this to discover available private atomic records.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        includeArchived: {
          type: "boolean",
          description: "Include archived records (default false)",
        },
        tag: {
          type: "string",
          description: "Exact tag filter (optional)",
        },
        limit: {
          type: "number",
          description: "Max results (default 20, max 100)",
        },
      },
    },
  },
  {
    name: "get_personal_record",
    description:
      "Get one Personal Record with full markdown body and attachment metadata.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        recordId: {
          type: "string",
          description: "Personal Record ID (required)",
        },
      },
      required: ["recordId"],
    },
  },
  {
    name: "search_personal_records",
    description:
      "Search Personal Records by title, tags, and markdown body. Use for broad discovery.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        query: {
          type: "string",
          description: "Search query (required)",
        },
        includeArchived: {
          type: "boolean",
          description: "Include archived records (default false)",
        },
        limit: {
          type: "number",
          description: "Max results (default 10, max 50)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "retrieve_personal_records",
    description:
      "RAG retrieval over Personal Records. Returns ranked snippets and source metadata for private agent context.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        query: {
          type: "string",
          description: "Retrieval query (required)",
        },
        includeArchived: {
          type: "boolean",
          description: "Include archived records (default false)",
        },
        limit: {
          type: "number",
          description: "Max snippets (default 6, max 20)",
        },
        maxSnippetChars: {
          type: "number",
          description: "Snippet character cap (default 1200, max 3000)",
        },
      },
      required: ["query"],
    },
  },

  // Voice Notes Deep Dive Tools
  {
    name: "get_voice_memo",
    description:
      "Get a single voice memo with full details including transcript and AI extraction (summary, labels, action items, key points, sentiment).",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        memoId: {
          type: "string",
          description: "The voice memo ID (required)",
        },
      },
      required: ["memoId"],
    },
  },
  {
    name: "get_voice_memos_by_date",
    description:
      "Get voice memos within a date range, including transcripts and AI extractions. Great for reviewing notes from a specific time period.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        startDate: {
          type: "string",
          description: "Start date in ISO format like '2024-01-15' (required)",
        },
        endDate: {
          type: "string",
          description: "End date in ISO format like '2024-01-22' (required)",
        },
        limit: {
          type: "number",
          description: "Max results (default 50, max 100)",
        },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "get_voice_memos_by_labels",
    description:
      "Get voice memos filtered by labels/topics, memo tags, and summarized status, sorted newest-first. Label matching falls back to memo transcript/name text when AI label extraction lags.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description:
            "Labels/topics to search for (optional). Matching is fuzzy/partial and also checks transcript/name text.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Memo tags to filter on (optional). Matching is case-insensitive exact tag matching, and any requested tag matches.",
        },
        isSummarized: {
          type: "boolean",
          description:
            "Optional summarized-status filter. true = only memos already referenced by AI summaries, false = only memos not yet summarized.",
        },
        limit: {
          type: "number",
          description: "Page size (default 50, max 100)",
        },
        offset: {
          type: "number",
          description: "Pagination offset (default 0)",
        },
      },
    },
  },
  {
    name: "get_voice_memo_labels",
    description:
      "Get all unique labels from voice memo AI extractions with counts. Use this to discover what topics exist in voice notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
      },
    },
  },

  // AI Conversation Summary Tools (Crystallization)
  {
    name: "create_ai_convo_summary",
    description:
      "Save a crystallized summary from an AI conversation about voice notes. Use this to preserve insights, plans, and ideas from discussing notes with the AI.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        title: {
          type: "string",
          description: "Title for this summary (required)",
        },
        summary: {
          type: "string",
          description:
            "The main summary/insights from the conversation (required)",
        },
        keyInsights: {
          type: "array",
          items: { type: "string" },
          description:
            "Key insights extracted from the conversation (optional)",
        },
        actionItems: {
          type: "array",
          items: { type: "string" },
          description:
            "Action items that emerged from the conversation (optional)",
        },
        ideas: {
          type: "array",
          items: { type: "string" },
          description: "New ideas or plans formulated (optional)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for categorization (optional)",
        },
        relatedMemoIds: {
          type: "array",
          items: { type: "string" },
          description:
            "IDs of voice memos discussed in this conversation (optional)",
        },
        summaryType: {
          type: "string",
          description:
            "Type of summary: reflection, planning, brainstorm, journal_review, idea_refinement (optional)",
        },
        conversationContext: {
          type: "string",
          description:
            "The topic/context of the conversation that led to this summary (optional)",
        },
        rawConversation: {
          type: "string",
          description:
            "Raw conversation transcript as a JSON string (optional)",
        },
      },
      required: ["title", "summary"],
    },
  },
  {
    name: "create_voice_notes_aggregate_ai_summary",
    description:
      "Create an aggregate AI summary across multiple voice notes. Citations are links from voice notes to the aggregate summary.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        title: {
          type: "string",
          description: "Title for this aggregate summary (required)",
        },
        summary: {
          type: "string",
          description: "Aggregate AI summary text (required)",
        },
        sourceAgent: {
          type: "string",
          description:
            "Agent/tool that generated this summary, e.g. codex or hermes (optional)",
        },
        summaryType: {
          type: "string",
          description: "Type/category for this aggregate summary (optional)",
        },
        keyInsights: {
          type: "array",
          items: { type: "string" },
          description: "Key insights (optional)",
        },
        actionItems: {
          type: "array",
          items: { type: "string" },
          description: "Action items (optional)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags (optional)",
        },
        memoDateRange: {
          type: "object",
          description: "Start/end timestamps for summarized memos (optional)",
          properties: {
            start: { type: "number" },
            end: { type: "number" },
          },
        },
        citations: {
          type: "array",
          description:
            "Voice-note citation links for this aggregate summary (required)",
          items: {
            type: "object",
            properties: {
              voiceMemoId: { type: "string" },
              label: { type: "string" },
              excerpt: { type: "string" },
            },
            required: ["voiceMemoId"],
          },
        },
      },
      required: ["title", "summary", "citations"],
    },
  },
  {
    name: "get_voice_notes_aggregate_ai_summaries",
    description: "List aggregate AI summaries across multiple voice notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        summaryType: {
          type: "string",
          description: "Filter by type/category (optional)",
        },
        limit: {
          type: "number",
          description: "Max results (default 20, max 50)",
        },
      },
    },
  },
  {
    name: "get_voice_notes_aggregate_ai_summary",
    description:
      "Get one aggregate AI summary with linked voice-note citations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        summaryId: {
          type: "string",
          description: "Aggregate summary ID (required)",
        },
      },
      required: ["summaryId"],
    },
  },
  {
    name: "search_voice_notes_aggregate_ai_summaries",
    description: "Search aggregate AI summaries by content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        query: {
          type: "string",
          description: "Search terms (required)",
        },
        limit: {
          type: "number",
          description: "Max results (default 10, max 50)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_ai_convo_summaries",
    description:
      "Get past AI conversation summaries. Use this to review previous crystallized insights from voice note discussions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        summaryType: {
          type: "string",
          description:
            "Filter by type: reflection, planning, brainstorm, journal_review (optional)",
        },
        limit: {
          type: "number",
          description: "Max results (default 20, max 50)",
        },
      },
    },
  },
  {
    name: "get_ai_convo_summary",
    description:
      "Get a single AI conversation summary with full details including related memo information.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        summaryId: {
          type: "string",
          description: "The summary ID (required)",
        },
      },
      required: ["summaryId"],
    },
  },
  {
    name: "search_ai_convo_summaries",
    description: "Search AI conversation summaries by content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        query: {
          type: "string",
          description: "Search terms to find in summaries (required)",
        },
        limit: {
          type: "number",
          description: "Max results (default 10, max 50)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "update_ai_convo_summary",
    description: "Update an existing AI conversation summary.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        summaryId: {
          type: "string",
          description: "The summary ID (required)",
        },
        title: {
          type: "string",
          description: "Updated title (optional)",
        },
        summary: {
          type: "string",
          description: "Updated summary (optional)",
        },
        keyInsights: {
          type: "array",
          items: { type: "string" },
          description: "Updated key insights (optional)",
        },
        actionItems: {
          type: "array",
          items: { type: "string" },
          description: "Updated action items (optional)",
        },
        ideas: {
          type: "array",
          items: { type: "string" },
          description: "Updated ideas (optional)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Updated tags (optional)",
        },
      },
      required: ["summaryId"],
    },
  },
  {
    name: "delete_ai_convo_summary",
    description: "Delete an AI conversation summary.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        summaryId: {
          type: "string",
          description: "The summary ID (required)",
        },
      },
      required: ["summaryId"],
    },
  },

  // FRM (Friend Relationship Management) Tools
  {
    name: "get_people",
    description:
      "Get all contacts/people with optional filters. Use this to list all your contacts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        relationshipType: {
          type: "string",
          enum: [
            "family",
            "friend",
            "colleague",
            "acquaintance",
            "mentor",
            "other",
          ],
          description: "Filter by relationship type",
        },
        includeArchived: {
          type: "boolean",
          description: "Include archived people (default: false)",
        },
        limit: {
          type: "number",
          description: "Max results (default 100)",
        },
      },
    },
  },
  {
    name: "get_person",
    description:
      "Get a single person's details with their AI-generated profile including communication style, personality insights, and relationship tips.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        personId: {
          type: "string",
          description: "The person's ID (required)",
        },
      },
      required: ["personId"],
    },
  },
  {
    name: "search_people",
    description: "Search contacts by name using full-text search.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        query: {
          type: "string",
          description: "Search terms to find in names (required)",
        },
        limit: {
          type: "number",
          description: "Max results (default 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_memos_for_person",
    description:
      "Get all voice memos linked to a specific person. Shows the transcripts and context for each memo.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        personId: {
          type: "string",
          description: "The person's ID (required)",
        },
        limit: {
          type: "number",
          description: "Max results (default 50)",
        },
      },
      required: ["personId"],
    },
  },
  {
    name: "get_person_timeline",
    description:
      "Get interaction timeline for a person or all people. Shows voice memos and notes chronologically.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        personId: {
          type: "string",
          description: "Filter to specific person (omit for all)",
        },
        limit: {
          type: "number",
          description: "Max results (default 50)",
        },
      },
    },
  },
  {
    name: "create_person",
    description: "Create a new contact/person.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        name: {
          type: "string",
          description: "The person's name (required)",
        },
        nickname: {
          type: "string",
          description: "Nickname or alias (optional)",
        },
        relationshipType: {
          type: "string",
          enum: [
            "family",
            "friend",
            "colleague",
            "acquaintance",
            "mentor",
            "other",
          ],
          description: "Relationship type (optional)",
        },
        avatarEmoji: {
          type: "string",
          description: "Emoji to represent this person (optional)",
        },
        notes: {
          type: "string",
          description: "User notes about this person (optional)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "update_person",
    description: "Update a contact's details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        personId: {
          type: "string",
          description: "The person's ID (required)",
        },
        name: {
          type: "string",
          description: "Updated name (optional)",
        },
        nickname: {
          type: "string",
          description: "Updated nickname (optional)",
        },
        relationshipType: {
          type: "string",
          enum: [
            "family",
            "friend",
            "colleague",
            "acquaintance",
            "mentor",
            "other",
          ],
          description: "Updated relationship type (optional)",
        },
        email: {
          type: "string",
          description: "Email address (optional)",
        },
        phone: {
          type: "string",
          description: "Phone number (optional)",
        },
        notes: {
          type: "string",
          description: "Updated notes (optional)",
        },
      },
      required: ["personId"],
    },
  },
  {
    name: "link_memo_to_person",
    description: "Link a voice memo to a person.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        personId: {
          type: "string",
          description: "The person's ID (required)",
        },
        voiceMemoId: {
          type: "string",
          description: "The voice memo's ID (required)",
        },
        context: {
          type: "string",
          description:
            "Context for the link, e.g., 'Phone call', 'Coffee meetup' (optional)",
        },
      },
      required: ["personId", "voiceMemoId"],
    },
  },

  // Client Management Tools
  {
    name: "get_clients",
    description:
      "Get all clients for consulting/freelance work with optional status filter.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        status: {
          type: "string",
          enum: ["active", "archived"],
          description: "Filter by status (optional)",
        },
      },
    },
  },
  {
    name: "get_client",
    description: "Get a single client's details with project statistics.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        clientId: {
          type: "string",
          description: "The client's ID (required)",
        },
      },
      required: ["clientId"],
    },
  },
  {
    name: "get_projects_for_client",
    description:
      "Get all projects associated with a client, including completion stats.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        clientId: {
          type: "string",
          description: "The client's ID (required)",
        },
      },
      required: ["clientId"],
    },
  },
  {
    name: "get_client_notes",
    description:
      "Get client/project/phase notes for customer requirements and account context.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        clientId: {
          type: "string",
          description: "Filter by client ID (optional)",
        },
        projectId: {
          type: "string",
          description: "Filter by project ID (optional)",
        },
        phaseId: {
          type: "string",
          description: "Filter by phase ID (optional)",
        },
        limit: {
          type: "number",
          description: "Max results (default 20, max 100)",
        },
      },
    },
  },
  {
    name: "get_client_note",
    description: "Get a single client/project/phase note with linked context.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        noteId: {
          type: "string",
          description: "The note ID (required)",
        },
      },
      required: ["noteId"],
    },
  },
  {
    name: "create_client_note",
    description:
      "Create a note for a client, project, or phase to track customer requirements and follow-ups.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        title: {
          type: "string",
          description: "Short note title (required)",
        },
        content: {
          type: "string",
          description: "Note content (required)",
        },
        clientId: {
          type: "string",
          description: "Link to a client (optional)",
        },
        projectId: {
          type: "string",
          description: "Link to a project (optional)",
        },
        phaseId: {
          type: "string",
          description: "Link to a phase (optional)",
        },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "update_client_note",
    description: "Update an existing client/project/phase note.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        noteId: {
          type: "string",
          description: "The note ID (required)",
        },
        title: {
          type: "string",
          description: "Updated title (optional)",
        },
        content: {
          type: "string",
          description: "Updated content (optional)",
        },
        clientId: {
          type: "string",
          description: "Updated client ID, or empty to unlink (optional)",
        },
        projectId: {
          type: "string",
          description: "Updated project ID, or empty to unlink (optional)",
        },
        phaseId: {
          type: "string",
          description: "Updated phase ID, or empty to unlink (optional)",
        },
      },
      required: ["noteId"],
    },
  },
  {
    name: "delete_client_note",
    description: "Delete a client/project/phase note.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        noteId: {
          type: "string",
          description: "The note ID (required)",
        },
      },
      required: ["noteId"],
    },
  },
  {
    name: "create_client",
    description: "Create a new client for consulting/freelance work.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        name: {
          type: "string",
          description: "The client's name (required)",
        },
        description: {
          type: "string",
          description: "Description of the client (optional)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "update_client",
    description: "Update a client's details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        clientId: {
          type: "string",
          description: "The client's ID (required)",
        },
        name: {
          type: "string",
          description: "Updated name (optional)",
        },
        description: {
          type: "string",
          description: "Updated description (optional)",
        },
        status: {
          type: "string",
          enum: ["active", "archived"],
          description: "Updated status (optional)",
        },
      },
      required: ["clientId"],
    },
  },
  {
    name: "delete_client",
    description: "Delete a client. Projects are unlinked (not deleted).",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        clientId: {
          type: "string",
          description: "The client's ID (required)",
        },
      },
      required: ["clientId"],
    },
  },

  // Phase Management Tools
  {
    name: "get_phases",
    description:
      "Get all phases for a project with issue stats. Use this to see project breakdown by phases.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        projectId: {
          type: "string",
          description: "The project's ID (required)",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_phase",
    description:
      "Get a single phase with its issues. Use this to see phase details and issues assigned to it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        phaseId: {
          type: "string",
          description: "The phase's ID (required)",
        },
      },
      required: ["phaseId"],
    },
  },
  {
    name: "create_phase",
    description:
      "Create a new phase in a project. Use this to organize project work into distinct stages.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        projectId: {
          type: "string",
          description: "The project's ID (required)",
        },
        name: {
          type: "string",
          description: "The phase name (required)",
        },
        description: {
          type: "string",
          description:
            "Phase description in tiptap HTML format (e.g., '<p>Phase description here</p>'). Do NOT use JSON format. (optional)",
        },
        status: {
          type: "string",
          enum: ["not_started", "in_progress", "completed"],
          description: "Phase status (optional, default: not_started)",
        },
      },
      required: ["projectId", "name"],
    },
  },
  {
    name: "update_phase",
    description: "Update a phase's details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        phaseId: {
          type: "string",
          description: "The phase's ID (required)",
        },
        name: {
          type: "string",
          description: "Updated name (optional)",
        },
        description: {
          type: "string",
          description:
            "Updated description in tiptap HTML format (e.g., '<p>Updated description here</p>'). Do NOT use JSON format. (optional)",
        },
        status: {
          type: "string",
          enum: ["not_started", "in_progress", "completed"],
          description: "Updated status (optional)",
        },
        startDate: {
          type: "string",
          description: "Start date in ISO format (optional)",
        },
        endDate: {
          type: "string",
          description: "End date in ISO format (optional)",
        },
      },
      required: ["phaseId"],
    },
  },
  {
    name: "delete_phase",
    description:
      "Delete a phase. Issues in the phase are unlinked (not deleted).",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        phaseId: {
          type: "string",
          description: "The phase's ID (required)",
        },
      },
      required: ["phaseId"],
    },
  },
  {
    name: "assign_issue_to_phase",
    description: "Assign an issue to a phase, or unassign by omitting phaseId.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        issueIdOrIdentifier: {
          type: "string",
          description: "Issue ID or identifier like PROJ-123 (required)",
        },
        phaseId: {
          type: "string",
          description:
            "Phase ID (optional - omit to unassign from current phase)",
        },
      },
      required: ["issueIdOrIdentifier"],
    },
  },

  // Beeper Business Contacts Tools
  {
    name: "get_beeper_threads",
    description:
      "List all business-marked Beeper threads (WhatsApp contacts synced via Beeper).",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        limit: {
          type: "number",
          description: "Max results (default 50)",
        },
      },
    },
  },
  {
    name: "get_beeper_thread",
    description: "Get a single Beeper thread by its Beeper thread ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        threadId: {
          type: "string",
          description: "The Beeper thread ID string (required)",
        },
      },
      required: ["threadId"],
    },
  },
  {
    name: "get_beeper_thread_messages",
    description: "Get messages for a Beeper thread.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        threadId: {
          type: "string",
          description: "The Beeper thread ID string (required)",
        },
        limit: {
          type: "number",
          description: "Max results (default 100)",
        },
      },
      required: ["threadId"],
    },
  },
  {
    name: "search_beeper_messages",
    description: "Full-text search across all synced Beeper messages.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        query: {
          type: "string",
          description: "Search terms to find in messages (required)",
        },
        limit: {
          type: "number",
          description: "Max results (default 50)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_beeper_threads_for_person",
    description: "Get Beeper threads linked to a FRM person/contact.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        personId: {
          type: "string",
          description: "The person's ID (required)",
        },
      },
      required: ["personId"],
    },
  },
  {
    name: "get_beeper_threads_for_client",
    description: "Get Beeper threads linked to a PM client.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        clientId: {
          type: "string",
          description: "The client's ID (required)",
        },
      },
      required: ["clientId"],
    },
  },

  // Fathom Meeting Tools
  {
    name: "get_fathom_meetings",
    description: "List all synced Fathom meeting notes and recordings.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        limit: {
          type: "number",
          description: "Max results (default 50)",
        },
      },
    },
  },
  {
    name: "get_fathom_meeting",
    description:
      "Get a single Fathom meeting by its Convex meeting ID, including AI summary and action items.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        meetingId: {
          type: "string",
          description: "The Fathom meeting ID (required)",
        },
      },
      required: ["meetingId"],
    },
  },
  {
    name: "get_fathom_transcript",
    description: "Get the full transcript for a Fathom meeting.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        meetingId: {
          type: "string",
          description: "The Fathom meeting ID (required)",
        },
      },
      required: ["meetingId"],
    },
  },
  {
    name: "search_fathom_meetings",
    description: "Search Fathom meetings by title or summary content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        query: {
          type: "string",
          description: "Search terms to find in Fathom meetings (required)",
        },
        limit: {
          type: "number",
          description: "Max results (default 20)",
        },
      },
      required: ["query"],
    },
  },

  // Granola Meeting Tools
  {
    name: "get_granola_meetings",
    description: "List all synced Granola meeting notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        limit: {
          type: "number",
          description: "Max results (default 50)",
        },
      },
    },
  },
  {
    name: "get_granola_meeting",
    description:
      "Get a single Granola meeting by its Granola document ID. Includes full AI-generated notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        granolaDocId: {
          type: "string",
          description: "The Granola document ID (required)",
        },
      },
      required: ["granolaDocId"],
    },
  },
  {
    name: "get_granola_transcript",
    description: "Get the full transcript for a Granola meeting.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        meetingId: {
          type: "string",
          description: "The Convex meeting ID (required)",
        },
      },
      required: ["meetingId"],
    },
  },
  {
    name: "search_granola_meetings",
    description: "Search Granola meetings by title or content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        query: {
          type: "string",
          description:
            "Search terms to find in meeting titles and notes (required)",
        },
        limit: {
          type: "number",
          description: "Max results (default 20)",
        },
      },
      required: ["query"],
    },
  },

  // Cross-Entity Linking Tools
  {
    name: "get_granola_meetings_for_person",
    description: "Get Granola meetings linked to a FRM person/contact.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        personId: {
          type: "string",
          description: "The person's ID (required)",
        },
      },
      required: ["personId"],
    },
  },
  {
    name: "get_granola_meetings_for_thread",
    description: "Get Granola meetings linked to a Beeper thread.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        beeperThreadId: {
          type: "string",
          description: "The Beeper thread Convex ID (required)",
        },
      },
      required: ["beeperThreadId"],
    },
  },

  // Composite / Dossier Tools
  {
    name: "get_contact_dossier",
    description:
      "Get everything about a contact in one call: person info, AI profile, Beeper threads, Granola meetings (with AI notes and calendar events), Fathom meetings (with summaries and action items), all known email addresses, and voice memos. Supports lookup by personId OR fuzzy name search.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        personId: {
          type: "string",
          description: "The person's ID (provide this OR nameQuery)",
        },
        nameQuery: {
          type: "string",
          description: "Fuzzy name search (provide this OR personId)",
        },
      },
    },
  },
  {
    name: "get_meeting_calendar_links",
    description:
      "Get calendar events linked to a Granola meeting, including attendees and event details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        meetingId: {
          type: "string",
          description: "The Convex meeting ID (required)",
        },
      },
      required: ["meetingId"],
    },
  },

  // Beeper → FRM Sync tools
  {
    name: "sync_beeper_contacts_to_frm",
    description:
      "Bulk sync all unlinked business DM Beeper threads to FRM people. Creates a new contact for each unlinked thread and cascades Granola meeting links.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        dryRun: {
          type: "boolean",
          description: "Preview without making changes (default: false)",
        },
      },
    },
  },
  {
    name: "link_beeper_thread_to_person",
    description:
      "Link a single Beeper thread to an existing or new FRM person. If personId is provided, links to that existing person. Otherwise creates a new person.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        threadId: {
          type: "string",
          description: "The Beeper thread ID string (required)",
        },
        personId: {
          type: "string",
          description:
            "Existing person ID to link to (optional - omit to create new person)",
        },
        personName: {
          type: "string",
          description:
            "Name for the new person (optional - defaults to thread name)",
        },
        relationshipType: {
          type: "string",
          description:
            "Relationship type: family, friend, colleague, acquaintance, mentor, other (default: colleague)",
        },
      },
      required: ["threadId"],
    },
  },

  // CRM / Business Contact Tools
  {
    name: "get_business_contacts",
    description:
      "Get all business contacts (Beeper threads marked as business) with linked person/client info and meeting counts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
      },
    },
  },
  {
    name: "get_client_success_workspace",
    description:
      "Load a customer success workspace for one client: projects, open work, linked chats, meetings, and notes in one call.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        clientIdOrName: {
          type: "string",
          description: "Client ID or client name (required)",
        },
        messageLimit: {
          type: "number",
          description:
            "Recent messages to include per linked thread (default 5, max 20)",
        },
        meetingLimit: {
          type: "number",
          description:
            "Meetings to include across Granola and Fathom (default 10, max 30)",
        },
        noteLimit: {
          type: "number",
          description: "Notes to include (default 10, max 50)",
        },
        openTaskLimit: {
          type: "number",
          description: "Open tasks to include (default 25, max 100)",
        },
      },
      required: ["clientIdOrName"],
    },
  },
  {
    name: "get_merge_suggestions",
    description:
      "Get pending contact merge suggestions. Returns pairs of contacts that may be duplicates based on matching email, phone, or name similarity.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
      },
    },
  },
  {
    name: "accept_merge_suggestion",
    description:
      "Accept a merge suggestion and merge the source contact into the target contact. Re-links all memos, Beeper threads, and meetings from source to target, then archives the source contact.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        suggestionId: {
          type: "string",
          description: "The merge suggestion ID (required)",
        },
      },
      required: ["suggestionId"],
    },
  },
  {
    name: "reject_merge_suggestion",
    description:
      "Reject a merge suggestion. The suggestion will be marked as rejected and won't appear again.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        suggestionId: {
          type: "string",
          description: "The merge suggestion ID (required)",
        },
      },
      required: ["suggestionId"],
    },
  },
  {
    name: "dismiss_all_merge_suggestions",
    description: "Dismiss all pending merge suggestions at once.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
      },
    },
  },
  {
    name: "unlink_meeting_from_business_contact",
    description:
      "Remove the link between a meeting (Granola or Fathom) and a business contact. Deletes the thread link, person link, and unified meeting link records.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        threadConvexId: {
          type: "string",
          description: "The Convex ID of the Beeper thread (required)",
        },
        meetingSource: {
          type: "string",
          enum: ["granola", "fathom"],
          description: "The meeting source: 'granola' or 'fathom' (required)",
        },
        meetingId: {
          type: "string",
          description: "The meeting ID (required)",
        },
      },
      required: ["threadConvexId", "meetingSource", "meetingId"],
    },
  },

  // ==================== INITIATIVE MANAGEMENT ====================
  {
    name: "get_initiatives",
    description:
      "Get yearly initiatives with optional filters. Initiatives are the highest-order goals (e.g., 'Career Growth', 'Health Improvement') that cascade down to projects, tasks, and habits.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        year: {
          type: "number",
          description: "Filter by year, e.g. 2026 (optional)",
        },
        status: {
          type: "string",
          enum: ["active", "completed", "paused", "cancelled"],
          description: "Filter by initiative status (optional)",
        },
        category: {
          type: "string",
          enum: [
            "career",
            "health",
            "learning",
            "relationships",
            "finance",
            "personal",
          ],
          description: "Filter by category (optional)",
        },
        includeArchived: {
          type: "boolean",
          description: "Include archived initiatives (default: false)",
        },
      },
    },
  },
  {
    name: "get_initiative",
    description: "Get a single initiative's details by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        initiativeId: {
          type: "string",
          description: "The initiative ID (required)",
        },
      },
      required: ["initiativeId"],
    },
  },
  {
    name: "get_initiative_with_stats",
    description:
      "Get an initiative with full stats: linked projects, habits, directly linked issues, task completion counts, and calculated progress.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        initiativeId: {
          type: "string",
          description: "The initiative ID (required)",
        },
      },
      required: ["initiativeId"],
    },
  },
  {
    name: "create_initiative",
    description:
      "Create a new yearly initiative. Initiatives are the highest-order goals that organize projects, tasks, and habits.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        year: {
          type: "number",
          description: "The year for this initiative, e.g. 2026 (required)",
        },
        title: {
          type: "string",
          description: "Initiative title (required)",
        },
        category: {
          type: "string",
          enum: [
            "career",
            "health",
            "learning",
            "relationships",
            "finance",
            "personal",
          ],
          description: "Category for grouping (required)",
        },
        description: {
          type: "string",
          description: "Detailed description (optional)",
        },
        status: {
          type: "string",
          enum: ["active", "completed", "paused", "cancelled"],
          description: "Status (optional, default: active)",
        },
        targetMetric: {
          type: "string",
          description:
            "Target metric description, e.g. 'Complete 3 projects' or 'Run 500 miles' (optional)",
        },
        manualProgress: {
          type: "number",
          description: "Manual progress override 0-100 (optional)",
        },
        color: {
          type: "string",
          description: "Hex color for visual display (optional)",
        },
        icon: {
          type: "string",
          description: "Emoji icon (optional)",
        },
      },
      required: ["year", "title", "category"],
    },
  },
  {
    name: "update_initiative",
    description: "Update an initiative's details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        initiativeId: {
          type: "string",
          description: "The initiative ID (required)",
        },
        title: {
          type: "string",
          description: "Updated title (optional)",
        },
        description: {
          type: "string",
          description: "Updated description (optional)",
        },
        category: {
          type: "string",
          enum: [
            "career",
            "health",
            "learning",
            "relationships",
            "finance",
            "personal",
          ],
          description: "Updated category (optional)",
        },
        status: {
          type: "string",
          enum: ["active", "completed", "paused", "cancelled"],
          description: "Updated status (optional)",
        },
        targetMetric: {
          type: "string",
          description: "Updated target metric (optional)",
        },
        manualProgress: {
          type: "number",
          description: "Updated manual progress 0-100 (optional)",
        },
        color: {
          type: "string",
          description: "Updated hex color (optional)",
        },
        icon: {
          type: "string",
          description: "Updated emoji icon (optional)",
        },
      },
      required: ["initiativeId"],
    },
  },
  {
    name: "archive_initiative",
    description:
      "Archive an initiative (soft delete). Can be unarchived later.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        initiativeId: {
          type: "string",
          description: "The initiative ID (required)",
        },
      },
      required: ["initiativeId"],
    },
  },
  {
    name: "delete_initiative",
    description:
      "Permanently delete an initiative. Linked projects, habits, and issues are unlinked (not deleted).",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        initiativeId: {
          type: "string",
          description: "The initiative ID (required)",
        },
      },
      required: ["initiativeId"],
    },
  },
  {
    name: "link_project_to_initiative",
    description:
      "Link a project to an initiative, or unlink by omitting initiativeId.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        projectIdOrKey: {
          type: "string",
          description: "Project ID or key like 'ACME' (required)",
        },
        initiativeId: {
          type: "string",
          description: "Initiative ID to link to (optional — omit to unlink)",
        },
      },
      required: ["projectIdOrKey"],
    },
  },
  {
    name: "link_issue_to_initiative",
    description:
      "Link an issue/task directly to an initiative, or unlink by omitting initiativeId.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        issueIdOrIdentifier: {
          type: "string",
          description: "Issue ID or identifier like 'PROJ-123' (required)",
        },
        initiativeId: {
          type: "string",
          description: "Initiative ID to link to (optional — omit to unlink)",
        },
      },
      required: ["issueIdOrIdentifier"],
    },
  },
  {
    name: "get_initiative_yearly_rollup",
    description:
      "Get yearly rollup of all initiatives with aggregated stats: task counts, project counts, habit counts, and progress per initiative.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        year: {
          type: "number",
          description: "The year to get rollup for, e.g. 2026 (required)",
        },
      },
      required: ["year"],
    },
  },

  // ==================== HEALTH (Oura Ring) Tools ====================
  {
    name: "get_health_sleep",
    description:
      "Get daily sleep data from Oura Ring including scores, durations (total/deep/REM/light), HRV, resting heart rate, bedtime start/end, time in bed, average breath rate, restless periods, average heart rate, and contributor scores.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        days: {
          type: "number",
          description: "Number of days to fetch (default 30)",
        },
      },
    },
  },
  {
    name: "get_health_activity",
    description:
      "Get daily activity data from Oura Ring including scores, steps, calories (active/total), exercise durations by intensity, and distance.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        days: {
          type: "number",
          description: "Number of days to fetch (default 30)",
        },
      },
    },
  },
  {
    name: "get_health_readiness",
    description:
      "Get daily readiness scores from Oura Ring including readiness score, temperature deviation, temperature trend deviation, and recovery contributor scores.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        days: {
          type: "number",
          description: "Number of days to fetch (default 30)",
        },
      },
    },
  },
  {
    name: "get_health_stress",
    description:
      "Get daily stress and recovery data from Oura Ring including stress high, recovery high, and day summary.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        days: {
          type: "number",
          description: "Number of days to fetch (default 30)",
        },
      },
    },
  },
  {
    name: "get_health_spo2",
    description:
      "Get daily blood oxygen (SpO2) percentage and breathing disturbance index data from Oura Ring.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        days: {
          type: "number",
          description: "Number of days to fetch (default 30)",
        },
      },
    },
  },
  {
    name: "get_health_heart_rate",
    description:
      "Get heart rate data from Oura Ring with min/max/avg BPM aggregated per day.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        days: {
          type: "number",
          description: "Number of days to fetch (default 14)",
        },
      },
    },
  },
  {
    name: "get_health_workouts",
    description:
      "Get workout history from Oura Ring including activity type, label, source, duration, calories, intensity, and distance.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        days: {
          type: "number",
          description: "Number of days to fetch (default 30)",
        },
      },
    },
  },

  {
    name: "get_health_resilience",
    description:
      "Get daily resilience data from Oura Ring including resilience level (limited/adequate/solid/strong/exceptional) and contributor scores (sleep recovery, daytime recovery, stress).",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        days: {
          type: "number",
          description: "Number of days to fetch (default 30)",
        },
      },
    },
  },
  {
    name: "get_health_cardio_age",
    description:
      "Get daily cardiovascular age data from Oura Ring. Shows vascular age estimate based on cardiovascular health markers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        days: {
          type: "number",
          description: "Number of days to fetch (default 30)",
        },
      },
    },
  },
  {
    name: "get_health_vo2_max",
    description:
      "Get VO2 max estimates from Oura Ring. VO2 max (ml/kg/min) measures cardiorespiratory fitness level.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        days: {
          type: "number",
          description: "Number of days to fetch (default 30)",
        },
      },
    },
  },

  // ==================== FINANCE Tools ====================
  {
    name: "get_finance_accounts",
    description:
      "Get all finance accounts including checking, savings, IRAs, 401k, brokerage, credit cards, and loans with current balances.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
      },
    },
  },
  {
    name: "get_finance_net_worth",
    description:
      "Get net worth summary with total assets, total liabilities, net worth, and per-account breakdown. All amounts in cents.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
      },
    },
  },
  {
    name: "get_finance_transactions",
    description:
      "Get financial transactions, optionally filtered by account. Returns date, description, category, and amount. Ordered newest first.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        accountId: {
          type: "string",
          description: "Filter by account ID (optional)",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 100)",
        },
      },
    },
  },
  {
    name: "get_finance_snapshots",
    description:
      "Get historical daily net worth snapshots for trend analysis. Each snapshot has date, net worth, total assets, total liabilities.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        days: {
          type: "number",
          description: "Number of days of history (default 90)",
        },
      },
    },
  },
  {
    name: "get_finance_daily_spending",
    description:
      "Get daily income/spending/net aggregation for spending analysis. Useful for understanding spending patterns over time.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        days: {
          type: "number",
          description: "Number of days (default 30)",
        },
        accountId: {
          type: "string",
          description: "Filter by account ID (optional)",
        },
      },
    },
  },

  // ==================== HABIT TRACKER ====================
  {
    name: "get_habits",
    description:
      "Get all active habits grouped by category with streaks and completion stats. Returns habits with their current streak, longest streak, total completions, and category groupings.",
    inputSchema: {
      type: "object" as const,
      properties: {
        categoryId: { type: "string", description: "Filter by category ID" },
        includeArchived: {
          type: "boolean",
          description: "Include archived habits (default false)",
        },
      },
    },
  },
  {
    name: "get_habits_for_date",
    description:
      "Get habits scheduled for a specific date with their check-in status (completed/skipped/pending/incomplete). Essential for daily habit reviews and check-ins.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
      },
      required: ["date"],
    },
  },
  {
    name: "get_habit",
    description:
      "Get a single habit with extended stats including monthly completions and completion rate.",
    inputSchema: {
      type: "object" as const,
      properties: {
        habitId: { type: "string", description: "The habit ID" },
      },
      required: ["habitId"],
    },
  },
  {
    name: "create_habit",
    description:
      "Create a new habit to track. Supports daily or weekly frequency with specific target days.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description:
            "Habit name (e.g., 'Meditate', 'Read 30 min', 'No social media')",
        },
        description: { type: "string", description: "Habit description" },
        icon: { type: "string", description: "Emoji icon for the habit" },
        categoryId: {
          type: "string",
          description: "Category ID to group under",
        },
        initiativeId: {
          type: "string",
          description: "Link to a yearly initiative",
        },
        frequency: {
          type: "string",
          enum: ["daily", "weekly"],
          description: "How often the habit should be tracked",
        },
        targetDays: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "sunday",
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
            ],
          },
          description: "For weekly habits: which days to track",
        },
      },
      required: ["name", "frequency"],
    },
  },
  {
    name: "update_habit",
    description: "Update a habit's details (name, frequency, category, etc.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        habitId: { type: "string", description: "The habit ID" },
        name: { type: "string", description: "Updated name" },
        description: { type: "string", description: "Updated description" },
        icon: { type: "string", description: "Updated emoji icon" },
        categoryId: {
          type: "string",
          description:
            "Move to different category (use 'null' to uncategorize)",
        },
        initiativeId: {
          type: "string",
          description: "Link/unlink initiative (use 'null' to unlink)",
        },
        frequency: {
          type: "string",
          enum: ["daily", "weekly"],
          description: "Updated frequency",
        },
        targetDays: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "sunday",
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
            ],
          },
          description: "For weekly habits: updated target days",
        },
        isActive: {
          type: "boolean",
          description: "Activate or deactivate the habit",
        },
      },
      required: ["habitId"],
    },
  },
  {
    name: "archive_habit",
    description:
      "Archive a habit (soft delete). Preserves check-in history but removes from active tracking.",
    inputSchema: {
      type: "object" as const,
      properties: {
        habitId: { type: "string", description: "The habit ID" },
      },
      required: ["habitId"],
    },
  },
  {
    name: "check_in_habit",
    description:
      "Check in a habit for a specific date. Mark as completed, skipped (with optional reason), or incomplete. This is the primary tool for daily habit tracking.",
    inputSchema: {
      type: "object" as const,
      properties: {
        habitId: { type: "string", description: "The habit ID" },
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        completed: {
          type: "boolean",
          description: "true = completed, false = incomplete",
        },
        skipped: {
          type: "boolean",
          description: "true = intentionally skipped (not a failure)",
        },
        note: {
          type: "string",
          description: "Optional note or reason (especially useful for skips)",
        },
      },
      required: ["habitId", "date", "completed"],
    },
  },
  {
    name: "get_habit_check_ins",
    description:
      "Get check-in history for a specific habit. Shows completion dates, skips, and notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        habitId: { type: "string", description: "The habit ID" },
        limit: {
          type: "number",
          description: "Max results (default 30, max 100)",
        },
      },
      required: ["habitId"],
    },
  },
  {
    name: "get_habit_categories",
    description: "Get all habit categories for organizing habits into groups.",
    inputSchema: {
      type: "object" as const,
      properties: {
        includeArchived: {
          type: "boolean",
          description: "Include archived categories (default false)",
        },
      },
    },
  },
  {
    name: "create_habit_category",
    description:
      "Create a new habit category for grouping related habits together.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description:
            "Category name (e.g., 'Morning Routine', 'Health', 'Mindset')",
        },
        icon: { type: "string", description: "Emoji icon (default: 📋)" },
        color: { type: "string", description: "Hex color (default: #6366f1)" },
      },
      required: ["name"],
    },
  },

  // ==================== Screen Time Tools ====================
  {
    name: "get_screentime_summary",
    description:
      "Get daily Screen Time summaries with total usage time, per-app breakdown, and category usage. Returns an array of daily summaries sorted by date descending.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        days: {
          type: "number",
          description: "Number of days to fetch (default 7)",
        },
      },
    },
  },
  {
    name: "get_screentime_top_apps",
    description:
      "Get top apps by usage time for a date range, aggregated from raw sessions. Useful for identifying biggest time sinks.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        days: {
          type: "number",
          description: "Number of days to look back (default 7)",
        },
        limit: {
          type: "number",
          description: "Max apps to return (default 10)",
        },
      },
    },
  },
  {
    name: "get_screentime_sessions",
    description:
      "Get raw Screen Time sessions for a specific date, including app name, bundle ID, category, duration, and timestamps.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format (required)",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "get_screentime_categories",
    description:
      "Get category-level Screen Time aggregation for a date range. Categories include Productivity, Social Networking, Entertainment, etc.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        days: {
          type: "number",
          description: "Number of days to look back (default 7)",
        },
      },
    },
  },

  {
    name: "run_council",
    description:
      "Run the shared LifeOS council deliberation engine and return the synthesized final answer plus council stage details. This is the same council used by the AI panel and claw council skill.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        query: {
          type: "string",
          description: "The question or prompt to deliberate on",
        },
        tier: {
          type: "string",
          enum: ["normal", "pro"],
          description: "Council tier. Defaults to normal.",
        },
        councilModels: {
          type: "array",
          items: {
            type: "object",
            properties: {
              modelId: { type: "string" },
              modelName: { type: "string" },
            },
            required: ["modelId", "modelName"],
          },
          description: "Optional custom council roster",
        },
        chairmanModel: {
          type: "object",
          properties: {
            modelId: { type: "string" },
            modelName: { type: "string" },
          },
          required: ["modelId", "modelName"],
          description: "Optional custom chairman model",
        },
        pageContext: {
          type: "object",
          properties: {
            type: { type: "string" },
            id: { type: "string" },
            title: { type: "string" },
            toolCategories: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["type", "id", "title", "toolCategories"],
          description: "Optional page context to bias stage 0 tool gathering",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "create_llm_council_artifact_run",
    description:
      "Create a durable LifeOS LLM Council artifact run before executing a local multi-model council.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        title: {
          type: "string",
          description: "Optional run title",
        },
        prompt: {
          type: "string",
          description: "The generic question or prompt being deliberated",
        },
        tier: {
          type: "string",
          enum: ["normal", "pro"],
          description: "Council tier. Defaults to normal.",
        },
        source: {
          type: "string",
          description: "Calling surface. Defaults to lifeos-plugin-opencode.",
        },
        skillVersion: { type: "string" },
        opencodeVersion: { type: "string" },
        modelRoster: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              provider: { type: "string" },
              role: { type: "string", enum: ["participant", "chairman"] },
            },
            required: ["id", "name"],
          },
        },
        chairmanModel: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            provider: { type: "string" },
            role: { type: "string", enum: ["participant", "chairman"] },
          },
          required: ["id", "name"],
        },
        metadata: {
          type: "object",
          description: "Optional structured run metadata",
        },
      },
      required: ["prompt", "modelRoster"],
    },
  },
  {
    name: "append_llm_council_artifact",
    description:
      "Append one stage artifact to a LifeOS LLM Council artifact run. Use this after each model response, review, synthesis, log, or error.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override the default user ID (optional)" },
        runId: { type: "string", description: "Artifact run ID" },
        stage: {
          type: "string",
          enum: ["input", "stage1_response", "stage2_review", "stage3_synthesis", "log", "error"],
        },
        modelId: { type: "string" },
        modelName: { type: "string" },
        provider: { type: "string" },
        role: {
          type: "string",
          enum: ["participant", "reviewer", "chairman", "system"],
        },
        content: { type: "string" },
        inputArtifactIds: {
          type: "array",
          items: { type: "string" },
        },
        ranking: {
          type: "array",
          items: { type: "string" },
        },
        usage: { type: "object" },
        latencyMs: { type: "number" },
        rawJson: { type: "object" },
        error: { type: "string" },
      },
      required: ["runId", "stage", "content"],
    },
  },
  {
    name: "complete_llm_council_artifact_run",
    description:
      "Mark a LifeOS LLM Council artifact run completed or failed after local execution finishes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override the default user ID (optional)" },
        runId: { type: "string", description: "Artifact run ID" },
        status: {
          type: "string",
          enum: ["completed", "failed"],
          description: "Final status. Defaults to completed.",
        },
        error: { type: "string" },
      },
      required: ["runId"],
    },
  },
  {
    name: "list_llm_council_artifact_runs",
    description: "List recent durable LifeOS LLM Council artifact runs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override the default user ID (optional)" },
        limit: { type: "number", description: "Maximum runs to return. Defaults to 50." },
        status: {
          type: "string",
          enum: ["queued", "running", "completed", "failed"],
        },
      },
    },
  },
  {
    name: "get_llm_council_artifact_run",
    description:
      "Get one durable LifeOS LLM Council artifact run with all stage artifacts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override the default user ID (optional)" },
        runId: { type: "string", description: "Artifact run ID" },
      },
      required: ["runId"],
    },
  },

  // ==================== AI COACHING ====================
  {
    name: "get_coach_profile",
    description:
      "Get the AI coach's evolving user model — core tension, growth edge, decision style, communication style, energy patterns, and aggregate stats.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "upsert_coach_profile",
    description:
      "Create or update the AI coach's user model. All fields are optional — only provided fields are updated.",
    inputSchema: {
      type: "object" as const,
      properties: {
        coreTension: {
          type: "string",
          description: "The user's core tension or central struggle",
        },
        growthEdge: {
          type: "string",
          description: "Where the user is currently growing",
        },
        decisionStyle: {
          type: "string",
          description: "How the user tends to make decisions",
        },
        communicationStyle: {
          type: "string",
          description: "How the user communicates",
        },
        energyPatterns: {
          type: "string",
          description: "When/how the user has energy vs. drains",
        },
      },
    },
  },
  {
    name: "get_coaching_sessions",
    description: "Get coaching session records, most recent first.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max sessions to return (default: 50)",
        },
      },
    },
  },
  {
    name: "get_coaching_session",
    description:
      "Get a single coaching session with its related insights and action items.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "The session ID to retrieve (required)",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "create_coaching_session",
    description: "Create a new coaching session record.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Session date in YYYY-MM-DD format (required)",
        },
        mode: {
          type: "string",
          enum: ["async_chat", "voice", "structured_review", "freeform"],
          description: "Session mode (required)",
        },
        framework: {
          type: "string",
          description: "Coaching framework used (optional)",
        },
        summary: {
          type: "string",
          description: "Session summary (optional)",
        },
        openThreads: {
          type: "array",
          items: {
            type: "object",
            properties: {
              topic: { type: "string" },
              status: { type: "string", enum: ["open", "resolved"] },
              notes: { type: "string" },
            },
            required: ["topic", "status"],
          },
          description: "Open discussion threads (optional)",
        },
      },
      required: ["date", "mode"],
    },
  },
  {
    name: "update_coaching_session",
    description:
      "Update an existing coaching session's summary, framework, or open threads.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "The session ID to update (required)",
        },
        summary: {
          type: "string",
          description: "Updated session summary",
        },
        framework: {
          type: "string",
          description: "Updated coaching framework",
        },
        openThreads: {
          type: "array",
          items: {
            type: "object",
            properties: {
              topic: { type: "string" },
              status: { type: "string", enum: ["open", "resolved"] },
              notes: { type: "string" },
            },
            required: ["topic", "status"],
          },
          description: "Updated open threads",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "get_coach_insights",
    description:
      "Get AI coach insights (patterns, reframes, observations, questions, hypotheses) with optional type filter.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["pattern", "reframe", "observation", "question", "hypothesis"],
          description: "Filter by insight type (optional)",
        },
        limit: {
          type: "number",
          description: "Max insights to return (default: 50)",
        },
      },
    },
  },
  {
    name: "create_coach_insight",
    description: "Create a new AI coach insight about the user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["pattern", "reframe", "observation", "question", "hypothesis"],
          description: "Insight type (required)",
        },
        content: {
          type: "string",
          description: "The insight content (required)",
        },
        confidence: {
          type: "number",
          description: "Confidence level 0-100 (required)",
        },
        sessionId: {
          type: "string",
          description: "Link to a coaching session (optional)",
        },
        pillarIds: {
          type: "array",
          items: { type: "string" },
          description: "Related life pillar IDs (optional)",
        },
        userResponse: {
          type: "string",
          enum: ["confirmed", "rejected", "partial", "pending"],
          description: "User's response to the insight (default: pending)",
        },
      },
      required: ["type", "content", "confidence"],
    },
  },
  {
    name: "update_coach_insight",
    description:
      "Update an existing coach insight's content, confidence, user response, or surface count.",
    inputSchema: {
      type: "object" as const,
      properties: {
        insightId: {
          type: "string",
          description: "The insight ID to update (required)",
        },
        content: {
          type: "string",
          description: "Updated content",
        },
        confidence: {
          type: "number",
          description: "Updated confidence 0-100",
        },
        userResponse: {
          type: "string",
          enum: ["confirmed", "rejected", "partial", "pending"],
          description: "Updated user response",
        },
        surfaceCount: {
          type: "number",
          description: "Updated surface count",
        },
        lastSurfacedAt: {
          type: "number",
          description: "Timestamp of last surfacing",
        },
      },
      required: ["insightId"],
    },
  },
  {
    name: "get_coaching_action_items",
    description:
      "Get coaching action items (commitments) with optional status filter.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["pending", "completed", "skipped"],
          description: "Filter by status (optional)",
        },
        limit: {
          type: "number",
          description: "Max items to return (default: 100)",
        },
      },
    },
  },
  {
    name: "create_coaching_action_item",
    description: "Create a new coaching action item (commitment).",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description: "The action item text (required)",
        },
        sessionId: {
          type: "string",
          description: "Link to a coaching session (optional)",
        },
        status: {
          type: "string",
          enum: ["pending", "completed", "skipped"],
          description: "Status (default: pending)",
        },
        sessionNote: {
          type: "string",
          description: "Note about this item from the session (optional)",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Priority level (optional)",
        },
        dueDate: {
          type: "string",
          description: "Due date in YYYY-MM-DD format (optional)",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "update_coaching_action_item",
    description:
      "Update a coaching action item's text, status, priority, or due date.",
    inputSchema: {
      type: "object" as const,
      properties: {
        actionItemId: {
          type: "string",
          description: "The action item ID to update (required)",
        },
        text: {
          type: "string",
          description: "Updated text",
        },
        status: {
          type: "string",
          enum: ["pending", "completed", "skipped"],
          description: "Updated status",
        },
        sessionNote: {
          type: "string",
          description: "Updated session note",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Updated priority",
        },
        dueDate: {
          type: "string",
          description: "Updated due date (YYYY-MM-DD)",
        },
      },
      required: ["actionItemId"],
    },
  },
  {
    name: "delete_coaching_action_item",
    description: "Delete a coaching action item.",
    inputSchema: {
      type: "object" as const,
      properties: {
        actionItemId: {
          type: "string",
          description: "The action item ID to delete (required)",
        },
      },
      required: ["actionItemId"],
    },
  },

  // ==================== LIFE DEVELOPMENT (Design Your Life) ====================
  {
    name: "get_journal_entries",
    description:
      "Get Good Time Journal entries (AEIOU activity log with energy/engagement/flow ratings). Returns recent entries sorted by date descending.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max entries to return (default 50)",
        },
      },
    },
  },
  {
    name: "create_journal_entry",
    description:
      "Create a Good Time Journal entry. Log an activity using the AEIOU method (Activity, Environment, Interactions, Objects, Users) and rate energy/engagement/flow from 1-5.",
    inputSchema: {
      type: "object" as const,
      properties: {
        activity: {
          type: "string",
          description: "What were you doing? (required)",
        },
        environment: {
          type: "string",
          description: "Where were you? What was the setting like?",
        },
        interactions: {
          type: "string",
          description: "What/who were you interacting with?",
        },
        objects: {
          type: "string",
          description: "What objects/devices were you using?",
        },
        usersInvolved: {
          type: "string",
          description: "Who else was involved?",
        },
        energyRating: {
          type: "number",
          description: "Energy level 1-5 (1=drained, 5=energized) (required)",
        },
        engagementRating: {
          type: "number",
          description:
            "Engagement level 1-5 (1=bored, 5=fully engaged) (required)",
        },
        flowRating: {
          type: "number",
          description:
            "Flow level 1-5 (1=no flow, 5=lost track of time) (required)",
        },
        isWork: {
          type: "boolean",
          description: "Was this a work activity?",
        },
        isPlay: {
          type: "boolean",
          description: "Was this a play/leisure activity?",
        },
        notes: {
          type: "string",
          description: "Additional notes or reflections",
        },
      },
      required: ["activity", "energyRating", "engagementRating", "flowRating"],
    },
  },
  {
    name: "update_journal_entry",
    description:
      "Update an existing Good Time Journal entry. Pass only the fields you want to change.",
    inputSchema: {
      type: "object" as const,
      properties: {
        entryId: {
          type: "string",
          description: "The journal entry ID to update (required)",
        },
        activity: { type: "string", description: "Updated activity" },
        environment: { type: "string", description: "Updated environment" },
        interactions: { type: "string", description: "Updated interactions" },
        objects: { type: "string", description: "Updated objects" },
        usersInvolved: {
          type: "string",
          description: "Updated users involved",
        },
        energyRating: {
          type: "number",
          description: "Updated energy rating 1-5",
        },
        engagementRating: {
          type: "number",
          description: "Updated engagement rating 1-5",
        },
        flowRating: { type: "number", description: "Updated flow rating 1-5" },
        isWork: { type: "boolean", description: "Updated work flag" },
        isPlay: { type: "boolean", description: "Updated play flag" },
        notes: { type: "string", description: "Updated notes" },
      },
      required: ["entryId"],
    },
  },
  {
    name: "delete_journal_entry",
    description: "Delete a Good Time Journal entry.",
    inputSchema: {
      type: "object" as const,
      properties: {
        entryId: {
          type: "string",
          description: "The journal entry ID to delete (required)",
        },
      },
      required: ["entryId"],
    },
  },
  {
    name: "get_odyssey_plans",
    description:
      "Get all Odyssey Plans (up to 3 alternative 5-year life plans with confidence/resource/likability gauges and milestones).",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "upsert_odyssey_plan",
    description:
      "Create or update an Odyssey Plan. Each plan represents an alternative 5-year life path with gauges for confidence, resources, and likability (0-100). Max 3 plans.",
    inputSchema: {
      type: "object" as const,
      properties: {
        planId: {
          type: "string",
          description: "Plan ID to update (omit to create new)",
        },
        planNumber: {
          type: "number",
          description: "Plan number: 1, 2, or 3 (required for new plans)",
        },
        title: {
          type: "string",
          description: "Plan title (required)",
        },
        description: {
          type: "string",
          description: "Description of this life path",
        },
        timeline: {
          type: "string",
          description: "5-year narrative timeline",
        },
        confidenceLevel: {
          type: "number",
          description: "Confidence gauge 0-100",
        },
        resourceLevel: {
          type: "number",
          description: "Resources gauge 0-100",
        },
        likabilityLevel: {
          type: "number",
          description: "Likability gauge 0-100",
        },
        dashboardTitle: {
          type: "string",
          description: "Short label for dashboard display",
        },
        milestones: {
          type: "array",
          description:
            "Year milestones, e.g. [{year: 1, milestone: 'Launch business'}]",
          items: {
            type: "object",
            properties: {
              year: { type: "number" },
              milestone: { type: "string" },
            },
            required: ["year", "milestone"],
          },
        },
        isActive: {
          type: "boolean",
          description: "Set as the active/primary plan",
        },
      },
      required: ["planNumber", "title"],
    },
  },
  {
    name: "delete_odyssey_plan",
    description: "Delete an Odyssey Plan.",
    inputSchema: {
      type: "object" as const,
      properties: {
        planId: {
          type: "string",
          description: "The plan ID to delete (required)",
        },
      },
      required: ["planId"],
    },
  },
  {
    name: "get_reflections",
    description:
      "Get Workview, Lifeview, or Coherence reflections. Each reflection type is versioned — returns the most recent versions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          description:
            "Filter by type: 'workview', 'lifeview', or 'coherence'. Omit for all types.",
          enum: ["workview", "lifeview", "coherence"],
        },
      },
    },
  },
  {
    name: "save_reflection",
    description:
      "Save a new version of a Workview, Lifeview, or Coherence reflection. Creates a new version each time (versions are immutable).",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          description:
            "Reflection type: 'workview', 'lifeview', or 'coherence' (required)",
          enum: ["workview", "lifeview", "coherence"],
        },
        content: {
          type: "string",
          description: "The reflection text (required)",
        },
      },
      required: ["type", "content"],
    },
  },

  // ==================== WAYFINDING ====================
  {
    name: "get_wayfinding_entries",
    description:
      "Get Wayfinding Dashboard entries — track Work/Play/Love/Health satisfaction (1-10) over time.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max entries to return (default 20)",
        },
      },
    },
  },
  {
    name: "create_wayfinding_entry",
    description:
      "Create a Wayfinding Dashboard assessment. Rate your current satisfaction in Work, Play, Love, and Health on a scale of 1-10.",
    inputSchema: {
      type: "object" as const,
      properties: {
        work: {
          type: "number",
          description: "Work satisfaction 1-10 (required)",
        },
        play: {
          type: "number",
          description: "Play satisfaction 1-10 (required)",
        },
        love: {
          type: "number",
          description: "Love satisfaction 1-10 (required)",
        },
        health: {
          type: "number",
          description: "Health satisfaction 1-10 (required)",
        },
        notes: { type: "string", description: "Optional reflection notes" },
      },
      required: ["work", "play", "love", "health"],
    },
  },

  // ==================== PROTOTYPE EXPERIMENTS ====================
  {
    name: "get_prototypes",
    description:
      "Get prototype experiments — life design experiments to test hypotheses about potential life paths.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["planned", "in_progress", "completed"],
          description: "Filter by status",
        },
      },
    },
  },
  {
    name: "create_prototype",
    description:
      "Create a prototype experiment to test a life design hypothesis. Types: conversation (talk to someone), experience (try something), side_project (build something).",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Experiment title (required)" },
        hypothesis: {
          type: "string",
          description: "What you want to test/learn (required)",
        },
        type: {
          type: "string",
          enum: ["conversation", "experience", "side_project"],
          description: "Experiment type (required)",
        },
        odysseyPlanId: {
          type: "string",
          description: "Link to an Odyssey Plan",
        },
        status: {
          type: "string",
          enum: ["planned", "in_progress", "completed"],
          description: "Status (default: planned)",
        },
        whatYouDid: { type: "string", description: "What you did" },
        whatYouLearned: { type: "string", description: "What you learned" },
        nextSteps: { type: "string", description: "Next steps" },
        startDate: { type: "string", description: "Start date ISO string" },
      },
      required: ["title", "hypothesis", "type"],
    },
  },
  {
    name: "update_prototype",
    description:
      "Update a prototype experiment. Pass only the fields you want to change.",
    inputSchema: {
      type: "object" as const,
      properties: {
        prototypeId: { type: "string", description: "Prototype ID (required)" },
        title: { type: "string", description: "Updated title" },
        hypothesis: { type: "string", description: "Updated hypothesis" },
        type: {
          type: "string",
          enum: ["conversation", "experience", "side_project"],
          description: "Updated type",
        },
        status: {
          type: "string",
          enum: ["planned", "in_progress", "completed"],
          description: "Updated status",
        },
        odysseyPlanId: { type: "string", description: "Link to Odyssey Plan" },
        whatYouDid: { type: "string", description: "What you did" },
        whatYouLearned: { type: "string", description: "What you learned" },
        nextSteps: { type: "string", description: "Next steps" },
        startDate: { type: "string", description: "Start date ISO" },
        completedDate: { type: "string", description: "Completed date ISO" },
      },
      required: ["prototypeId"],
    },
  },
  {
    name: "delete_prototype",
    description: "Delete a prototype experiment.",
    inputSchema: {
      type: "object" as const,
      properties: {
        prototypeId: {
          type: "string",
          description: "Prototype ID to delete (required)",
        },
      },
      required: ["prototypeId"],
    },
  },

  // ==================== DESIGN INTERVIEWS ====================
  {
    name: "get_design_interviews",
    description:
      "Get life design interviews — conversations with people living lives you're curious about.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "create_design_interview",
    description:
      "Log a life design interview. Record who you spoke with, questions asked, and key takeaways.",
    inputSchema: {
      type: "object" as const,
      properties: {
        personName: {
          type: "string",
          description: "Person interviewed (required)",
        },
        role: { type: "string", description: "Their role/title (required)" },
        company: { type: "string", description: "Their company" },
        odysseyPlanId: { type: "string", description: "Link to Odyssey Plan" },
        questions: {
          type: "array",
          items: { type: "string" },
          description: "Questions asked (required)",
        },
        keyTakeaways: {
          type: "array",
          items: { type: "string" },
          description: "Key takeaways (required)",
        },
        followUp: { type: "string", description: "Follow-up actions" },
        interviewDate: {
          type: "string",
          description: "Interview date ISO string (required)",
        },
      },
      required: [
        "personName",
        "role",
        "questions",
        "keyTakeaways",
        "interviewDate",
      ],
    },
  },
  {
    name: "update_design_interview",
    description:
      "Update a life design interview. Pass only the fields you want to change.",
    inputSchema: {
      type: "object" as const,
      properties: {
        interviewId: { type: "string", description: "Interview ID (required)" },
        personName: { type: "string", description: "Updated person name" },
        role: { type: "string", description: "Updated role" },
        company: { type: "string", description: "Updated company" },
        odysseyPlanId: { type: "string", description: "Link to Odyssey Plan" },
        questions: {
          type: "array",
          items: { type: "string" },
          description: "Updated questions",
        },
        keyTakeaways: {
          type: "array",
          items: { type: "string" },
          description: "Updated takeaways",
        },
        followUp: { type: "string", description: "Updated follow-up" },
        interviewDate: {
          type: "string",
          description: "Updated date ISO string",
        },
      },
      required: ["interviewId"],
    },
  },
  {
    name: "delete_design_interview",
    description: "Delete a life design interview.",
    inputSchema: {
      type: "object" as const,
      properties: {
        interviewId: {
          type: "string",
          description: "Interview ID to delete (required)",
        },
      },
      required: ["interviewId"],
    },
  },

  // ==================== BELIEF REFRAMES ====================
  {
    name: "get_belief_reframes",
    description:
      "Get limiting-belief, fear, and inversion friction records. Records can be linked to PPV visions, projects, or issues.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["limiting_belief", "fear", "inversion"],
          description: "Optional record type filter",
        },
        status: {
          type: "string",
          enum: ["active", "resolved", "archived"],
          description: "Optional lifecycle status filter",
        },
        visionIds: {
          type: "array",
          items: { type: "string" },
          description: "Only records linked to any of these PPV vision IDs",
        },
        projectIds: {
          type: "array",
          items: { type: "string" },
          description: "Only records linked to any of these project IDs",
        },
        issueIds: {
          type: "array",
          items: { type: "string" },
          description: "Only records linked to any of these issue IDs",
        },
      },
    },
  },
  {
    name: "create_belief_reframe",
    description:
      "Create a limiting-belief, fear, or inversion friction record. Link it to PPV visions, projects, or issues when relevant.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["limiting_belief", "fear", "inversion"],
          description: "Record type. Defaults to limiting_belief.",
        },
        title: {
          type: "string",
          description: "Short display title",
        },
        belief: {
          type: "string",
          description: "The limiting belief, fear, or friction statement",
        },
        reframe: {
          type: "string",
          description: "The reframed perspective, response, or operating rule",
        },
        category: {
          type: "string",
          enum: ["career", "identity", "relationship", "capability"],
          description: "Belief category",
        },
        inversionQuestion: {
          type: "string",
          description: "Inversion prompt, e.g. what would guarantee failure",
        },
        avoidOutcome: {
          type: "string",
          description: "Outcome this record is designed to avoid",
        },
        failureMechanisms: {
          type: "array",
          items: { type: "string" },
          description: "Likely mechanisms that could create the bad outcome",
        },
        preventiveRules: {
          type: "array",
          items: { type: "string" },
          description: "Rules or guardrails that reduce the risk",
        },
        warningSignals: {
          type: "array",
          items: { type: "string" },
          description: "Signals that the fear or inversion is becoming real",
        },
        counterEvidence: {
          type: "string",
          description: "Evidence against the limiting belief or fear",
        },
        nextExperiment: {
          type: "string",
          description: "Small next experiment to test the reframe",
        },
        visionIds: {
          type: "array",
          items: { type: "string" },
          description: "Linked PPV vision IDs",
        },
        projectIds: {
          type: "array",
          items: { type: "string" },
          description: "Linked project IDs",
        },
        issueIds: {
          type: "array",
          items: { type: "string" },
          description: "Linked issue IDs",
        },
        status: {
          type: "string",
          enum: ["active", "resolved", "archived"],
          description: "Record lifecycle status",
        },
        sortOrder: {
          type: "number",
          description: "Optional manual sort order",
        },
        isResolved: {
          type: "boolean",
          description: "Legacy convenience flag; prefer status when possible",
        },
      },
      required: ["belief", "reframe"],
    },
  },
  {
    name: "update_belief_reframe",
    description:
      "Update a limiting-belief, fear, or inversion friction record. Pass only the fields you want to change.",
    inputSchema: {
      type: "object" as const,
      properties: {
        beliefId: {
          type: "string",
          description: "Belief reframe ID (required)",
        },
        type: {
          type: "string",
          enum: ["limiting_belief", "fear", "inversion"],
          description: "Updated record type",
        },
        title: { type: "string", description: "Updated display title" },
        belief: { type: "string", description: "Updated friction statement" },
        reframe: { type: "string", description: "Updated reframe or rule" },
        category: {
          type: "string",
          enum: ["career", "identity", "relationship", "capability"],
          description: "Updated category",
        },
        inversionQuestion: {
          type: "string",
          description: "Updated inversion prompt",
        },
        avoidOutcome: { type: "string", description: "Updated avoid outcome" },
        failureMechanisms: {
          type: "array",
          items: { type: "string" },
          description: "Updated failure mechanisms",
        },
        preventiveRules: {
          type: "array",
          items: { type: "string" },
          description: "Updated preventive rules",
        },
        warningSignals: {
          type: "array",
          items: { type: "string" },
          description: "Updated warning signals",
        },
        counterEvidence: {
          type: "string",
          description: "Updated counter-evidence",
        },
        nextExperiment: {
          type: "string",
          description: "Updated next experiment",
        },
        visionIds: {
          type: "array",
          items: { type: "string" },
          description: "Replace linked PPV vision IDs",
        },
        projectIds: {
          type: "array",
          items: { type: "string" },
          description: "Replace linked project IDs",
        },
        issueIds: {
          type: "array",
          items: { type: "string" },
          description: "Replace linked issue IDs",
        },
        status: {
          type: "string",
          enum: ["active", "resolved", "archived"],
          description: "Updated lifecycle status",
        },
        sortOrder: { type: "number", description: "Updated sort order" },
        isResolved: {
          type: "boolean",
          description: "Legacy convenience flag; prefer status when possible",
        },
      },
      required: ["beliefId"],
    },
  },

  // ==================== FAILURE REFRAMES ====================
  {
    name: "get_failure_reframes",
    description:
      "Get failure reframe log — categorize failures as screw-ups (fixable), weaknesses (manageable), or growth opportunities (learnings).",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["screw_up", "weakness", "growth_opportunity"],
          description: "Filter by failure category",
        },
      },
    },
  },
  {
    name: "create_failure_reframe",
    description:
      "Log a failure and reframe it. Categorize as screw_up (won't do again), weakness (manage around), or growth_opportunity (learn from).",
    inputSchema: {
      type: "object" as const,
      properties: {
        event: {
          type: "string",
          description: "Brief description of the failure event (required)",
        },
        category: {
          type: "string",
          enum: ["screw_up", "weakness", "growth_opportunity"],
          description: "Failure category (required)",
        },
        whatHappened: {
          type: "string",
          description: "Detailed account of what happened (required)",
        },
        insight: {
          type: "string",
          description: "Insight or lesson learned (required)",
        },
        actionTaken: { type: "string", description: "Action taken or planned" },
      },
      required: ["event", "category", "whatHappened", "insight"],
    },
  },
  {
    name: "update_failure_reframe",
    description:
      "Update a failure reframe entry. Pass only the fields you want to change.",
    inputSchema: {
      type: "object" as const,
      properties: {
        failureId: {
          type: "string",
          description: "Failure reframe ID (required)",
        },
        event: { type: "string", description: "Updated event" },
        category: {
          type: "string",
          enum: ["screw_up", "weakness", "growth_opportunity"],
          description: "Updated category",
        },
        whatHappened: { type: "string", description: "Updated description" },
        insight: { type: "string", description: "Updated insight" },
        actionTaken: { type: "string", description: "Updated action taken" },
      },
      required: ["failureId"],
    },
  },

  // PPV v1 tools
  {
    name: "get_ppv_workspace",
    description:
      "Get the PPV workspace for the selected vision, plus all owned visions, active-vision context, identity, pillars, linked projects, and linked friction records.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        visionId: { type: "string", description: "Specific PPV vision ID" },
      },
    },
  },
  {
    name: "get_active_vision_graph",
    description:
      "Best default graph read for PPV questions. Get the unified active-vision graph linking PPV vision, identity, pillars, belief_reframe friction nodes, related projects/issues, and recent voice memos.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        visionId: {
          type: "string",
          description: "Optional PPV vision ID. Defaults to the active vision.",
        },
        recentVoiceLimit: {
          type: "number",
          description: "Optional max recent voice memos to include (default 5)",
        },
        recentVoiceLookbackDays: {
          type: "number",
          description:
            "Optional voice-memo lookback window in days (default 14)",
        },
      },
    },
  },
  {
    name: "get_unified_life_graph",
    description:
      "Build the user's full live unified life graph across PPV, initiatives, habits, people, projects, issues, voice memos, and voice summaries. Prefer narrower graph tools unless whole-system context is required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
      },
    },
  },
  {
    name: "get_project_graph",
    description:
      "Get the unified graph neighborhood around a project. Use this when the user is anchored on one project and wants connected initiatives, issues, PPV context, or memos.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        projectIdOrKey: {
          type: "string",
          description: "Project ID or key like ACME",
        },
        maxHops: {
          type: "number",
          description: "Neighborhood radius (default 2)",
        },
      },
      required: ["projectIdOrKey"],
    },
  },
  {
    name: "get_initiative_graph",
    description:
      "Get the unified graph neighborhood around an initiative. Use this to see which projects, issues, or PPV context connect to a yearly initiative.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        initiativeId: { type: "string", description: "Initiative ID" },
        maxHops: {
          type: "number",
          description: "Neighborhood radius (default 2)",
        },
      },
      required: ["initiativeId"],
    },
  },
  {
    name: "get_person_graph",
    description:
      "Get the unified graph neighborhood around a person/contact, including linked meetings, memos, and adjacent work context.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        personId: { type: "string", description: "Person ID" },
        maxHops: {
          type: "number",
          description: "Neighborhood radius (default 2)",
        },
      },
      required: ["personId"],
    },
  },
  {
    name: "get_voice_memo_graph",
    description:
      "Get the unified graph neighborhood around a voice memo so the agent can trace that memo to nearby people, projects, PPV context, and related notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        memoId: { type: "string", description: "Voice memo ID" },
        maxHops: {
          type: "number",
          description: "Neighborhood radius (default 2)",
        },
      },
      required: ["memoId"],
    },
  },
  {
    name: "get_cached_unified_graph",
    description:
      "Read the materialized cached unified graph projection. Faster than rebuilding the live graph, but may be slightly stale.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
      },
    },
  },
  {
    name: "refresh_unified_graph_cache",
    description:
      "Recompute inferred AI graph links and refresh the materialized graph cache.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
      },
    },
  },
  {
    name: "upsert_unified_graph_link",
    description:
      "Create or update a manual graph link between two unified graph nodes. Use node IDs returned from graph reads.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        fromNodeId: { type: "string", description: "Source node ID" },
        toNodeId: { type: "string", description: "Destination node ID" },
        kind: {
          type: "string",
          enum: [
            "contains",
            "references",
            "derived_from",
            "supports",
            "related_to",
          ],
          description: "Edge kind",
        },
        status: {
          type: "string",
          enum: ["active", "archived", "rejected"],
          description: "Link status",
        },
        weight: { type: "number", description: "Optional confidence/weight" },
        evidence: { type: "string", description: "Why this link exists" },
        metadataJson: {
          type: "string",
          description: "Optional JSON metadata string",
        },
      },
      required: ["fromNodeId", "toNodeId", "kind"],
    },
  },
  {
    name: "delete_unified_graph_link",
    description:
      "Delete a manual unified graph link using the same fromNodeId, toNodeId, and kind used to create it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        fromNodeId: { type: "string", description: "Source node ID" },
        toNodeId: { type: "string", description: "Destination node ID" },
        kind: {
          type: "string",
          enum: [
            "contains",
            "references",
            "derived_from",
            "supports",
            "related_to",
          ],
          description: "Edge kind",
        },
      },
      required: ["fromNodeId", "toNodeId", "kind"],
    },
  },
  {
    name: "falkor_graph_schema",
    description:
      "Inspect the FalkorDB sidecar graph contract for agents: configured graph, mirrored PPV labels, safe Cypher rules, relationship types, and examples. Use before raw Falkor Cypher graph work.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "falkor_graph_query",
    description:
      "Run guarded read-only Cypher against the LifeOS FalkorDB graph sidecar. Allowed statements are MATCH, WITH, RETURN, EXPLAIN, and PROFILE query shapes only. MATCH queries should include LIMIT unless doing count aggregation. Do not use this for Convex-canonical writes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Read-only Cypher. MATCH queries should include LIMIT unless they are aggregate count queries.",
        },
        maxRows: {
          type: "number",
          description:
            "Maximum rows returned after execution. Default 50, max 200.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "falkor_graph_link",
    description:
      "Create or update an agent-owned AGENT_LINK relationship in FalkorDB between two existing LifeOS graph records. This never mutates Convex-synced nodes or inferred PPV relationships.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fromLabel: {
          type: "string",
          description: "Source Falkor node label, e.g. PpvPillar.",
        },
        fromId: {
          type: "string",
          description: "Source Convex record id stored in node.convexId.",
        },
        toLabel: {
          type: "string",
          description: "Target Falkor node label, e.g. PpvProject.",
        },
        toId: {
          type: "string",
          description: "Target Convex record id stored in node.convexId.",
        },
        kind: {
          type: "string",
          description:
            "Snake-case relationship kind, e.g. related_to, supports, mentions, discussed_in, evidence_for.",
        },
        reason: {
          type: "string",
          description: "Why the agent believes this relationship should exist.",
        },
        confidence: {
          type: "number",
          description: "Relationship confidence from 0 to 1. Default 0.7.",
        },
        createdBy: {
          type: "string",
          description: "Agent/source name. Default hermes.",
        },
        metadata: {
          type: "object",
          description: "Optional JSON metadata for provenance.",
          additionalProperties: true,
        },
      },
      required: ["fromLabel", "fromId", "toLabel", "toId", "kind", "reason"],
    },
  },
  {
    name: "falkor_graph_unlink",
    description:
      "Remove an agent-owned FalkorDB AGENT_LINK relationship previously created by falkor_graph_link.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fromLabel: { type: "string", description: "Source Falkor node label." },
        fromId: {
          type: "string",
          description: "Source Convex record id stored in node.convexId.",
        },
        toLabel: { type: "string", description: "Target Falkor node label." },
        toId: {
          type: "string",
          description: "Target Convex record id stored in node.convexId.",
        },
        kind: {
          type: "string",
          description: "Relationship kind used when linking.",
        },
      },
      required: ["fromLabel", "fromId", "toLabel", "toId", "kind"],
    },
  },
  {
    name: "seed_ppv_beijing_workspace",
    description:
      "Seed the Beijing Creative Salon PPV example if no PPV vision exists.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
      },
    },
  },
  {
    name: "upsert_ppv_vision",
    description: "Create or update a PPV vision.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        visionId: { type: "string", description: "Existing PPV vision ID" },
        title: { type: "string", description: "Vision title" },
        description: {
          type: "string",
          description: "Vivid future-life description",
        },
        themes: {
          type: "array",
          items: { type: "string" },
          description: "Vision themes",
        },
        desiredFeelings: {
          type: "array",
          items: { type: "string" },
          description: "Desired emotional states",
        },
        status: {
          type: "string",
          enum: ["ideation", "todo", "planned", "in_progress", "done"],
          description: "Vision lifecycle status",
        },
      },
      required: ["title", "description", "themes", "desiredFeelings"],
    },
  },
  {
    name: "set_ppv_vision_status",
    description: "Update a PPV vision lifecycle status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        visionId: { type: "string", description: "PPV vision ID" },
        status: {
          type: "string",
          enum: ["ideation", "todo", "planned", "in_progress", "done"],
          description: "Vision lifecycle status",
        },
      },
      required: ["visionId", "status"],
    },
  },
  {
    name: "set_active_ppv_vision",
    description:
      "Deprecated alias: move a PPV vision to in_progress without editing its content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        visionId: {
          type: "string",
          description: "PPV vision ID to move to in_progress",
        },
      },
      required: ["visionId"],
    },
  },
  {
    name: "archive_ppv_vision",
    description:
      "Archive a PPV vision and automatically move active status to another remaining vision if needed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        visionId: { type: "string", description: "PPV vision ID to archive" },
      },
      required: ["visionId"],
    },
  },
  {
    name: "delete_ppv_vision",
    description:
      "Delete a PPV vision and cascade-delete its identity and pillars.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        visionId: { type: "string", description: "PPV vision ID to delete" },
      },
      required: ["visionId"],
    },
  },
  {
    name: "upsert_ppv_identity",
    description:
      "Create or update the identity that naturally lives a PPV vision.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        identityId: { type: "string", description: "Existing identity ID" },
        visionId: { type: "string", description: "PPV vision ID" },
        coreIdentities: {
          type: "array",
          items: { type: "string" },
          description: "Core identity labels",
        },
        beliefs: {
          type: "array",
          items: { type: "string" },
          description: "Identity beliefs",
        },
        behaviors: {
          type: "array",
          items: { type: "string" },
          description: "Identity-aligned behaviors",
        },
      },
      required: ["visionId", "coreIdentities", "beliefs", "behaviors"],
    },
  },
  {
    name: "create_ppv_pillar",
    description:
      "Create a PPV pillar and optionally link existing LifeOS projects.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        visionId: { type: "string", description: "PPV vision ID" },
        name: { type: "string", description: "Pillar name" },
        purpose: {
          type: "string",
          description: "Why this pillar supports the vision",
        },
        supportingComponents: {
          type: "array",
          items: { type: "string" },
          description: "Supporting systems/components",
        },
        projectIds: {
          type: "array",
          items: { type: "string" },
          description: "Existing LifeOS project IDs",
        },
        order: { type: "number", description: "Sort order" },
      },
      required: ["visionId", "name", "purpose", "supportingComponents"],
    },
  },
  {
    name: "update_ppv_pillar",
    description: "Update a PPV pillar or linked existing LifeOS projects.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        pillarId: { type: "string", description: "PPV pillar ID" },
        name: { type: "string", description: "Updated pillar name" },
        purpose: { type: "string", description: "Updated purpose" },
        supportingComponents: {
          type: "array",
          items: { type: "string" },
          description: "Updated supporting components",
        },
        projectIds: {
          type: "array",
          items: { type: "string" },
          description: "Existing LifeOS project IDs to link",
        },
        order: { type: "number", description: "Updated sort order" },
      },
      required: ["pillarId"],
    },
  },
  {
    name: "delete_ppv_pillar",
    description: "Delete a PPV pillar.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Override user ID" },
        pillarId: { type: "string", description: "PPV pillar ID" },
      },
      required: ["pillarId"],
    },
  },

  // MCP Server Info
  {
    name: "get_version",
    description:
      "Get the current version and build time of the LifeOS MCP server package.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// Prompt definitions — workflow-level skills that chain multiple tools
const PROMPTS: Prompt[] = [
  {
    name: "daily-standup",
    description:
      "Get daily standup briefing: agenda, tasks due today, sprint progress.",
    arguments: [
      {
        name: "date",
        description:
          "Specific date in ISO format (optional, defaults to today)",
        required: false,
      },
    ],
  },
  {
    name: "daily-plan",
    description:
      "Plan the day and apply mutations: due dates, top priorities, current-cycle assignments, and daily note.",
    arguments: [
      {
        name: "date",
        description:
          "Specific date in YYYY-MM-DD format (optional, defaults to today)",
        required: false,
      },
      {
        name: "notes",
        description: "Additional planning instructions from the user",
        required: false,
      },
    ],
  },
  {
    name: "weekly-review",
    description:
      "Run weekly review: completed work, in-progress items, sprint health, blockers.",
    arguments: [
      {
        name: "date",
        description:
          "Week start date in ISO format (optional, defaults to this week)",
        required: false,
      },
    ],
  },
  {
    name: "weekly-plan",
    description:
      "Plan the week and apply mutations to due dates, current cycle goals/assignments, and weekly/daily notes.",
    arguments: [
      {
        name: "date",
        description:
          "Week start date in YYYY-MM-DD format (optional, defaults to this week)",
        required: false,
      },
      {
        name: "notes",
        description: "Additional planning instructions from the user",
        required: false,
      },
    ],
  },
  {
    name: "sprint-plan",
    description:
      "Plan the current sprint: review backlog, assign tasks to cycle, check capacity.",
    arguments: [
      {
        name: "notes",
        description:
          "Additional context or specific tasks to include (optional)",
        required: false,
      },
    ],
  },
  {
    name: "ppv",
    description:
      "Manage the PPV life design system: vision, identity, pillars, and projects.",
    arguments: [
      {
        name: "intent",
        description:
          "What to do with PPV, e.g. create vision, update identity, add pillar, link project.",
        required: false,
      },
    ],
  },
  {
    name: "falkor-graph",
    description:
      "Use the FalkorDB sidecar graph: query PPV graph relationships with Cypher and create controlled agent-owned graph links.",
    arguments: [
      {
        name: "intent",
        description:
          "What to do with the Falkor graph, e.g. inspect PPV-project links or add an agent-owned PPV relationship.",
        required: false,
      },
    ],
  },
  {
    name: "contact-lookup",
    description:
      "Full contact dossier: profile, AI insights, meetings, messages, voice memos.",
    arguments: [
      {
        name: "name",
        description: "Person's name to look up (required)",
        required: true,
      },
    ],
  },
  {
    name: "client-brief",
    description:
      "Full client briefing: projects, phases, completion stats, recent communications.",
    arguments: [
      {
        name: "client",
        description: "Client name or ID (required)",
        required: true,
      },
    ],
  },
  {
    name: "customer-success-triage",
    description:
      "Triage a client request using business chats, Fathom/Granola meetings, notes, and open work.",
    arguments: [
      {
        name: "client",
        description: "Client name or ID (required)",
        required: true,
      },
      {
        name: "focus",
        description:
          "Optional focus area, like a feature request, escalation, or meeting topic",
        required: false,
      },
    ],
  },
  {
    name: "project-status",
    description:
      "Project status report: phases, task breakdown, blockers, urgent items.",
    arguments: [
      {
        name: "project",
        description: "Project key like 'ACME' or project name (required)",
        required: true,
      },
    ],
  },
  {
    name: "capture",
    description:
      "Quick capture a thought, task, or note. Auto-routes to task or note based on content.",
    arguments: [
      {
        name: "input",
        description: "What to capture — a task, idea, or note (required)",
        required: true,
      },
    ],
  },
  {
    name: "meeting-prep",
    description:
      "Prepare for a meeting: contact dossier, past meetings, recent messages, open items.",
    arguments: [
      {
        name: "name",
        description: "Person's name to prep for (required)",
        required: true,
      },
    ],
  },
  {
    name: "cycle-review",
    description:
      "Review the current cycle: progress, incomplete items, rollover options. Useful for end-of-sprint review.",
    arguments: [
      {
        name: "action",
        description:
          "Optional action: 'close' to close the cycle, 'rollover' to close and roll over incomplete issues",
        required: false,
      },
    ],
  },
  {
    name: "initiative-review",
    description:
      "Review yearly initiative progress: get all initiatives for a year, show stats per category, highlight stalled or off-track initiatives.",
    arguments: [
      {
        name: "year",
        description: "Year to review (optional, defaults to current year)",
        required: false,
      },
    ],
  },
  {
    name: "client-health",
    description:
      "Show health dashboard across all clients with risk indicators, project health, and communication recency.",
    arguments: [
      {
        name: "filter",
        description:
          "Optional filter: 'critical' to only show at-risk and critical clients",
        required: false,
      },
    ],
  },
  {
    name: "context-switch",
    description:
      "Quickly load context for a client or project for fast mental context switching.",
    arguments: [
      {
        name: "name",
        description:
          "Client name or project key/name to load context for (required)",
        required: true,
      },
    ],
  },
  {
    name: "end-of-day",
    description:
      "Run end-of-day wrap-up with completion summary, carry-over items, and tomorrow planning.",
    arguments: [
      {
        name: "date",
        description:
          "Specific date in ISO format (optional, defaults to today)",
        required: false,
      },
    ],
  },
  {
    name: "follow-ups",
    description:
      "Track follow-ups needed with people and clients based on interaction recency.",
    arguments: [
      {
        name: "name",
        description: "Optional: specific person or client name to focus on",
        required: false,
      },
    ],
  },
  {
    name: "inbox-triage",
    description:
      "Process captured notes and triage into actionable tasks, tags, and links.",
    arguments: [
      {
        name: "mode",
        description:
          "Optional: 'auto' to process automatically with best-guess actions instead of asking",
        required: false,
      },
    ],
  },
  {
    name: "monthly-review",
    description:
      "Run monthly review with accomplishments, project progress, client health, and next month planning.",
    arguments: [
      {
        name: "month",
        description:
          "Month to review in ISO format like '2025-01' (optional, defaults to current month)",
        required: false,
      },
    ],
  },
  {
    name: "overdue",
    description:
      "Show what's overdue or slipping — tasks past due, off-track projects, stale in-progress items.",
    arguments: [
      {
        name: "filter",
        description:
          "Optional: 'critical' or 'urgent' to only show critical items",
        required: false,
      },
    ],
  },
  {
    name: "relationship-pulse",
    description:
      "Check on neglected relationships and suggest reconnection actions based on interaction history.",
    arguments: [
      {
        name: "type",
        description:
          "Optional: relationship type to filter (e.g., 'family', 'friends', 'colleagues')",
        required: false,
      },
    ],
  },
  {
    name: "voice-notes",
    description:
      "Interactive voice memo exploration — review, analyze, and discuss your recorded thoughts.",
    arguments: [
      {
        name: "topic",
        description: "Optional: topic or date range to start exploring",
        required: false,
      },
    ],
  },
  {
    name: "personal-records",
    description:
      "Retrieve private Personal Records for RAG context before answering or planning.",
    arguments: [
      {
        name: "query",
        description: "Topic/question to retrieve Personal Records for",
        required: false,
      },
    ],
  },
  {
    name: "voice-notes-crystallize",
    description:
      "Save a crystallized summary of AI conversation — preserve insights, plans, and ideas from voice note discussions.",
    arguments: [
      {
        name: "title",
        description: "Optional: title or topic for the crystallization summary",
        required: false,
      },
    ],
  },
  {
    name: "health-check",
    description:
      "Quick health overview: recent Oura Ring scores for sleep, activity, readiness, plus trends and insights.",
    arguments: [
      {
        name: "days",
        description: "Number of days to review (optional, defaults to 7)",
        required: false,
      },
    ],
  },
  {
    name: "health-weekly",
    description:
      "Weekly health review: sleep quality trends, activity patterns, readiness scores, workouts, and recovery insights.",
    arguments: [
      {
        name: "weeks",
        description: "Number of weeks to review (optional, defaults to 2)",
        required: false,
      },
    ],
  },
  {
    name: "finance-overview",
    description:
      "Financial overview: net worth summary, account balances, and net worth trend over time.",
    arguments: [
      {
        name: "days",
        description: "Number of days for trend data (optional, defaults to 90)",
        required: false,
      },
    ],
  },
  {
    name: "finance-spending",
    description:
      "Spending analysis: daily income/spending patterns, top spending categories, and recent transactions.",
    arguments: [
      {
        name: "days",
        description: "Number of days to analyze (optional, defaults to 30)",
        required: false,
      },
    ],
  },
  {
    name: "habit-check",
    description:
      "Daily habit check-in: review today's habits, mark completions, celebrate streaks.",
    arguments: [
      {
        name: "habits",
        description:
          "Specific habits to check in (optional, comma-separated habit names or IDs)",
        required: false,
      },
    ],
  },
  {
    name: "daily-training-report",
    description:
      "Comprehensive daily training report: yesterday's results, today's focus, habit compliance, health data, ADHD focus management.",
    arguments: [
      {
        name: "date",
        description:
          "Specific date in ISO format (optional, defaults to today)",
        required: false,
      },
    ],
  },
  {
    name: "screentime-report",
    description:
      "Screen time analysis: daily/weekly usage patterns, top time-sink apps, social media alerts, category breakdown.",
    arguments: [
      {
        name: "days",
        description: "Number of days to analyze (optional, defaults to 7)",
        required: false,
      },
    ],
  },
];

// Prompt message templates keyed by prompt name
const PROMPT_MESSAGES: Record<
  string,
  (
    args: Record<string, string>,
  ) => { role: "user"; content: { type: "text"; text: string } }[]
> = {
  "daily-standup": (args) => {
    const dateClause = args.date
      ? `Use date: ${args.date}`
      : "Use today's date.";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Get my daily standup briefing. Use the LifeOS MCP tools to gather:

1. Call get_daily_agenda for today's agenda (tasks due today, calendar events, protected calendar blocks, top priorities)
2. Call get_todays_tasks for today's task list
3. Call get_overdue_tasks to surface anything already slipping
4. Call get_current_cycle for current sprint progress and stats

${dateClause}

Summarize in a concise standup format:
- **Today's Focus**: Top 3 things to focus on
- **Tasks Due**: List tasks due today with priority
- **Overdue**: Anything already late that needs immediate triage
- **Sprint Progress**: Cycle completion % and key stats
- **Calendar**: Any meetings, events, or protected blocks today

Keep it short and actionable.`,
        },
      },
    ];
  },
  "daily-plan": (args) => {
    const dateClause = args.date
      ? `Use date: ${args.date}`
      : "Use today's date.";
    const notesClause = args.notes ? `User instructions: ${args.notes}` : "";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Plan my day in LifeOS and apply the resulting mutations.

${dateClause}
${notesClause}

Workflow:
1. Call get_planning_context with daily=true, weekly=true, currentCycle=true, backlog=true, habits=true, dailyFields=true, calendar=true, voiceMemos=true.
2. Decide today's top 3, tasks to assign to the day or deadline via dueDate, issue calendar blocks to add with schedule_issue, protected non-ticket calendar blocks to create with create_calendar_block, backlog items to pull into the current cycle, and any cycle goal updates.
3. Call apply_planning_patch with mode "day" and dryRun=false. Use operations as needed:
   - create_issue for new tasks
   - create_calendar_block for protected non-ticket time like errands, meals, dog walking, appointments, or holds; this must not create a PM issue
   - update_issue for dueDate, status, priority, and estimate changes
   - schedule_issue for each issue calendar block using issueIdOrIdentifier plus scheduledStartAt/scheduledEndAt, or date plus startTime/endTime; repeat for multiple blocks
   - assign_issue_to_current_cycle for current cycle work
   - set_top_priority for today's top 3
   - update_cycle_goals when the current cycle goal should change
   - save_daily_note to write the human-readable day plan into the Daily Note
   - add_daily_ai_comment for AI-only observations, planning rationale, risks, or coaching notes that should appear in Daily AI Comments
   - add_weekly_ai_comment for AI-only weekly observations, planning rationale, risks, or coaching notes that should appear in Weekly AI Comments
4. Return a concise summary of what changed and the final plan.

Do not ask for confirmation; the user intends this planning workflow to mutate LifeOS.`,
        },
      },
    ];
  },
  ppv: (args) => {
    const intentClause = args.intent
      ? `User intent: ${args.intent}`
      : "Start by reviewing the current PPV workspace.";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Manage my PPV life design system.

${intentClause}

Use the LifeOS MCP PPV tools:
1. Call get_ppv_workspace first to inspect all owned visions, the selected/current vision, identity, pillars, linked projects, linked friction records, and available LifeOS projects.
2. If there is no vision and the user wants the example, call seed_ppv_beijing_workspace.
3. For vision changes, call upsert_ppv_vision.
4. If the user wants to change a vision lifecycle without editing content, call set_ppv_vision_status.
5. If the user wants to switch between existing visions without editing content, call set_active_ppv_vision.
6. If the user wants to hide a vision but preserve its record, call archive_ppv_vision.
7. If the user wants to permanently remove a vision and its PPV subcomponents, call delete_ppv_vision.
8. For identity work, call upsert_ppv_identity.
9. For pillars, call create_ppv_pillar or update_ppv_pillar. Link only existing LifeOS project IDs from get_ppv_workspace.projects.
10. For fears, inversions, limiting beliefs, risks, or psychological friction, call get_belief_reframes, create_belief_reframe, or update_belief_reframe.
    - Use type fear, inversion, or limiting_belief.
    - Link with visionIds, projectIds, or issueIds from workspace or graph responses.
    - Use title for a short label, belief for the friction statement, and reframe for the response/rule.
    - For inversions, prefer inversionQuestion, avoidOutcome, failureMechanisms, preventiveRules, and warningSignals.
    - Resolve/archive by calling update_belief_reframe with status resolved or archived.

Keep the system simple:
- Vision is directional and experiential, not a task list.
- Identity describes who naturally lives the vision.
- Pillars are ongoing systems.
- Projects are existing LifeOS projects.
- Friction records are separate LifeDev records linked to PPV/project/issue context; do not stuff fears into vision or pillar prose.
- Weekly actions should be small, concrete, and identity-aligned.

After mutating, report exactly what changed and any IDs needed for future updates.`,
        },
      },
    ];
  },
  "falkor-graph": (args) => {
    const intentClause = args.intent
      ? `User intent: ${args.intent}`
      : "Start by inspecting the Falkor graph schema and current agent links.";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Use the LifeOS FalkorDB sidecar graph.

${intentClause}

Use these MCP tools:
1. Call falkor_graph_schema first to inspect the allowed graph contract and examples.
2. Use falkor_graph_query for read-only Cypher. MATCH/WITH queries must include LIMIT unless doing count aggregation.
3. Use falkor_graph_link when you need to create a relationship between existing Falkor nodes. This writes only AGENT_LINK relationships.
4. Use falkor_graph_unlink only to remove relationships previously created by falkor_graph_link.

Rules:
- Convex remains canonical for entity data. Do not use FalkorDB to edit projects or PPV records.
- FalkorDB is the graph sidecar.
- Always include a concrete reason and confidence when linking.
- Prefer precise node labels and convexId values from prior reads; do not invent ids.
- Keep queries scoped with LIMIT and return concise findings plus the Cypher you used when useful.`,
        },
      },
    ];
  },
  "weekly-review": (args) => {
    const dateClause = args.date
      ? `Use week start date: ${args.date}`
      : "Use this week.";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Run my weekly review. Use the LifeOS MCP tools to gather:

1. Call get_weekly_agenda for this week's agenda, AI summary, and Weekly AI Comments
2. Call get_current_cycle for sprint progress
3. Call get_tasks with status "done" to see what was completed
4. Call get_tasks with status "in_progress" to see what's still in flight
5. Call get_tasks with status "todo" to see upcoming work

${dateClause}

Present a weekly review:
- **Completed**: What got done this week
- **In Progress**: What's still being worked on
- **Sprint Health**: Cycle progress, burndown status
- **Blockers**: Anything overdue or stuck
- **Next Week**: Key items to tackle`,
        },
      },
    ];
  },
  "weekly-plan": (args) => {
    const dateClause = args.date
      ? `Use week start date: ${args.date}`
      : "Use this week.";
    const notesClause = args.notes ? `User instructions: ${args.notes}` : "";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Plan my week in LifeOS and apply the resulting mutations.

${dateClause}
${notesClause}

Workflow:
1. Call get_planning_context with daily=true, weekly=true, currentCycle=true, backlog=true, habits=true, dailyFields=true, calendar=true, voiceMemos=true.
2. Shape the week around the current cycle: update cycle goals, pull/assign tasks, assign tasks to days or deadlines with dueDate, add issue calendar blocks with schedule_issue, create protected non-ticket calendar blocks with create_calendar_block, and set near-term priorities.
3. Call apply_planning_patch with mode "week" and dryRun=false. Use operations as needed:
   - create_issue for new tasks
   - create_calendar_block for protected non-ticket time like errands, meals, dog walking, appointments, or holds
   - update_issue for dueDate, status, priority, and estimate changes
   - schedule_issue for each issue calendar block using issueIdOrIdentifier plus scheduledStartAt/scheduledEndAt, or date plus startTime/endTime; repeat for multiple blocks
   - assign_issue_to_current_cycle for current cycle work
   - set_top_priority for immediate focus
   - update_cycle_goals for the active cycle
   - save_weekly_note for the weekly plan
   - save_daily_note if today needs a concrete execution note
   - add_weekly_ai_comment for AI-only weekly observations, planning rationale, risks, or coaching notes
4. Return a concise weekly plan and list the mutations applied.

Do not ask for confirmation; the user intends this planning workflow to mutate LifeOS.`,
        },
      },
    ];
  },
  "sprint-plan": (args) => {
    const notesClause = args.notes ? `Additional context: ${args.notes}` : "";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Help me plan my current cycle/sprint in LifeOS and apply the resulting mutations.

1. Call get_planning_context with currentCycle=true, backlog=true, weekly=true, daily=true.
2. Shape the current cycle: update cycle goals, pull/assign tasks, assign near-term tasks to days or deadlines with dueDate, add issue calendar blocks with schedule_issue, create protected non-ticket calendar blocks with create_calendar_block, and set near-term priorities.
3. Call apply_planning_patch with mode "cycle" and dryRun=false. Use operations as needed:
   - create_issue for new tasks
   - create_calendar_block for protected non-ticket time that should appear on the calendar without creating a PM issue
   - assign_issue_to_current_cycle for current cycle work
   - update_issue for dueDate, status, priority, and estimate changes
   - schedule_issue for each issue calendar block using issueIdOrIdentifier plus scheduledStartAt/scheduledEndAt, or date plus startTime/endTime; repeat for multiple blocks
   - update_cycle_goals for active cycle goals
   - save_daily_note or save_weekly_note when useful as the readable plan artifact

${notesClause}

Then return:
- Current cycle goal and capacity
- Tasks assigned/scheduled
- Top priorities
- Any risks or overload

Do not ask for confirmation; the user intends this planning workflow to mutate LifeOS.`,
        },
      },
    ];
  },
  "contact-lookup": (args) => [
    {
      role: "user",
      content: {
        type: "text",
        text: `Look up everything about a contact. Use the LifeOS MCP tools:

1. Call get_contact_dossier with nameQuery "${args.name}" to get the full profile
   - This returns: person info, AI profile, Beeper threads, Granola meetings (with AI notes and calendar events), and voice memos

Present the dossier in a structured format:
- **Profile**: Name, relationship type, contact info, notes
- **AI Insights**: Communication style, personality, relationship tips (if available)
- **Recent Interactions**: Last few voice memos, meetings, and messages — sorted by recency
- **Meeting History**: Granola/Fathom meetings with key takeaways
- **Chat Threads**: Beeper conversation threads linked to this person`,
      },
    },
  ],
  "client-brief": (args) => [
    {
      role: "user",
      content: {
        type: "text",
        text: `Get a full client briefing for "${args.client}". Use the LifeOS MCP tools:

1. Call get_clients to find the matching client
2. Call get_client with the client ID for full details
3. Call get_projects_for_client to see all their projects and completion stats
4. Call get_beeper_threads_for_client to see linked chat threads

For each active project, also call get_phases to see phase breakdown.

Present as a client brief:
- **Client Overview**: Name, status, description
- **Projects**: Each project with status, health, priority, and phase breakdown
- **Completion Stats**: Issues done vs total across all projects
- **Recent Comms**: Latest Beeper thread activity
- **Action Items**: Any overdue or urgent tasks for this client`,
      },
    },
  ],
  "customer-success-triage": (args) => {
    const focusClause = args.focus ? `\n\nFocus area: ${args.focus}` : "";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Triage customer success work for "${args.client}". Use the LifeOS MCP tools:

1. Call get_client_success_workspace with clientIdOrName "${args.client}"
2. Review recentThreads, recentMeetings, notes, openTasks, and projects from that workspace
3. If any thread needs deeper inspection, call get_beeper_thread_messages for the relevant thread
4. If any meeting needs deeper inspection:
   - For Fathom, call get_fathom_meeting and optionally get_fathom_transcript
   - For Granola, call get_granola_meeting and optionally get_granola_transcript
5. If there is already requirement history, call get_client_notes for the client

Classify what you find into:
- **New Requirements**: Net-new asks or requested changes
- **Follow-Ups**: Things waiting on you or the team
- **Delivery Risks**: Blockers, overdue work, ambiguous asks, churn risk
- **Existing Tracking**: Open tasks or notes already covering the request

For each item, recommend the next tracking action:
- Use create_client_note to save requirement summaries, meeting recaps, or decisions
- Use create_issue for implementation work or follow-up tasks
- Use update_issue if an existing task should be re-scoped or reprioritized

Present the result as:
- **Situation Summary**: What the client currently needs
- **Evidence**: Supporting messages/meetings/notes
- **Tracking Plan**: What should be captured as notes vs. tasks
- **Next Actions**: Concrete owner/action/deadline suggestions

Ask for confirmation before any write operations unless I explicitly told you to make changes.${focusClause}`,
        },
      },
    ];
  },
  "project-status": (args) => [
    {
      role: "user",
      content: {
        type: "text",
        text: `Get project status for "${args.project}". Use the LifeOS MCP tools:

1. Call get_project with the project key/ID
2. Call get_phases for the project to see phase breakdown
3. Call get_tasks filtered by the project ID to see all issues

Present a project status report:
- **Overview**: Name, status, health, priority, client (if linked)
- **Phases**: Each phase with status and issue counts
- **Task Breakdown**: Count by status (backlog / todo / in_progress / in_review / done)
- **Urgent/Overdue**: Any urgent or overdue tasks
- **In Progress**: What's actively being worked on
- **Blockers**: Anything that looks stuck`,
      },
    },
  ],
  capture: (args) => [
    {
      role: "user",
      content: {
        type: "text",
        text: `Quick capture: "${args.input}"

Analyze the input and determine what type of capture this is:

**If it's a task/action item** (contains action verbs, deadlines, assignments):
- Use create_issue from LifeOS MCP tools
- Infer priority from urgency cues (e.g., "urgent", "ASAP" = urgent; "soon" = high; default = medium)
- If a project is mentioned, look it up with get_projects and assign it
- If a due date is mentioned, parse and set it

**If it's a thought/note** (observations, ideas, reminders):
- Use create_quick_note from LifeOS MCP tools
- Extract tags from context (e.g., topic keywords)

**If ambiguous**, default to creating a quick note.

After creating, confirm what was captured with the ID/identifier.`,
      },
    },
  ],
  "meeting-prep": (args) => [
    {
      role: "user",
      content: {
        type: "text",
        text: `Prepare for a meeting with "${args.name}". Use the LifeOS MCP tools:

1. Call get_contact_dossier with nameQuery "${args.name}" for full context
2. Call get_granola_meetings_for_person for past meeting notes
3. If person is linked to a client, call get_projects_for_client for project status
4. Call get_beeper_threads_for_person and for the most recent thread, call get_beeper_thread_messages to see latest messages

Compile a meeting prep brief:
- **About**: Who they are, relationship type, communication style (from AI profile)
- **Last Interaction**: When you last met/talked and what was discussed
- **Open Items**: Any action items or tasks related to them or their projects
- **Recent Messages**: Key points from recent Beeper conversations
- **Past Meetings**: Summary of last 3 meetings with key decisions/takeaways
- **Suggested Talking Points**: Based on open items and recent context`,
      },
    },
  ],
  "cycle-review": (args) => {
    const actionClause = args.action
      ? `\n\nThe user wants to: ${args.action === "rollover" ? "close the cycle AND roll over incomplete issues to the next cycle" : args.action === "close" ? "close the cycle (without rollover)" : args.action}`
      : "";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Review my current cycle/sprint. Use the LifeOS MCP tools:

1. Call get_current_cycle for the active cycle with progress stats
2. Call get_cycles with status "upcoming" to see what's next
3. Call get_tasks with status "in_progress" to see active work
4. Call get_tasks with status "backlog" or "todo" to see incomplete items in the cycle
${actionClause}

Present the cycle review:
- **Cycle Summary**: Name, dates, days remaining
- **Progress**: Completion %, issues done vs total
- **Incomplete Items**: List all non-done/non-cancelled issues with status and priority
- **Next Cycle**: Show the next upcoming cycle (if any)
- **Recommendations**:
  - If cycle is ending soon, suggest closing with rollover
  - If many items are incomplete, suggest re-prioritizing
  - If cycle is already past end date, strongly recommend closing it

${args.action === "close" ? "After presenting the review, call close_cycle to close the current cycle WITHOUT rolling over incomplete issues." : ""}
${args.action === "rollover" ? "After presenting the review, call close_cycle with rolloverIncomplete=true to close the cycle and move incomplete issues to the next cycle." : ""}
${!args.action ? "Ask the user if they want to close the cycle, and whether to roll over incomplete issues to the next cycle." : ""}`,
        },
      },
    ];
  },
  "initiative-review": (args) => {
    const year = args.year || new Date().getFullYear().toString();
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Review my yearly initiative progress. Use the LifeOS MCP tools:

1. Call get_initiative_yearly_rollup with year ${year} — this gives all initiatives with aggregated stats
2. For any initiative with low progress or stalled status, call get_initiative_with_stats for deeper details

Present the review:
- **Year ${year} Overview**: Total initiatives, active vs completed, average progress
- **By Category**: Group initiatives by category (career, health, learning, etc.) and show progress
- **Each Initiative**: Title, status, progress %, tasks completed/total, linked projects, habits
- **Highlights**: Call out any initiatives at 80%+ progress (near completion)
- **Concerns**: Flag initiatives with 0% progress, no linked projects, or "paused" status
- **Recommendations**: Suggest next actions — which initiatives to focus on, which need attention

Be concise but thorough. Use emoji for categories. Suggest linking unlinked projects/tasks if appropriate.`,
        },
      },
    ];
  },
  "client-health": (args) => {
    const filterClause =
      args.filter === "critical"
        ? "\n\nOnly show at-risk and critical clients."
        : "";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Show health dashboard across all clients. Use the LifeOS MCP tools:

1. Call get_clients to get all active clients
2. For each client, call get_projects_for_client to get project stats
3. Call get_tasks to analyze overdue/at-risk tasks per client
4. Call get_beeper_threads to check communication recency

Calculate health score for each client based on:
- **Project health**: Are projects on_track, at_risk, or off_track?
- **Task completion**: % of tasks done vs total
- **Overdue items**: Number of overdue tasks
- **Communication**: Days since last message/meeting
- **Revenue risk**: Active projects nearing completion without follow-on

Present as a dashboard:
| Client | Health | Projects | Overdue | Last Contact | Action |
|--------|--------|----------|---------|--------------|--------|

Then detail:
- **Healthy clients**: All good, maintain relationship
- **At-risk clients**: Need attention soon (explain why)
- **Critical clients**: Immediate action needed

For at-risk and critical, provide specific recommended actions.${filterClause}`,
        },
      },
    ];
  },
  "context-switch": (args) => [
    {
      role: "user",
      content: {
        type: "text",
        text: `Quickly load context for "${args.name}". Use the LifeOS MCP tools:

**If it's a client name:**
1. Call get_clients and find the matching client
2. Call get_client with the client ID for details
3. Call get_projects_for_client to see their projects
4. Call get_beeper_threads_for_client for recent communications

**If it's a project name/key:**
1. Call get_project with the project key/name
2. Call get_phases for the project phases
3. Call get_tasks filtered by the project to see active work
4. If project has a client, load client context too

Present a quick context brief:
- **Overview**: What this client/project is about
- **Current Status**: Active phase, health, completion %
- **Open Items**: Tasks in progress or todo (top 5)
- **Recent Activity**: Last meeting, last message (if available)
- **Blockers**: Anything stuck or overdue
- **Quick Actions**: Suggested next steps

Keep it scannable — this is for fast context loading, not deep analysis.`,
      },
    },
  ],
  "end-of-day": (args) => {
    const dateClause = args.date
      ? `Use date: ${args.date}`
      : "Use today's date.";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Run my end-of-day wrap-up. Use the LifeOS MCP tools:

1. Call get_daily_agenda for today's agenda
2. Call get_tasks with status "done" to see what was completed today
3. Call get_tasks with status "in_progress" to see what's still in flight
4. Call get_todays_tasks to see what was planned vs actual
5. Call get_recent_notes with limit 5 for any thoughts captured today

${dateClause}

Present an end-of-day summary:
- **Completed today**: What got done (celebrate wins!)
- **Still in progress**: What's carrying over
- **Moved to tomorrow**: Tasks that got bumped
- **Unplanned work**: Things that came up unexpectedly
- **Notes captured**: Any thoughts/ideas from today

Then prompt for reflection:
- What went well today?
- What was challenging?
- What's the #1 priority for tomorrow morning?

Offer to:
- Update any task statuses
- Create tasks for tomorrow based on reflection
- Capture any final thoughts as a note`,
        },
      },
    ];
  },
  "follow-ups": (args) => {
    const nameClause = args.name
      ? `\n\nFocus specifically on: "${args.name}"`
      : "";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Track follow-ups needed with people and clients. Use the LifeOS MCP tools:

1. Call get_people to get all contacts
2. Call get_clients to get all clients
3. Call get_beeper_threads to see recent message activity
4. Call get_granola_meetings to see recent meetings

Analyze and identify:
- **People needing follow-up**: Contacts with no interaction in 7+ days who have open items or recent meetings
- **Client follow-ups**: Clients with stale threads or meetings that had action items
- **Promised callbacks**: Any meetings/messages where you said "I'll get back to you"

Present as:
- **Urgent** (14+ days): People/clients you really need to reach out to
- **Soon** (7-14 days): Worth a quick check-in
- **Suggested actions**: Specific follow-up actions for each${nameClause}`,
        },
      },
    ];
  },
  "inbox-triage": (args) => {
    const autoMode =
      args.mode === "auto"
        ? "\n\nProcess automatically with best-guess actions instead of asking for confirmation."
        : "\n\nAsk for confirmation before making changes.";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Process captured notes and triage into actionable items. Use the LifeOS MCP tools:

1. Call get_recent_notes with limit 20 to get recent unprocessed captures
2. Call get_projects to know available projects for assignment
3. Call get_people to know contacts for linking

For each note, analyze and suggest:
- **Convert to task?** If it contains an action item, offer to create an issue
- **Link to person?** If it mentions someone, offer to link the note
- **Link to project?** If it relates to a project, suggest assignment
- **Add tags?** Suggest relevant tags based on content

Present as an interactive triage list:
- Show each note with its content summary
- Provide recommended action (task, tag, link, or archive)

After triage, use the appropriate tools:
- Call create_issue to convert notes to tasks
- Call add_tags_to_note to categorize
- Call link_memo_to_person to connect to people${autoMode}`,
        },
      },
    ];
  },
  "monthly-review": (args) => {
    const monthClause = args.month
      ? `Use month start date: ${args.month}-01`
      : "Use the current month.";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Run my monthly review. Use the LifeOS MCP tools:

1. Call get_monthly_agenda for this month's overview, AI summary, and Monthly AI Comments
2. Call get_cycles to see all sprints this month and their completion rates
3. Call get_tasks with status "done" to see everything completed this month
4. Call get_projects to see project progress and health
5. Call get_clients to review client status
6. Call get_recent_notes with limit 20 to review captured thoughts

${monthClause}

Present a monthly review:
- **Accomplishments**: Major wins and completed work this month
- **Projects Progress**: Status of each active project
- **Sprint Performance**: Average completion rate across cycles
- **Client Health**: How each client relationship is doing
- **Themes**: Patterns from notes and completed work
- **AI Comments**: Existing Monthly AI Comments that matter for the review
- **Carried Forward**: What's rolling into next month
- **Reflections**: What worked, what didn't
- **Next Month Focus**: Top 3 priorities for the coming month`,
        },
      },
    ];
  },
  overdue: (args) => {
    const filterClause =
      args.filter === "critical" || args.filter === "urgent"
        ? "\n\nOnly show critical items (7+ days overdue)."
        : "";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Show what's overdue or slipping. Use the LifeOS MCP tools:

1. Call get_overdue_tasks to get overdue open tasks
2. Call get_tasks with status "in_progress" to find stale active work
3. Call get_projects to get all projects with health status
4. Call get_current_cycle to see sprint status

Analyze and identify:
- **Overdue tasks**: Tasks returned by get_overdue_tasks
- **Off-track projects**: Projects with health "off_track" or "at_risk"
- **Stale in-progress**: Tasks marked "in_progress" for more than 7 days
- **Sprint slippage**: If cycle completion % is behind expected pace

Present as:
- **Critical** (7+ days overdue): Needs immediate attention
- **Overdue** (1-7 days): Should address soon
- **At Risk**: In-progress items that might slip
- **Projects Off Track**: Projects needing intervention

For each item, suggest: reschedule, delegate, or drop.${filterClause}`,
        },
      },
    ];
  },
  "relationship-pulse": (args) => {
    const typeClause = args.type
      ? `\n\nFilter to relationship type: "${args.type}"`
      : "";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Check on neglected relationships. Use the LifeOS MCP tools:

1. Call get_people to get all contacts
2. Call get_beeper_threads to check message activity
3. Call get_granola_meetings to see meeting history

Analyze each contact for:
- **Last interaction**: When did you last talk/meet?
- **Interaction frequency**: How often do you typically connect?
- **Relationship type**: Family, friend, colleague, mentor, etc.

Identify neglected relationships:
- **Family/Close friends**: No contact in 14+ days
- **Friends**: No contact in 30+ days
- **Colleagues/Mentors**: No contact in 60+ days
- **Acquaintances**: No contact in 90+ days

Present as:
- **Reach out soon**: People you should contact (prioritized by relationship closeness)
- **Consider reconnecting**: People you might want to re-engage
- **Suggested touchpoints**: Quick ways to reconnect (reply to old thread, schedule catch-up, etc.)${typeClause}`,
        },
      },
    ];
  },
  "voice-notes": (args) => {
    const topicClause = args.topic
      ? `\n\nStart by exploring: "${args.topic}"`
      : "\n\nShow recent activity and ask what I want to explore.";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Explore and work with my voice notes interactively. Use the LifeOS MCP tools.

This is an interactive session to help me think through my voice notes, formulate plans, refine ideas, and review journal entries.

**Getting Started:**
1. Call get_voice_memo_labels to see all topics/labels
2. Call get_recent_notes with limit 10 to see recent entries

**Based on what I want to explore:**
- To review recent notes: Call get_recent_notes or get_voice_memos_by_date
- To explore a topic: Call get_voice_memos_by_labels or search_notes
- To review a time period: Call get_voice_memos_by_date with date range
- For deeper analysis: Call get_voice_memo for full details

**During the conversation:**
- Help me think through my notes
- Identify patterns and connections across memos
- Surface action items I may have forgotten
- Help formulate new plans or refine existing ideas
- Offer reflections on journal entries

**At the end:** Offer to crystallize insights using the voice-notes-crystallize prompt.${topicClause}`,
        },
      },
    ];
  },
  "personal-records": (args) => {
    const queryClause = args.query
      ? `\n\nStart by retrieving context for: "${args.query}"`
      : "\n\nStart by listing recent Personal Records and ask what context I want loaded.";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Retrieve and use my Personal Records as private RAG context. Use the LifeOS MCP tools.

Personal Records are atomic markdown records with tags and attachments. They may contain personal policies, decision notes, reusable context, references, and facts that should guide the answer.

**Retrieval flow:**
1. If I provide a question/topic, call retrieve_personal_records with that query first.
2. If retrieval snippets are insufficient, call get_personal_record for the most relevant record IDs.
3. If I am browsing/exploring, call get_personal_records or search_personal_records.

**Answering rules:**
- Treat retrieved records as private source context.
- Prefer record-backed facts over guesses.
- Mention which record titles informed the answer when useful.
- Do not invent records or claim unavailable context.
- Use attachments only as metadata unless a returned URL is directly needed.${queryClause}`,
        },
      },
    ];
  },
  "voice-notes-crystallize": (args) => {
    const titleClause = args.title
      ? `Use title: "${args.title}"`
      : "Generate a title based on the conversation.";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Save a crystallized summary of our conversation about voice notes. Use the LifeOS MCP tools.

${titleClause}

**Analyze the conversation and extract:**

1. **Title**: A descriptive title for this crystallization
2. **Summary**: The main insights, conclusions, or outcomes (2-4 paragraphs)
3. **Key Insights**: 3-7 bullet points of the most important realizations
4. **Action Items**: Any tasks or actions that emerged
5. **Ideas**: New ideas, plans, or directions formulated
6. **Tags**: 3-5 relevant tags for categorization

**Determine the summary type:**
- reflection — Processing past experiences or feelings
- planning — Creating plans or strategies
- brainstorm — Generating new ideas
- journal_review — Reviewing journal/diary entries
- idea_refinement — Developing and refining existing ideas

**Save using:** Call create_ai_convo_summary with the extracted data.

**After saving:** Confirm success and show the summary ID.`,
        },
      },
    ];
  },
  "health-check": (args) => {
    const daysCount = args.days ? parseInt(args.days) : 7;
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Give me a quick health overview. Use the LifeOS MCP tools to gather Oura Ring data for the last ${daysCount} days:

1. Call get_health_sleep with days=${daysCount} for sleep scores, durations, bedtime, breath rate
2. Call get_health_activity with days=${daysCount} for activity scores and steps
3. Call get_health_readiness with days=${daysCount} for readiness scores
4. Call get_health_heart_rate with days=${daysCount} for resting heart rate trends
5. Call get_health_resilience with days=${daysCount} for resilience levels
6. Call get_health_vo2_max with days=${daysCount} for VO2 max estimates
7. Call get_health_cardio_age with days=${daysCount} for cardiovascular age

Present a concise health dashboard:
- **Overall Status**: Quick assessment (great / good / needs attention)
- **Sleep**: Average score, total sleep trend, bedtime consistency, avg breath rate, any concerning nights
- **Activity**: Average score, daily steps, active calories
- **Readiness**: Average score, trend direction (improving/declining/stable)
- **Heart Rate**: Resting HR trend, HRV if available
- **Resilience**: Current level and trend (limited/adequate/solid/strong/exceptional)
- **Fitness**: VO2 max trend, cardiovascular age vs actual age
- **Insights**: 2-3 actionable observations based on the data

Keep it concise. Highlight anything unusual or noteworthy.`,
        },
      },
    ];
  },
  "health-weekly": (args) => {
    const weeksCount = args.weeks ? parseInt(args.weeks) : 2;
    const daysCount = weeksCount * 7;
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Run a weekly health review for the last ${weeksCount} week(s). Use the LifeOS MCP tools:

1. Call get_health_sleep with days=${daysCount} for sleep data (scores, durations, bedtime, breath rate, restless periods)
2. Call get_health_activity with days=${daysCount} for activity data
3. Call get_health_readiness with days=${daysCount} for readiness data
4. Call get_health_stress with days=${daysCount} for stress/recovery data
5. Call get_health_workouts with days=${daysCount} for workout history (prefer label over activity for display name)
6. Call get_health_heart_rate with days=${daysCount} for HR trends
7. Call get_health_resilience with days=${daysCount} for resilience levels and contributors
8. Call get_health_vo2_max with days=${daysCount} for VO2 max estimates
9. Call get_health_cardio_age with days=${daysCount} for cardiovascular age
10. Call get_health_spo2 with days=${daysCount} for SpO2 and breathing disturbance index

Present a detailed weekly health review:
- **Sleep Quality**: Weekly average scores, best/worst nights, sleep duration trends, deep/REM balance, bedtime consistency, avg breath rate
- **Activity Patterns**: Weekly step averages, active days vs rest days, calorie burn
- **Readiness & Recovery**: Score trends, stress vs recovery balance, temperature trend
- **Resilience**: Daily levels trend (limited→exceptional), contributor breakdown (sleep recovery, daytime recovery, stress)
- **Fitness**: VO2 max trend (ml/kg/min), cardiovascular age trend, week-over-week changes
- **Workouts**: List workouts with type/label, duration, calories burned
- **Heart Rate & Breathing**: Resting HR trend, HRV trend, SpO2, breathing disturbance index
- **Week-over-Week**: Compare this week vs last week (if multiple weeks)
- **Recommendations**: 3-5 specific, actionable health recommendations

Group data by week for easy comparison.`,
        },
      },
    ];
  },
  "finance-overview": (args) => {
    const daysCount = args.days ? parseInt(args.days) : 90;
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Give me a financial overview. Use the LifeOS MCP tools:

1. Call get_finance_net_worth for current net worth and account breakdown
2. Call get_finance_accounts for all account details
3. Call get_finance_snapshots with days=${daysCount} for net worth trend

Present a financial dashboard:
- **Net Worth**: Current total with change over the period
- **Assets**: Total assets, broken down by account type (checking, savings, investments, retirement)
- **Liabilities**: Total liabilities, broken down by type (credit cards, loans)
- **Trend**: Net worth direction over the last ${daysCount} days (growing/declining/stable)
- **Accounts**: List each account with name, type, and current balance (convert cents to dollars)
- **Insights**: Notable changes or patterns

Convert all amounts from cents to dollars for display. Format as currency.`,
        },
      },
    ];
  },
  "finance-spending": (args) => {
    const daysCount = args.days ? parseInt(args.days) : 30;
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Analyze my spending patterns. Use the LifeOS MCP tools:

1. Call get_finance_daily_spending with days=${daysCount} for daily income/spending aggregation
2. Call get_finance_transactions with limit=50 for recent transaction details

Present a spending analysis:
- **Summary**: Total income, total spending, net for the period
- **Daily Average**: Average daily spending
- **Spending Pattern**: Identify high-spending days and patterns
- **Recent Transactions**: Show the most notable recent transactions
- **Insights**: Spending trends, any unusual activity, suggestions

Convert all amounts from cents to dollars. Format as currency.`,
        },
      },
    ];
  },
  "habit-check": (args) => {
    const habitsClause = args.habits
      ? `The user wants to check in these specific habits: ${args.habits}. Use check_in_habit to mark them as completed.`
      : "";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Run a daily habit check-in. Use the LifeOS tools to:

1. Call get_habits_for_date with today's date to see all scheduled habits and their status
2. Call get_habits to see full habit list with streaks

Present a clear dashboard showing:
- Each habit scheduled for today with status (completed/pending/skipped)
- Current streaks for each habit
- Overall completion rate for today
- Any streaks at risk (habits not yet completed today that have active streaks)

${habitsClause}

Tone: Direct, accountability-focused. Celebrate completed habits, flag pending ones with urgency.`,
        },
      },
    ];
  },
  "daily-training-report": (args) => {
    const dateClause = args.date
      ? `Use date: ${args.date}`
      : "Use today's date.";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Generate a comprehensive daily training report. Use the LifeOS tools to gather:

1. HABITS: Call get_habits_for_date for yesterday's date (habit compliance review)
2. HABITS TODAY: Call get_habits_for_date for today's date (today's targets)
3. HEALTH: Call get_health_sleep, get_health_readiness, get_health_activity (1 day each) for Oura Ring data
4. AGENDA: Call get_daily_agenda for today's schedule and tasks
5. INITIATIVES: Call get_initiatives to check yearly goal progress

${dateClause}

Synthesize into a structured report:

**YESTERDAY'S RESULTS**
- Habit completion: X/Y completed, list each with status
- Streaks maintained or broken
- Health scores (sleep, readiness, activity)

**TODAY'S FOCUS**
- Top 3 priorities (from agenda + top priority tasks)
- Habits scheduled for today
- Any overdue items or broken streaks to recover

**ACCOUNTABILITY**
- Habits skipped or missed yesterday (call these out directly)
- Streak warnings (habits with active streaks that need attention today)
- "Never skip a rep" reminder for any pending habits

**ADHD FOCUS CHECK**
- Are today's tasks aligned with your initiatives/yearly goals?
- Flag any "busy work" vs "real progress" items
- Suggested focus blocks for deep work

Keep it direct and no-BS. This is a personal trainer report, not a gentle suggestion.`,
        },
      },
    ];
  },
  "screentime-report": (args) => {
    const daysCount = args.days ? parseInt(args.days, 10) : 7;
    return [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Generate a screen time report. Use the LifeOS MCP tools to gather:

1. Call get_screentime_summary with days=${daysCount} for daily totals and app breakdowns
2. Call get_screentime_top_apps with days=${daysCount} and limit=15 for top time-sink apps
3. Call get_screentime_categories with days=${daysCount} for category-level aggregation

Present a structured report:

**USAGE OVERVIEW**
- Total screen time over ${daysCount} days and daily average
- Trend: increasing / decreasing / stable compared to prior period

**TOP APPS**
- Rank apps by total usage time
- Flag any social media or entertainment apps in the top 5 with a warning

**CATEGORY BREAKDOWN**
- Show % split: Productivity vs Social vs Entertainment vs Communication vs Other
- Highlight if Entertainment + Social > 40% of total

**SOCIAL MEDIA ALERT**
- If any social media app (Twitter/X, Instagram, TikTok, Reddit, Facebook, YouTube) exceeds 1 hour/day average, call it out explicitly
- Estimate weekly hours wasted on social media

**INSIGHTS**
- 2-3 actionable observations
- Compare productive vs non-productive time
- Suggest one app to reduce and one habit to build

Keep it concise and direct. This is an accountability report, not a feel-good summary.`,
        },
      },
    ];
  },
};

// Configuration: CLI flags take precedence over env vars
// NOTE: HTTP routes are served from .convex.site, NOT .convex.cloud
const CONVEX_URL =
  options.url || process.env.CONVEX_URL || process.env.LIFEOS_CONVEX_URL;
const API_KEY = options.apiKey || process.env.LIFEOS_API_KEY;
const USER_ID = options.userId || process.env.LIFEOS_USER_ID;
const FALKOR_BROWSER_ENDPOINT =
  process.env.FALKOR_BROWSER_ENDPOINT || "https://falkordb.apps.rjlabs.dev";
const FALKOR_GRAPH = process.env.FALKOR_GRAPH || "lifeos_ppv";
const FALKOR_USER = process.env.FALKOR_USER || "default";
const FALKOR_PASS = process.env.FALKOR_PASS;
const FALKOR_TOKEN = process.env.FALKOR_TOKEN || process.env.FALKOR_PAT;
const FALKOR_HOST = process.env.FALKOR_HOST || "localhost";
const FALKOR_PORT = process.env.FALKOR_PORT || "6379";
const FALKOR_TLS = process.env.FALKOR_TLS || "false";

// Validate required configuration
const missingConfig: string[] = [];
if (!CONVEX_URL) {
  missingConfig.push("CONVEX_URL (--url, CONVEX_URL, or LIFEOS_CONVEX_URL env)");
}
if (!API_KEY) missingConfig.push("API_KEY (--api-key or LIFEOS_API_KEY env)");
if (!USER_ID) missingConfig.push("USER_ID (--user-id or LIFEOS_USER_ID env)");

if (missingConfig.length > 0) {
  console.error("Error: Missing required configuration:");
  missingConfig.forEach((c) => console.error(`  - ${c}`));
  console.error("");
  console.error("Example usage:");
  console.error(
    "  lifeos-mcp --url https://your-app.convex.site --user-id xxx --api-key yyy",
  );
  console.error("");
  console.error("Or with environment variables:");
  console.error(
    "  CONVEX_URL=https://your-app.convex.site LIFEOS_USER_ID=xxx LIFEOS_API_KEY=yyy lifeos-mcp",
  );
  process.exit(1);
}

/**
 * Call the Convex /tool-call HTTP endpoint
 */
async function callConvexTool(
  tool: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const url = `${CONVEX_URL!}/tool-call`;

  // Extract userId from params if provided, otherwise use default
  const { userId: overrideUserId, ...toolParams } = params;
  const effectiveUserId = (overrideUserId as string) || USER_ID!;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY!,
    },
    body: JSON.stringify({
      tool,
      userId: effectiveUserId,
      params: toolParams,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Convex API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  if (!result.success && result.error) {
    throw new Error(result.error);
  }

  return result.result;
}

async function runDirectCliCommand(command: DirectCliCommand): Promise<void> {
  if (command.kind === "agenda") {
    const scope = command.scope.toLowerCase();
    const include =
      scope === "day"
        ? {
            daily: true,
            weekly: false,
            currentCycle: true,
            backlog: true,
            habits: true,
            dailyFields: true,
            calendar: true,
            voiceMemos: true,
          }
        : scope === "week"
          ? {
              daily: true,
              weekly: true,
              currentCycle: true,
              backlog: true,
              habits: true,
              dailyFields: true,
              calendar: true,
              voiceMemos: true,
            }
          : scope === "cycle"
            ? {
                daily: false,
                weekly: false,
                currentCycle: true,
                backlog: true,
                habits: false,
                dailyFields: false,
                calendar: false,
                voiceMemos: false,
              }
            : undefined;

    const result = await callConvexTool("get_planning_context", {
      date: command.date,
      weekStartDate: command.weekStartDate,
      include,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command.kind === "ppv") {
    const actionToTool: Record<string, string> = {
      workspace: "get_ppv_workspace",
      graph: "get_active_vision_graph",
      "vision-graph": "get_active_vision_graph",
      seed: "seed_ppv_beijing_workspace",
      vision: "upsert_ppv_vision",
      status: "set_ppv_vision_status",
      "set-status": "set_ppv_vision_status",
      "activate-vision": "set_active_ppv_vision",
      "set-active-vision": "set_active_ppv_vision",
      "archive-vision": "archive_ppv_vision",
      "delete-vision": "delete_ppv_vision",
      identity: "upsert_ppv_identity",
      pillar: "create_ppv_pillar",
      "update-pillar": "update_ppv_pillar",
      "delete-pillar": "delete_ppv_pillar",
      frictions: "get_belief_reframes",
      "list-frictions": "get_belief_reframes",
      "create-friction": "create_belief_reframe",
      "update-friction": "update_belief_reframe",
      "resolve-friction": "update_belief_reframe",
    };
    const tool = actionToTool[command.action];
    if (!tool) {
      throw new Error(
        `Unknown PPV action "${command.action}". Use one of: ${Object.keys(actionToTool).join(", ")}`,
      );
    }

    const payload = command.file
      ? (JSON.parse(await readFile(command.file, "utf8")) as Record<
          string,
          unknown
        >)
      : {};
    if (command.action === "resolve-friction") {
      payload.status ??= "resolved";
      payload.isResolved ??= true;
    }
    const result = await callConvexTool(tool, payload);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command.kind === "voiceSummary") {
    const actionToTool: Record<string, string> = {
      list: "get_voice_notes_aggregate_ai_summaries",
      get: "get_voice_notes_aggregate_ai_summary",
      search: "search_voice_notes_aggregate_ai_summaries",
      add: "create_voice_notes_aggregate_ai_summary",
      create: "create_voice_notes_aggregate_ai_summary",
    };
    const tool = actionToTool[command.action];
    if (!tool) {
      throw new Error(
        `Unknown voice-summary action "${command.action}". Use one of: ${Object.keys(actionToTool).join(", ")}`,
      );
    }

    const payload = command.file
      ? (JSON.parse(await readFile(command.file, "utf8")) as Record<
          string,
          unknown
        >)
      : {};
    if (command.summaryId) {
      payload.summaryId = command.summaryId;
    }
    if (command.query) {
      payload.query = command.query;
    }
    if (command.limit !== undefined) {
      payload.limit = command.limit;
    }

    const result = await callConvexTool(tool, payload);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command.kind === "personalRecords") {
    const actionToTool: Record<string, string> = {
      list: "get_personal_records",
      get: "get_personal_record",
      search: "search_personal_records",
      retrieve: "retrieve_personal_records",
      rag: "retrieve_personal_records",
    };
    const tool = actionToTool[command.action];
    if (!tool) {
      throw new Error(
        `Unknown personal-records action "${command.action}". Use one of: ${Object.keys(actionToTool).join(", ")}`,
      );
    }

    const payload: Record<string, unknown> = {};
    if (command.recordId) payload.recordId = command.recordId;
    if (command.query) payload.query = command.query;
    if (command.tag) payload.tag = command.tag;
    if (command.includeArchived !== undefined) {
      payload.includeArchived = command.includeArchived;
    }
    if (command.limit !== undefined) payload.limit = command.limit;
    if (command.maxSnippetChars !== undefined) {
      payload.maxSnippetChars = command.maxSnippetChars;
    }

    const result = await callConvexTool(tool, payload);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const patch = JSON.parse(await readFile(command.file, "utf8")) as Record<
    string,
    unknown
  >;
  if (command.dryRun !== undefined) {
    patch.dryRun = command.dryRun;
  }
  const result = await callConvexTool("apply_planning_patch", patch);
  console.log(JSON.stringify(result, null, 2));
}

async function callConvexJsonEndpoint(
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const url = `${CONVEX_URL!}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY!,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Convex API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

async function callLlmCouncilArtifacts(
  action: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const { userId: overrideUserId, ...payload } = params;
  return await callConvexJsonEndpoint("/llmcouncil/artifacts", {
    action,
    userId: (overrideUserId as string) || USER_ID,
    ...payload,
  });
}

type JsonObject = Record<string, unknown>;

function stripSqlCommentsAndStrings(sql: string): string {
  let output = "";
  let index = 0;
  let quote: "'" | '"' | "`" | null = null;

  while (index < sql.length) {
    const current = sql[index]!;
    const next = sql[index + 1];

    if (quote) {
      if (current === "\\" && next !== undefined) {
        output += "  ";
        index += 2;
        continue;
      }
      if (current === quote) {
        quote = null;
      }
      output += " ";
      index += 1;
      continue;
    }

    if (current === "-" && next === "-") {
      while (index < sql.length && sql[index] !== "\n") {
        output += " ";
        index += 1;
      }
      continue;
    }

    if (current === "/" && next === "*") {
      output += "  ";
      index += 2;
      while (
        index < sql.length &&
        !(sql[index] === "*" && sql[index + 1] === "/")
      ) {
        output += " ";
        index += 1;
      }
      if (index < sql.length) {
        output += "  ";
        index += 2;
      }
      continue;
    }

    if (current === "'" || current === '"' || current === "`") {
      quote = current;
      output += " ";
      index += 1;
      continue;
    }

    output += current;
    index += 1;
  }

  return output;
}

function clampMaxRows(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 50;
  return Math.max(1, Math.min(200, Math.floor(value)));
}

function assertRecordId(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
  if (value.length > 256) {
    throw new Error(`${label} is too long.`);
  }
  return value;
}

function assertRelationKind(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_]{1,63}$/.test(value)) {
    throw new Error(
      "kind must be lower snake-case, e.g. related_to or discussed_in.",
    );
  }
  return value;
}

type FalkorConfig = {
  endpoint: string;
  graph: string;
  username: string;
  password?: string;
  token?: string;
  host: string;
  port: string;
  tls: string;
};

type FalkorQueryResult = {
  data?: unknown[];
  metadata?: string[];
  detail?: string;
};

const FALKOR_AGENT_RELATIONSHIP = "AGENT_LINK";
const FALKOR_NODE_LABELS = [
  "PpvVision",
  "PpvIdentity",
  "PpvPillar",
  "PpvProject",
];
const FALKOR_INFERRED_RELATIONSHIPS = [
  "HAS_IDENTITY",
  "HAS_PILLAR",
  "PILLAR_SUPPORTS_PROJECT",
];
const FALKOR_MUTATING_KEYWORDS = [
  "CALL",
  "CREATE",
  "DELETE",
  "DROP",
  "FOREACH",
  "LOAD",
  "MERGE",
  "REMOVE",
  "SET",
];

function requireFalkorConfig(): FalkorConfig {
  if (!FALKOR_TOKEN && !FALKOR_PASS) {
    throw new Error(
      "Missing FalkorDB configuration: set FALKOR_TOKEN/FALKOR_PAT or FALKOR_PASS in the agent runtime.",
    );
  }

  return {
    endpoint: FALKOR_BROWSER_ENDPOINT,
    graph: FALKOR_GRAPH,
    username: FALKOR_USER,
    password: FALKOR_PASS,
    token: FALKOR_TOKEN,
    host: FALKOR_HOST,
    port: FALKOR_PORT,
    tls: FALKOR_TLS,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cypherString(value: unknown) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function cypherValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return cypherString(value);
  if (Array.isArray(value)) return `[${value.map(cypherValue).join(", ")}]`;
  return cypherString(JSON.stringify(value));
}

function cypherProps(props: Record<string, unknown>) {
  return `{${Object.entries(props)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${cypherValue(value)}`)
    .join(", ")}}`;
}

async function requestFalkorToken(config: FalkorConfig, attempt: number) {
  if (!config.password) {
    throw new Error("FALKOR_PASS is required when FALKOR_TOKEN is not set.");
  }

  const tokenName = [
    "lifeos-mcp",
    attempt === 0 ? "graph" : "retry",
    Date.now(),
    Math.random().toString(36).slice(2, 10),
  ].join("-");
  const response = await fetch(
    `${config.endpoint.replace(/\/$/, "")}/api/auth/tokens/credentials`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: config.username,
        password: config.password,
        host: config.host,
        port: config.port,
        tls: config.tls,
        name: tokenName,
        ttlSeconds: 3600,
      }),
    },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`FalkorDB auth failed (${response.status}): ${text}`);
  }

  const parsed = JSON.parse(text) as { token?: string };
  if (!parsed.token) {
    throw new Error(`FalkorDB auth returned no token: ${text}`);
  }

  return parsed.token;
}

async function getFalkorToken(config: FalkorConfig) {
  if (config.token) return config.token;

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await requestFalkorToken(config, attempt);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(250 * (attempt + 1));
    }
  }

  throw lastError;
}

function parseFalkorEventStream(text: string): FalkorQueryResult {
  const data = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n")
    .trim();

  if (!data) return { data: [], metadata: [] };
  return JSON.parse(data) as FalkorQueryResult;
}

async function runFalkorQuery(query: string): Promise<FalkorQueryResult> {
  const config = requireFalkorConfig();
  const token = await getFalkorToken(config);
  const url = `${config.endpoint.replace(/\/$/, "")}/api/graph/${encodeURIComponent(
    config.graph,
  )}?query=${encodeURIComponent(query)}&timeout=30000`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`FalkorDB query failed (${response.status}): ${text}`);
  }

  return parseFalkorEventStream(text);
}

function assertReadOnlyFalkorCypher(query: string): void {
  const stripped = stripSqlCommentsAndStrings(query).trim();
  if (!stripped) throw new Error("FalkorDB Cypher query is empty.");
  if (stripped.includes(";")) {
    throw new Error(
      "falkor_graph_query allows one Cypher statement at a time.",
    );
  }

  const upper = stripped.toUpperCase();
  const startsReadOnly =
    upper.startsWith("MATCH ") ||
    upper.startsWith("WITH ") ||
    upper.startsWith("RETURN ") ||
    upper.startsWith("EXPLAIN ") ||
    upper.startsWith("PROFILE ");
  if (!startsReadOnly) {
    throw new Error(
      "falkor_graph_query only allows read-only Cypher. Start with MATCH, WITH, RETURN, EXPLAIN, or PROFILE.",
    );
  }

  for (const keyword of FALKOR_MUTATING_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, "i").test(stripped)) {
      throw new Error(
        `falkor_graph_query blocked mutating keyword ${keyword}. Use falkor_graph_link for guarded relationship writes.`,
      );
    }
  }

  const isAggregateCount = /\bCOUNT\s*\(/i.test(stripped);
  if (
    (upper.startsWith("MATCH ") || upper.startsWith("WITH ")) &&
    !/\bLIMIT\b/i.test(stripped) &&
    !isAggregateCount
  ) {
    throw new Error(
      "MATCH/WITH queries must include LIMIT unless they are aggregate count queries.",
    );
  }
}

function capFalkorResult(
  result: FalkorQueryResult,
  maxRows: number,
): FalkorQueryResult {
  const rows = result.data ?? [];
  if (rows.length <= maxRows) return result;
  return {
    ...result,
    data: rows.slice(0, maxRows),
    detail: `${rows.length - maxRows} additional rows omitted by lifeos-mcp maxRows=${maxRows}`,
  };
}

function assertFalkorIdentifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`${label} must be a simple Falkor identifier.`);
  }
  return value;
}

function assertFalkorLabel(value: unknown, label: string): string {
  const nodeLabel = assertFalkorIdentifier(value, label);
  if (!FALKOR_NODE_LABELS.includes(nodeLabel)) {
    throw new Error(
      `${label} must be one of: ${FALKOR_NODE_LABELS.join(", ")}`,
    );
  }
  return nodeLabel;
}

function falkorLinkId(parts: {
  fromLabel: string;
  fromId: string;
  toLabel: string;
  toId: string;
  kind: string;
}) {
  return [parts.kind, parts.fromLabel, parts.fromId, parts.toLabel, parts.toId]
    .join("__")
    .replace(/[^A-Za-z0-9_:-]/g, "_")
    .slice(0, 512);
}

function falkorGraphSchema() {
  return {
    schemaVersion: 2,
    configured: Boolean(FALKOR_TOKEN || FALKOR_PASS),
    endpointConfigured: Boolean(FALKOR_BROWSER_ENDPOINT),
    graph: FALKOR_GRAPH,
    nodeLabels: FALKOR_NODE_LABELS,
    inferredRelationshipTypes: FALKOR_INFERRED_RELATIONSHIPS,
    agentWritableRelationshipType: FALKOR_AGENT_RELATIONSHIP,
    purpose:
      "FalkorDB is the LifeOS PPV graph sidecar. Convex remains canonical for records; Falkor is optimized for graph traversal and agent-owned relationship memory.",
    identity:
      "Every mirrored node uses convexId as the stable canonical id. Use node.convexId for lookups and falkor_graph_link endpoint ids.",
    commonNodeProperties: [
      "convexId",
      "sourceSystem",
      "sourceTable",
      "sourceUserId",
      "syncedAt",
      "payloadJson",
      "title",
      "status",
      "visionId",
      "projectId",
      "pillarId",
      "updatedAt",
      "createdAt",
    ],
    labels: [
      {
        label: "PpvVision",
        convexTable: "ppv1_visions",
        meaning: "Desired future / life direction record.",
        primaryFields: ["convexId", "title", "status", "visionId", "updatedAt"],
        statusValues: ["ideation", "todo", "planned", "in_progress", "done"],
        commonFilters: ["v.status = 'in_progress'", "v.convexId = 'VISION_ID'"],
      },
      {
        label: "PpvIdentity",
        convexTable: "ppv1_identities",
        meaning: "Identity, beliefs, and behavior components for a PPV vision.",
        primaryFields: ["convexId", "title", "visionId", "updatedAt"],
        commonFilters: ["identity.visionId = 'VISION_ID'"],
      },
      {
        label: "PpvPillar",
        convexTable: "ppv1_pillars",
        meaning: "Ongoing system or pillar that supports a PPV vision.",
        primaryFields: ["convexId", "title", "visionId", "updatedAt"],
        commonFilters: ["pillar.visionId = 'VISION_ID'"],
      },
      {
        label: "PpvProject",
        convexTable: "lifeos_pmProjects",
        meaning:
          "Existing LifeOS project mirrored into Falkor only when linked to PPV pillars.",
        primaryFields: [
          "convexId",
          "title",
          "status",
          "projectId",
          "updatedAt",
        ],
        commonFilters: [
          "project.convexId = 'PROJECT_ID'",
          "project.title CONTAINS 'keyword'",
        ],
      },
    ],
    inferredRelationships: [
      {
        type: "HAS_IDENTITY",
        from: "PpvVision",
        to: "PpvIdentity",
        source: "Convex sync",
        meaning: "Vision owns an identity model.",
        mutableByAgent: false,
      },
      {
        type: "HAS_PILLAR",
        from: "PpvVision",
        to: "PpvPillar",
        source: "Convex sync",
        meaning: "Vision owns/supports a pillar.",
        mutableByAgent: false,
      },
      {
        type: "PILLAR_SUPPORTS_PROJECT",
        from: "PpvPillar",
        to: "PpvProject",
        source: "Convex sync",
        meaning: "Pillar is connected to an existing LifeOS project.",
        mutableByAgent: false,
      },
    ],
    agentWritableRelationship: {
      type: FALKOR_AGENT_RELATIONSHIP,
      mutableByAgent: true,
      createWith: "falkor_graph_link",
      deleteWith: "falkor_graph_unlink",
      allowedEndpoints: FALKOR_NODE_LABELS,
      fields: [
        "convexId",
        "kind",
        "reason",
        "confidence",
        "createdBy",
        "createdAt",
        "updatedAt",
        "metadataJson",
      ],
      guidance:
        "Use AGENT_LINK for durable interpretations, evidence, cross-cutting themes, or useful associations that are not Convex-canonical facts.",
    },
    queryRules: [
      "Use falkor_graph_query for read-only Cypher only.",
      "MATCH/WITH queries must include LIMIT unless they are aggregate count queries.",
      "Prefer projected fields such as convexId, title, status, visionId, kind, reason, and confidence over returning whole nodes.",
      "Use falkor_graph_link for agent-created relationships; it writes only AGENT_LINK edges.",
      "Do not mutate Convex-synced nodes or inferred PPV relationships from FalkorDB. Convex remains canonical.",
      "Every agent link must include a reason and confidence.",
    ],
    queryRecipes: [
      {
        name: "schemaCounts",
        when: "Check whether the sidecar has data before deeper traversal.",
        cypher:
          "MATCH (n) RETURN labels(n) AS labels, count(n) AS count ORDER BY count DESC",
      },
      {
        name: "currentVisionMap",
        when: "Show what the in-progress PPV vision is driving.",
        cypher:
          "MATCH (v:PpvVision {status: 'in_progress'}) OPTIONAL MATCH (v)-[:HAS_IDENTITY]->(identity:PpvIdentity) OPTIONAL MATCH (v)-[:HAS_PILLAR]->(pillar:PpvPillar) OPTIONAL MATCH (pillar)-[:PILLAR_SUPPORTS_PROJECT]->(project:PpvProject) RETURN v.convexId AS visionId, v.title AS vision, identity.convexId AS identityId, pillar.convexId AS pillarId, pillar.title AS pillar, project.convexId AS projectId, project.title AS project LIMIT 50",
      },
      {
        name: "visionToProjects",
        when: "Trace a specific vision into pillars and linked projects.",
        cypher:
          "MATCH (v:PpvVision {convexId: 'VISION_ID'})-[:HAS_PILLAR]->(pillar:PpvPillar)-[:PILLAR_SUPPORTS_PROJECT]->(project:PpvProject) RETURN v.convexId AS visionId, v.title AS vision, pillar.convexId AS pillarId, pillar.title AS pillar, project.convexId AS projectId, project.title AS project, project.status AS projectStatus LIMIT 50",
      },
      {
        name: "projectWhyItMatters",
        when: "Explain which PPV pillar or vision a project supports.",
        cypher:
          "MATCH (v:PpvVision)-[:HAS_PILLAR]->(pillar:PpvPillar)-[:PILLAR_SUPPORTS_PROJECT]->(project:PpvProject {convexId: 'PROJECT_ID'}) RETURN project.convexId AS projectId, project.title AS project, pillar.convexId AS pillarId, pillar.title AS pillar, v.convexId AS visionId, v.title AS vision LIMIT 10",
      },
      {
        name: "agentLinksAroundRecord",
        when: "Inspect agent-created memory around a node before adding or deleting links.",
        cypher:
          "MATCH (node {convexId: 'CONVEX_ID'})-[r:AGENT_LINK]-(other) RETURN labels(node) AS nodeLabels, node.convexId AS nodeId, type(r) AS relationshipType, r.kind AS kind, r.reason AS reason, r.confidence AS confidence, labels(other) AS otherLabels, other.convexId AS otherId, other.title AS otherTitle LIMIT 25",
      },
      {
        name: "allAgentLinks",
        when: "Audit agent-owned relationships.",
        cypher:
          "MATCH (a)-[r:AGENT_LINK]->(b) RETURN labels(a) AS fromLabels, a.convexId AS fromId, a.title AS fromTitle, r.kind AS kind, r.reason AS reason, r.confidence AS confidence, labels(b) AS toLabels, b.convexId AS toId, b.title AS toTitle LIMIT 50",
      },
    ],
    linkFlow: [
      "Call falkor_graph_schema.",
      "Read candidate nodes with falkor_graph_query and capture exact label + convexId values.",
      "Check existing AGENT_LINK relationships around at least one endpoint.",
      "Call falkor_graph_link with fromLabel, fromId, toLabel, toId, kind, reason, and confidence.",
      "Report the created relationship id and why it exists.",
    ],
  };
}

async function falkorGraphQuery(args: Record<string, unknown>) {
  const query = args.query;
  if (typeof query !== "string") {
    throw new Error("query is required.");
  }
  assertReadOnlyFalkorCypher(query);
  return capFalkorResult(
    await runFalkorQuery(query),
    clampMaxRows(args.maxRows),
  );
}

async function falkorGraphLink(args: Record<string, unknown>) {
  const fromLabel = assertFalkorLabel(args.fromLabel, "fromLabel");
  const fromId = assertRecordId(args.fromId, "fromId");
  const toLabel = assertFalkorLabel(args.toLabel, "toLabel");
  const toId = assertRecordId(args.toId, "toId");
  const kind = assertRelationKind(args.kind);
  const reason = assertRecordId(args.reason, "reason");
  const createdBy =
    typeof args.createdBy === "string" && args.createdBy.trim()
      ? args.createdBy.trim()
      : "hermes";
  const confidence =
    typeof args.confidence === "number" && Number.isFinite(args.confidence)
      ? Math.max(0, Math.min(1, args.confidence))
      : 0.7;
  const metadata =
    args.metadata &&
    typeof args.metadata === "object" &&
    !Array.isArray(args.metadata)
      ? (args.metadata as JsonObject)
      : {};
  const now = new Date().toISOString();
  const linkId = falkorLinkId({ fromLabel, fromId, toLabel, toId, kind });
  const props = cypherProps({
    linkId,
    kind,
    reason,
    confidence,
    createdBy,
    sourceSystem: "agent",
    sourceUserId: USER_ID,
    userId: USER_ID,
    metadataJson: JSON.stringify(metadata),
    createdAt: now,
    updatedAt: now,
  });

  await runFalkorQuery(
    `MATCH (a:${fromLabel} {convexId: ${cypherString(
      fromId,
    )}})-[r:${FALKOR_AGENT_RELATIONSHIP} {linkId: ${cypherString(
      linkId,
    )}}]->(b:${toLabel} {convexId: ${cypherString(toId)}}) DELETE r`,
  );
  const result = await runFalkorQuery(
    `MATCH (a:${fromLabel} {convexId: ${cypherString(
      fromId,
    )}}), (b:${toLabel} {convexId: ${cypherString(
      toId,
    )}}) CREATE (a)-[r:${FALKOR_AGENT_RELATIONSHIP} ${props}]->(b) RETURN r.linkId AS linkId, r.kind AS kind, r.reason AS reason, r.confidence AS confidence`,
  );

  return {
    linked: true,
    relationType: FALKOR_AGENT_RELATIONSHIP,
    relationId: linkId,
    from: `${fromLabel}:${fromId}`,
    to: `${toLabel}:${toId}`,
    kind,
    result,
  };
}

async function falkorGraphUnlink(args: Record<string, unknown>) {
  const fromLabel = assertFalkorLabel(args.fromLabel, "fromLabel");
  const fromId = assertRecordId(args.fromId, "fromId");
  const toLabel = assertFalkorLabel(args.toLabel, "toLabel");
  const toId = assertRecordId(args.toId, "toId");
  const kind = assertRelationKind(args.kind);
  const linkId = falkorLinkId({ fromLabel, fromId, toLabel, toId, kind });
  const result = await runFalkorQuery(
    `MATCH (a:${fromLabel} {convexId: ${cypherString(
      fromId,
    )}})-[r:${FALKOR_AGENT_RELATIONSHIP} {linkId: ${cypherString(
      linkId,
    )}}]->(b:${toLabel} {convexId: ${cypherString(toId)}}) DELETE r`,
  );

  return {
    unlinked: true,
    relationType: FALKOR_AGENT_RELATIONSHIP,
    relationId: linkId,
    result,
  };
}

type ClientRecord = {
  id: string;
  name: string;
  raw: JsonObject;
};

type ResourceKind = "workspace" | "notes";

const STATIC_RESOURCES: Resource[] = [
  {
    uri: "lifeos://customer-success/guide",
    name: "customer_success_guide",
    title: "Customer Success Guide",
    mimeType: "text/markdown",
    description:
      "How to use LifeOS customer-success resources, notes, and issue tracking together.",
  },
];

const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  {
    uriTemplate: "lifeos://client/{clientIdOrName}/workspace",
    name: "client_workspace",
    title: "Client Workspace",
    mimeType: "text/markdown",
    description:
      "Composite customer-success workspace for one client, including projects, open tasks, recent chats, meetings, linked people, and notes.",
  },
  {
    uriTemplate: "lifeos://client/{clientIdOrName}/notes",
    name: "client_notes",
    title: "Client Notes",
    mimeType: "text/markdown",
    description:
      "Tracked customer notes for one client, including requirements, decisions, and follow-ups.",
  },
];

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asJsonArray(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is JsonObject => {
        return !!entry && typeof entry === "object" && !Array.isArray(entry);
      })
    : [];
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getClientId(client: JsonObject): string | undefined {
  return getString(client._id) || getString(client.id);
}

function getClientName(client: JsonObject): string | undefined {
  return getString(client.name) || getString(client.title);
}

function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getItemLabel(item: JsonObject): string {
  return (
    getString(item.title) ||
    getString(item.name) ||
    getString(item.identifier) ||
    getString(item.host) ||
    getString(item.status) ||
    "Untitled"
  );
}

function getItemMeta(item: JsonObject, keys: string[]): string | undefined {
  const parts = keys
    .map((key) => getString(item[key]))
    .filter((value): value is string => !!value);
  return parts.length > 0 ? parts.join(" | ") : undefined;
}

function formatListSection(
  heading: string,
  items: JsonObject[],
  options?: { emptyText?: string; metaKeys?: string[]; limit?: number },
): string {
  const limit = options?.limit ?? 8;
  if (items.length === 0) {
    return `## ${heading}\n${options?.emptyText ?? "None"}\n`;
  }

  const rendered = items.slice(0, limit).map((item) => {
    const label = getItemLabel(item);
    const meta = options?.metaKeys
      ? getItemMeta(item, options.metaKeys)
      : undefined;
    return meta ? `- ${label} (${meta})` : `- ${label}`;
  });

  if (items.length > limit) {
    rendered.push(`- ... ${items.length - limit} more`);
  }

  return `## ${heading}\n${rendered.join("\n")}\n`;
}

function formatCustomerSuccessGuide(): string {
  return [
    "# Customer Success Resource Guide",
    "",
    "Start with the client workspace resource. It pulls the same composite context as `get_client_success_workspace` and is the fastest way to load account state.",
    "",
    "Workflow:",
    "- Open `lifeos://client/{clientIdOrName}/workspace` first.",
    "- Open `lifeos://client/{clientIdOrName}/notes` to review tracked requirements and decisions.",
    "- Use raw tools only when the resource snapshot is not enough: `get_beeper_thread_messages`, `get_fathom_meeting`, `get_fathom_transcript`, `get_granola_meeting`, `get_granola_transcript`.",
    "- Save account memory with `create_client_note` or `update_client_note`.",
    "- Track execution work with `create_issue` or `update_issue`.",
    "",
    "Rules:",
    "- Notes are for customer asks, decisions, constraints, and follow-ups.",
    "- Issues are for internal execution work.",
    "- Prefer updating existing artifacts over creating duplicates.",
  ].join("\n");
}

async function getClientsList(): Promise<ClientRecord[]> {
  const response = asJsonObject(await callConvexTool("get_clients", {}));
  const clients = asJsonArray(response.clients);

  return clients
    .map((client) => {
      const id = getClientId(client);
      const name = getClientName(client);
      if (!id || !name) {
        return null;
      }

      return { id, name, raw: client };
    })
    .filter((client): client is ClientRecord => client !== null);
}

async function resolveClient(clientIdOrName: string): Promise<ClientRecord> {
  const clients = await getClientsList();
  const lookup = clientIdOrName.trim().toLowerCase();

  const exactMatch = clients.find((client) => {
    return (
      client.id.toLowerCase() === lookup ||
      client.name.toLowerCase() === lookup ||
      slugifyName(client.name) === lookup
    );
  });

  if (exactMatch) {
    return exactMatch;
  }

  const partialMatch = clients.find((client) =>
    client.name.toLowerCase().includes(lookup),
  );

  if (partialMatch) {
    return partialMatch;
  }

  throw new Error(`Unknown client resource target: ${clientIdOrName}`);
}

function buildClientResourceUri(
  clientIdOrName: string,
  kind: ResourceKind,
): string {
  return `lifeos://client/${encodeURIComponent(clientIdOrName)}/${kind}`;
}

async function listCustomerSuccessResources(): Promise<Resource[]> {
  const clients = await getClientsList();
  const clientResources = clients.flatMap((client) => [
    {
      uri: buildClientResourceUri(client.id, "workspace"),
      name: `client_workspace_${slugifyName(client.name) || client.id}`,
      title: `${client.name} Workspace`,
      mimeType: "text/markdown",
      description:
        "Composite customer-success workspace with account context, activity, and open work.",
    },
    {
      uri: buildClientResourceUri(client.id, "notes"),
      name: `client_notes_${slugifyName(client.name) || client.id}`,
      title: `${client.name} Notes`,
      mimeType: "text/markdown",
      description:
        "Tracked customer notes for requirements, decisions, and follow-ups.",
    },
  ]);

  return [...STATIC_RESOURCES, ...clientResources];
}

function parseClientResourceUri(uri: string): {
  clientIdOrName: string;
  kind: ResourceKind;
} | null {
  const parsed = new URL(uri);
  if (parsed.protocol !== "lifeos:") {
    return null;
  }

  if (parsed.hostname !== "client") {
    return null;
  }

  const parts = parsed.pathname
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));

  if (parts.length !== 2) {
    return null;
  }

  const [clientIdOrName, kind] = parts;
  if (kind !== "workspace" && kind !== "notes") {
    return null;
  }

  return { clientIdOrName, kind };
}

function formatWorkspaceResource(
  client: ClientRecord,
  workspace: JsonObject,
): string {
  const projects = asJsonArray(workspace.projects);
  const openTasks = asJsonArray(workspace.openTasks);
  const recentThreads = asJsonArray(workspace.recentThreads);
  const recentMeetings = asJsonArray(workspace.recentMeetings);
  const linkedPeople = asJsonArray(workspace.linkedPeople);
  const notes = asJsonArray(workspace.notes);

  return [
    `# ${client.name} Customer Success Workspace`,
    "",
    `Client ID: \`${client.id}\``,
    "",
    "## Summary",
    `- Projects: ${projects.length}`,
    `- Open tasks: ${openTasks.length}`,
    `- Recent threads: ${recentThreads.length}`,
    `- Recent meetings: ${recentMeetings.length}`,
    `- Linked people: ${linkedPeople.length}`,
    `- Notes: ${notes.length}`,
    "",
    formatListSection("Projects", projects, {
      emptyText: "No linked projects.",
      metaKeys: ["status", "health", "priority"],
    }).trimEnd(),
    "",
    formatListSection("Open Tasks", openTasks, {
      emptyText: "No open tasks.",
      metaKeys: ["identifier", "status", "priority", "dueDate"],
    }).trimEnd(),
    "",
    formatListSection("Recent Threads", recentThreads, {
      emptyText: "No linked chat threads.",
      metaKeys: ["platform", "lastMessageAt", "threadId"],
    }).trimEnd(),
    "",
    formatListSection("Recent Meetings", recentMeetings, {
      emptyText: "No linked meetings.",
      metaKeys: ["source", "startTime", "meetingDate"],
    }).trimEnd(),
    "",
    formatListSection("Linked People", linkedPeople, {
      emptyText: "No linked people.",
      metaKeys: ["relationshipType", "email", "phone"],
    }).trimEnd(),
    "",
    formatListSection("Tracked Notes", notes, {
      emptyText: "No client notes yet.",
      metaKeys: ["updatedAt", "createdAt"],
    }).trimEnd(),
  ].join("\n");
}

function formatNotesResource(
  client: ClientRecord,
  notesResponse: JsonObject,
): string {
  const notes = asJsonArray(notesResponse.notes);

  if (notes.length === 0) {
    return [
      `# ${client.name} Client Notes`,
      "",
      "No client notes are currently tracked for this account.",
      "",
      "Use `create_client_note` to capture requirements, decisions, and follow-ups.",
    ].join("\n");
  }

  const renderedNotes = notes.slice(0, 20).map((note, index) => {
    const title = getString(note.title) || `Untitled note ${index + 1}`;
    const content = getString(note.content) || "";
    const updatedAt = getString(note.updatedAt) || getString(note.createdAt);
    const meta = updatedAt ? `Updated: ${updatedAt}` : undefined;

    return [`## ${title}`, meta ?? "", content].filter(Boolean).join("\n");
  });

  return [
    `# ${client.name} Client Notes`,
    "",
    `Total notes: ${notes.length}`,
    "",
    ...renderedNotes,
  ].join("\n\n");
}

async function readCustomerSuccessResource(uri: string): Promise<{
  text: string;
  mimeType: string;
}> {
  if (uri === "lifeos://customer-success/guide") {
    return {
      text: formatCustomerSuccessGuide(),
      mimeType: "text/markdown",
    };
  }

  const parsed = parseClientResourceUri(uri);
  if (!parsed) {
    throw new Error(`Unknown resource URI: ${uri}`);
  }

  const client = await resolveClient(parsed.clientIdOrName);

  if (parsed.kind === "workspace") {
    const workspace = asJsonObject(
      await callConvexTool("get_client_success_workspace", {
        clientIdOrName: client.id,
      }),
    );

    return {
      text: formatWorkspaceResource(client, workspace),
      mimeType: "text/markdown",
    };
  }

  const notesResponse = asJsonObject(
    await callConvexTool("get_client_notes", {
      clientId: client.id,
      limit: 50,
    }),
  );

  return {
    text: formatNotesResource(client, notesResponse),
    mimeType: "text/markdown",
  };
}

// Create the MCP server
const server = new Server(
  {
    name: "lifeos-pm",
    version: VERSION,
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  },
);

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources: await listCustomerSuccessResources() };
});

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return { resourceTemplates: RESOURCE_TEMPLATES };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  const resource = await readCustomerSuccessResource(uri);

  return {
    contents: [
      {
        uri,
        mimeType: resource.mimeType,
        text: resource.text,
      },
    ],
  };
});

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle list prompts request
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return { prompts: PROMPTS };
});

// Handle get prompt request
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const messageBuilder = PROMPT_MESSAGES[name];
  if (!messageBuilder) {
    throw new Error(`Unknown prompt: ${name}`);
  }

  const prompt = PROMPTS.find((p) => p.name === name);
  const messages = messageBuilder((args as Record<string, string>) || {});

  return {
    description: prompt?.description,
    messages,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "run_council") {
      const params = (args as Record<string, unknown>) || {};
      const { userId: overrideUserId } = params;
      const result = await callConvexJsonEndpoint("/council-skill", {
        userId: (overrideUserId as string) || USER_ID,
        query: params.query,
        tier: params.tier,
        councilModels: params.councilModels,
        chairmanModel: params.chairmanModel,
        pageContext: params.pageContext,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    const llmCouncilArtifactActions: Record<string, string> = {
      create_llm_council_artifact_run: "createRun",
      append_llm_council_artifact: "appendArtifact",
      complete_llm_council_artifact_run: "completeRun",
      list_llm_council_artifact_runs: "listRuns",
      get_llm_council_artifact_run: "getRun",
    };
    if (name in llmCouncilArtifactActions) {
      const result = await callLlmCouncilArtifacts(
        llmCouncilArtifactActions[name]!,
        (args as Record<string, unknown>) || {},
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === "falkor_graph_schema") {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(falkorGraphSchema(), null, 2),
          },
        ],
      };
    }

    if (name === "falkor_graph_query") {
      const result = await falkorGraphQuery(
        (args as Record<string, unknown>) || {},
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === "falkor_graph_link") {
      const result = await falkorGraphLink(
        (args as Record<string, unknown>) || {},
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === "falkor_graph_unlink") {
      const result = await falkorGraphUnlink(
        (args as Record<string, unknown>) || {},
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    // Handle local-only tools (no Convex call needed)
    if (name === "get_version") {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { version: VERSION, buildTime: BUILD_TIME },
              null,
              2,
            ),
          },
        ],
      };
    }

    const result = await callConvexTool(
      name,
      (args as Record<string, unknown>) || {},
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return {
      content: [
        {
          type: "text" as const,
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LifeOS MCP server running on stdio");
}

if (directCliCommand) {
  runDirectCliCommand(directCliCommand).catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
} else {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
