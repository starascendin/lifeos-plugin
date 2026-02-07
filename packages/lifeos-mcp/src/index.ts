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
    description:
      "Get a single Beeper thread by its Beeper thread ID.",
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
    description:
      "Get messages for a Beeper thread.",
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
    description:
      "Full-text search across all synced Beeper messages.",
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
    description:
      "Get Beeper threads linked to a FRM person/contact.",
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
    description:
      "Get Beeper threads linked to a PM client.",
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
    description:
      "List all synced Granola meeting notes.",
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
    description:
      "Get the full transcript for a Granola meeting.",
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
    description:
      "Search Granola meetings by title or content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Override the default user ID (optional)",
        },
        query: {
          type: "string",
          description: "Search terms to find in meeting titles and notes (required)",
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
    description:
      "Get Granola meetings linked to a FRM person/contact.",
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
    description:
      "Get Granola meetings linked to a Beeper thread.",
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
          description:
            "Preview without making changes (default: false)",
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
    description:
      "Dismiss all pending merge suggestions at once.",
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
    description: "Get daily standup briefing: agenda, tasks due today, sprint progress.",
    arguments: [
      {
        name: "date",
        description: "Specific date in ISO format (optional, defaults to today)",
        required: false,
      },
    ],
  },
  {
    name: "weekly-review",
    description: "Run weekly review: completed work, in-progress items, sprint health, blockers.",
    arguments: [
      {
        name: "date",
        description: "Week start date in ISO format (optional, defaults to this week)",
        required: false,
      },
    ],
  },
  {
    name: "sprint-plan",
    description: "Plan the current sprint: review backlog, assign tasks to cycle, check capacity.",
    arguments: [
      {
        name: "notes",
        description: "Additional context or specific tasks to include (optional)",
        required: false,
      },
    ],
  },
  {
    name: "contact-lookup",
    description: "Full contact dossier: profile, AI insights, meetings, messages, voice memos.",
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
    description: "Full client briefing: projects, phases, completion stats, recent communications.",
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
    description: "Project status report: phases, task breakdown, blockers, urgent items.",
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
    description: "Quick capture a thought, task, or note. Auto-routes to task or note based on content.",
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
    description: "Prepare for a meeting: contact dossier, past meetings, recent messages, open items.",
    arguments: [
      {
        name: "name",
        description: "Person's name to prep for (required)",
        required: true,
      },
    ],
  },
];

// Prompt message templates keyed by prompt name
const PROMPT_MESSAGES: Record<string, (args: Record<string, string>) => { role: "user"; content: { type: "text"; text: string } }[]> = {
  "daily-standup": (args) => {
    const dateClause = args.date ? `Use date: ${args.date}` : "Use today's date.";
    return [{
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
    }];
  },
  "weekly-review": (args) => {
    const dateClause = args.date ? `Use week start date: ${args.date}` : "Use this week.";
    return [{
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
    }];
  },
  "sprint-plan": (args) => {
    const notesClause = args.notes ? `Additional context: ${args.notes}` : "";
    return [{
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
    }];
  },
  "contact-lookup": (args) => [{
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
  }],
  "client-brief": (args) => [{
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
  }],
  "project-status": (args) => [{
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
  }],
  "capture": (args) => [{
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
  }],
  "meeting-prep": (args) => [{
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
  }],
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
            text: JSON.stringify({ version: VERSION, buildTime: BUILD_TIME }, null, 2),
          },
        ],
      };
    }

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
