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
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Parse CLI arguments
const program = new Command();

program
  .name("lifeos-mcp")
  .description("MCP server for LifeOS Project Management")
  .version("0.1.0")
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
          description: "Associate with a client ID, or empty to unlink (optional)",
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
      "Create a new task/issue. Optionally assign to a project, set priority, and due date.",
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
          description: "Project ID or key like 'ACME' (optional)",
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
        phaseId: {
          type: "string",
          description: "Assign to a specific phase within the project (optional)",
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
          enum: ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"],
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
    description:
      "Get all cycles/sprints for the user with stats and progress.",
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
          description: "First day of month in ISO format like '2024-01-01' (optional, default: current month)",
        },
      },
    },
  },
  {
    name: "regenerate_daily_summary",
    description:
      "Regenerate the AI summary for a specific day.",
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
          description: "AI model to use (optional, default: openai/gpt-4o-mini)",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "regenerate_weekly_summary",
    description:
      "Regenerate the AI summary for a specific week.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        weekStartDate: {
          type: "string",
          description: "Monday of the week in ISO format like '2024-01-15' (required)",
        },
        model: {
          type: "string",
          description: "AI model to use (optional, default: openai/gpt-4o-mini)",
        },
      },
      required: ["weekStartDate"],
    },
  },
  {
    name: "regenerate_monthly_summary",
    description:
      "Regenerate the AI summary for a specific month.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        monthStartDate: {
          type: "string",
          description: "First day of month in ISO format like '2024-01-01' (required)",
        },
        model: {
          type: "string",
          description: "AI model to use (optional, default: openai/gpt-4o-mini)",
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
          description: "Monday of the week in ISO format like '2024-01-15' (required)",
        },
        customPrompt: {
          type: "string",
          description: "Custom prompt template for AI summary generation (required)",
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
          description: "First day of month in ISO format like '2024-01-01' (required)",
        },
        customPrompt: {
          type: "string",
          description: "Custom prompt template for AI summary generation (required)",
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
          enum: ["family", "friend", "colleague", "acquaintance", "mentor", "other"],
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
          enum: ["family", "friend", "colleague", "acquaintance", "mentor", "other"],
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
          enum: ["family", "friend", "colleague", "acquaintance", "mentor", "other"],
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
          description: "Context for the link, e.g., 'Phone call', 'Coffee meetup' (optional)",
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
    description:
      "Get a single client's details with project statistics.",
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
    description:
      "Delete a client. Projects are unlinked (not deleted).",
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
          description: "Phase description in tiptap HTML format (e.g., '<p>Phase description here</p>'). Do NOT use JSON format. (optional)",
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
          description: "Updated description in tiptap HTML format (e.g., '<p>Updated description here</p>'). Do NOT use JSON format. (optional)",
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
    description:
      "Assign an issue to a phase, or unassign by omitting phaseId.",
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
          description: "Phase ID (optional - omit to unassign from current phase)",
        },
      },
      required: ["issueIdOrIdentifier"],
    },
  },
];

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
  console.error("  lifeos-mcp --url https://your-app.convex.site --user-id xxx --api-key yyy");
  console.error("");
  console.error("Or with environment variables:");
  console.error("  CONVEX_URL=https://your-app.convex.site LIFEOS_USER_ID=xxx LIFEOS_API_KEY=yyy lifeos-mcp");
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
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await callConvexTool(name, (args as Record<string, unknown>) || {});

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
