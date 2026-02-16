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
 *   LIFEOS_USER_ID  User ID for API key auth
 *   LIFEOS_API_KEY  API key for authentication
 */

import { Command } from "commander";
import { VERSION, BUILD_TIME } from "./build-info.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  type Tool,
  type Prompt,
} from "@modelcontextprotocol/sdk/types.js";

// Parse CLI arguments
const program = new Command();

program
  .name("lifeos-mcp")
  .description("MCP server for LifeOS Project Management")
  .version(VERSION)
  .option("-u, --url <url>", "Convex deployment URL")
  .option("-i, --user-id <id>", "User ID for API authentication")
  .option("-k, --api-key <key>", "API key for authentication")
  .parse();

const options = program.opts();

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
    name: "create_issue",
    description:
      "Create a new task/issue. Assign to a project (by key like 'KORT') and optionally a phase (by name like 'Building Foundation' or by ID). Set priority, due date, cycle, and initiative.",
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
          description:
            "Phase ID (deprecated, use phaseNameOrId instead)",
        },
        initiativeId: {
          type: "string",
          description:
            "Link directly to a yearly initiative ID (optional)",
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
        isTopPriority: {
          type: "boolean",
          description: "Mark as top priority (optional)",
        },
        initiativeId: {
          type: "string",
          description:
            "Link to a yearly initiative ID, or empty to unlink (optional)",
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
      "Get today's full agenda: tasks due today, calendar events, and top priorities.",
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
    name: "get_weekly_agenda",
    description:
      "Get weekly agenda: tasks and events for the next 7 days, plus AI weekly summary.",
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
    name: "get_monthly_agenda",
    description:
      "Get monthly agenda: tasks and events for the month, plus AI monthly summary.",
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
            "AI model to use (optional, default: openai/gpt-4o-mini)",
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
            "AI model to use (optional, default: openai/gpt-4o-mini)",
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
            "AI model to use (optional, default: openai/gpt-4o-mini)",
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
      "Get voice memos that have specific labels/tags from AI extraction. Use this to find memos about specific topics.",
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
            "Labels to search for (required). Matches are fuzzy/partial.",
        },
        limit: {
          type: "number",
          description: "Max results (default 50, max 100)",
        },
      },
      required: ["labels"],
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
    description:
      "Get a single initiative's details by ID.",
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
    description: "Archive an initiative (soft delete). Can be unarchived later.",
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
          description:
            "Initiative ID to link to (optional — omit to unlink)",
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
          description:
            "Issue ID or identifier like 'PROJ-123' (required)",
        },
        initiativeId: {
          type: "string",
          description:
            "Initiative ID to link to (optional — omit to unlink)",
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
      "Get daily sleep data from Oura Ring including scores, durations (total/deep/REM/light), HRV, resting heart rate, and sleep quality metrics.",
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
      "Get daily readiness scores from Oura Ring including readiness score, temperature deviation, and recovery contributor scores.",
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
      "Get daily blood oxygen (SpO2) percentage data from Oura Ring.",
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
      "Get workout history from Oura Ring including activity type, duration, calories, intensity, and distance.",
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

  // ==================== COACHING Tools ====================
  {
    name: "get_coaching_profiles",
    description:
      "List all AI coaching profiles (coach personas). Each profile defines a coaching methodology, focus areas, and which LifeOS tools the coach can use.",
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
    name: "get_coaching_profile",
    description:
      "Get a single coaching profile by ID or slug with full details including instructions and enabled tools.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        profileIdOrSlug: {
          type: "string",
          description: "Profile ID or slug like 'executive-coach' (required)",
        },
      },
      required: ["profileIdOrSlug"],
    },
  },
  {
    name: "create_coaching_profile",
    description:
      "Create a new AI coaching profile with a unique slug, system prompt, focus areas, and tool access.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        name: {
          type: "string",
          description: "Coach display name (required)",
        },
        slug: {
          type: "string",
          description: "Unique slug like 'executive-coach' (required)",
        },
        instructions: {
          type: "string",
          description: "System prompt / coaching methodology (required)",
        },
        focusAreas: {
          type: "array",
          items: { type: "string" },
          description: "Focus areas like ['career', 'leadership'] (required)",
        },
        enabledTools: {
          type: "array",
          items: { type: "string" },
          description: "LifeOS tool names this coach can use (required)",
        },
        model: {
          type: "string",
          description: "LLM model ID, e.g. 'anthropic/claude-sonnet-4-5-20250929' (required)",
        },
        greeting: {
          type: "string",
          description: "Opening greeting for new sessions (optional)",
        },
        sessionCadence: {
          type: "string",
          enum: ["daily", "weekly", "biweekly", "monthly", "ad_hoc"],
          description: "Suggested session cadence (optional)",
        },
        color: {
          type: "string",
          description: "Hex color for UI (optional)",
        },
        icon: {
          type: "string",
          description: "Emoji icon (optional)",
        },
      },
      required: ["name", "slug", "instructions", "focusAreas", "enabledTools", "model"],
    },
  },
  {
    name: "update_coaching_profile",
    description: "Update a coaching profile's settings.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        profileId: {
          type: "string",
          description: "Coaching profile ID (required)",
        },
        name: {
          type: "string",
          description: "Updated name (optional)",
        },
        instructions: {
          type: "string",
          description: "Updated system prompt (optional)",
        },
        focusAreas: {
          type: "array",
          items: { type: "string" },
          description: "Updated focus areas (optional)",
        },
        enabledTools: {
          type: "array",
          items: { type: "string" },
          description: "Updated enabled tools (optional)",
        },
        model: {
          type: "string",
          description: "Updated model (optional)",
        },
        greeting: {
          type: "string",
          description: "Updated greeting (optional)",
        },
        sessionCadence: {
          type: "string",
          enum: ["daily", "weekly", "biweekly", "monthly", "ad_hoc"],
          description: "Updated cadence (optional)",
        },
        color: {
          type: "string",
          description: "Updated color (optional)",
        },
        icon: {
          type: "string",
          description: "Updated icon (optional)",
        },
      },
      required: ["profileId"],
    },
  },
  {
    name: "delete_coaching_profile",
    description:
      "Delete a coaching profile and cascade-delete all related sessions and action items.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        profileId: {
          type: "string",
          description: "Coaching profile ID to delete (required)",
        },
      },
      required: ["profileId"],
    },
  },
  {
    name: "get_coaching_sessions",
    description:
      "List coaching sessions, optionally filtered by coach profile or status. Returns session summaries, titles, and timing.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        coachProfileId: {
          type: "string",
          description: "Filter by coaching profile ID (optional)",
        },
        status: {
          type: "string",
          enum: ["active", "summarizing", "completed"],
          description: "Filter by session status (optional)",
        },
        limit: {
          type: "number",
          description: "Max results (default 20, max 100)",
        },
      },
    },
  },
  {
    name: "get_coaching_session",
    description:
      "Get a single coaching session with full details: summary, key insights, and action items generated during the session.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        sessionId: {
          type: "string",
          description: "Coaching session ID (required)",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "get_coaching_action_items",
    description:
      "List coaching action items across all coaches or filtered by coach/status. Shows text, priority, due dates, and completion status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        coachProfileId: {
          type: "string",
          description: "Filter by coaching profile ID (optional)",
        },
        status: {
          type: "string",
          enum: ["pending", "in_progress", "completed", "cancelled"],
          description: "Filter by status (optional)",
        },
        limit: {
          type: "number",
          description: "Max results (default 50, max 100)",
        },
      },
    },
  },
  {
    name: "create_coaching_action_item",
    description:
      "Create a new coaching action item linked to a session and coach profile.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        sessionId: {
          type: "string",
          description: "Coaching session ID that created this item (required)",
        },
        coachProfileId: {
          type: "string",
          description: "Coaching profile ID (required)",
        },
        text: {
          type: "string",
          description: "Action item text (required)",
        },
        priority: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "Priority level (optional)",
        },
        dueDate: {
          type: "string",
          description: "Due date in ISO format (optional)",
        },
      },
      required: ["sessionId", "coachProfileId", "text"],
    },
  },
  {
    name: "update_coaching_action_item",
    description:
      "Update a coaching action item's text, status, priority, due date, or notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        actionItemId: {
          type: "string",
          description: "Action item ID (required)",
        },
        text: {
          type: "string",
          description: "Updated text (optional)",
        },
        status: {
          type: "string",
          enum: ["pending", "in_progress", "completed", "cancelled"],
          description: "Updated status (optional)",
        },
        priority: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "Updated priority (optional)",
        },
        dueDate: {
          type: "string",
          description: "Updated due date in ISO format (optional)",
        },
        notes: {
          type: "string",
          description: "Additional notes (optional)",
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
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        actionItemId: {
          type: "string",
          description: "Action item ID to delete (required)",
        },
      },
      required: ["actionItemId"],
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
        description:
          "Year to review (optional, defaults to current year)",
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
        description: "Client name or project key/name to load context for (required)",
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
        description:
          "Optional: specific person or client name to focus on",
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
        description:
          "Optional: topic or date range to start exploring",
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
        description:
          "Optional: title or topic for the crystallization summary",
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
        description:
          "Number of days to review (optional, defaults to 7)",
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
        description:
          "Number of weeks to review (optional, defaults to 2)",
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
        description:
          "Number of days for trend data (optional, defaults to 90)",
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
        description:
          "Number of days to analyze (optional, defaults to 30)",
        required: false,
      },
    ],
  },
  {
    name: "coaching-overview",
    description:
      "Dashboard of coaching profiles, recent sessions, and pending action items across all coaches.",
    arguments: [],
  },
  {
    name: "coaching-action-items",
    description:
      "Review and manage coaching action items across all coaches. Can mark items complete.",
    arguments: [
      {
        name: "action",
        description:
          "Optional: 'complete <item reference>' to mark an action item as done",
        required: false,
      },
    ],
  },
  {
    name: "coaching-session-review",
    description:
      "Deep-dive into a specific coaching session's summary, key insights, and action items.",
    arguments: [
      {
        name: "session",
        description:
          "Session ID or coach slug to find the most recent session (optional, defaults to most recent)",
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

1. Call get_daily_agenda for today's agenda (tasks due today, calendar events, top priorities)
2. Call get_todays_tasks for today's task list
3. Call get_current_cycle for current sprint progress and stats

${dateClause}

Summarize in a concise standup format:
- **Today's Focus**: Top 3 things to focus on
- **Tasks Due**: List tasks due today with priority
- **Sprint Progress**: Cycle completion % and key stats
- **Calendar**: Any meetings or events today

Keep it short and actionable.`,
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

1. Call get_weekly_agenda for this week's agenda and AI summary
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
  "sprint-plan": (args) => {
    const notesClause = args.notes ? `Additional context: ${args.notes}` : "";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Help me plan my sprint. Use the LifeOS MCP tools:

1. Call get_current_cycle to see the active sprint and its current state
2. Call get_tasks with status "backlog" to see unplanned work
3. Call get_tasks with status "todo" to see already planned work
4. Call get_projects with status "in_progress" to see active projects

${notesClause}

Then help me plan:
- Show current sprint capacity (what's already assigned vs. remaining)
- List backlog items by priority, grouped by project
- Suggest which backlog items to pull into the sprint based on priority
- If I provide specific tasks, create issues and assign them to the current cycle

Ask me to confirm before creating or assigning any issues.`,
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
    const filterClause = args.filter === "critical"
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
    const autoMode = args.mode === "auto"
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

1. Call get_monthly_agenda for this month's overview and AI summary
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

1. Call get_tasks to get all tasks
2. Call get_projects to get all projects with health status
3. Call get_current_cycle to see sprint status

Analyze and identify:
- **Overdue tasks**: Tasks past their due date (compare dueDate to today)
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

1. Call get_health_sleep with days=${daysCount} for sleep scores and durations
2. Call get_health_activity with days=${daysCount} for activity scores and steps
3. Call get_health_readiness with days=${daysCount} for readiness scores
4. Call get_health_heart_rate with days=${daysCount} for resting heart rate trends

Present a concise health dashboard:
- **Overall Status**: Quick assessment (great / good / needs attention)
- **Sleep**: Average score, total sleep trend, any concerning nights
- **Activity**: Average score, daily steps, active calories
- **Readiness**: Average score, trend direction (improving/declining/stable)
- **Heart Rate**: Resting HR trend, HRV if available
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

1. Call get_health_sleep with days=${daysCount} for sleep data
2. Call get_health_activity with days=${daysCount} for activity data
3. Call get_health_readiness with days=${daysCount} for readiness data
4. Call get_health_stress with days=${daysCount} for stress/recovery data
5. Call get_health_workouts with days=${daysCount} for workout history
6. Call get_health_heart_rate with days=${daysCount} for HR trends

Present a detailed weekly health review:
- **Sleep Quality**: Weekly average scores, best/worst nights, sleep duration trends, deep/REM balance
- **Activity Patterns**: Weekly step averages, active days vs rest days, calorie burn
- **Readiness & Recovery**: Score trends, stress vs recovery balance
- **Workouts**: List workouts with type, duration, calories burned
- **Heart Rate**: Resting HR trend, HRV trend (if available)
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
  "coaching-overview": () => {
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Show me a coaching dashboard. Use the LifeOS MCP tools:

1. Call get_coaching_profiles to list all coach personas
2. Call get_coaching_sessions with limit=10 for recent sessions across all coaches
3. Call get_coaching_action_items with status "pending" for outstanding action items

Present a coaching overview:
- **Coaches**: List each coach profile with name, focus areas, and session cadence
- **Recent Sessions**: Show recent sessions grouped by coach, with title, date, and status
- **Pending Action Items**: Count of pending items per coach, with the top 3 most urgent items shown
- **Insights**: Which coaches are most active, any overdue action items, suggested next sessions

Keep it concise and actionable.`,
        },
      },
    ];
  },
  "coaching-action-items": (args) => {
    const actionClause = args.action
      ? `\n\nThe user wants to: ${args.action}. If this references completing an item, call update_coaching_action_item with status "completed".`
      : "";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Review my coaching action items. Use the LifeOS MCP tools:

1. Call get_coaching_action_items to get all action items
2. Call get_coaching_profiles to get coach names for grouping

Present action items grouped by coach:
- **Per Coach**: Show coach name, then list action items with status, priority, due date
- **Overdue**: Highlight any items past their due date
- **Summary**: Total pending, in-progress, completed counts
- **Suggestions**: Which items to prioritize next${actionClause}`,
        },
      },
    ];
  },
  "coaching-session-review": (args) => {
    const sessionClause = args.session
      ? `Look up session: "${args.session}". If it looks like an ID, call get_coaching_session directly. If it looks like a coach slug, call get_coaching_profile first, then get_coaching_sessions filtered by that coach to find the most recent one.`
      : "Call get_coaching_sessions with limit=1 to get the most recent session.";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Review a coaching session in depth. Use the LifeOS MCP tools:

1. ${sessionClause}
2. Call get_coaching_session with the session ID for full details including summary and action items

Present a session review:
- **Session Info**: Coach name, date, duration, mood at start
- **Summary**: The session's AI-generated summary
- **Key Insights**: List all key insights from the session
- **Action Items**: All action items with their current status
- **Follow-up**: Suggest what to discuss in the next session based on insights and pending items`,
        },
      },
    ];
  },
};

// Configuration: CLI flags take precedence over env vars
// NOTE: HTTP routes are served from .convex.site, NOT .convex.cloud
const CONVEX_URL = options.url || process.env.CONVEX_URL;
const API_KEY = options.apiKey || process.env.LIFEOS_API_KEY;
const USER_ID = options.userId || process.env.LIFEOS_USER_ID;

// Validate required configuration
const missingConfig: string[] = [];
if (!CONVEX_URL) missingConfig.push("CONVEX_URL (--url or CONVEX_URL env)");
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
  const url = `${CONVEX_URL}/tool-call`;

  // Extract userId from params if provided, otherwise use default
  const { userId: overrideUserId, ...toolParams } = params;
  const effectiveUserId = (overrideUserId as string) || USER_ID;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
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

// Create the MCP server
const server = new Server(
  {
    name: "lifeos-pm",
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  },
);

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

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
