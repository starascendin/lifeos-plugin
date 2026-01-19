#!/usr/bin/env node

/**
 * LifeOS MCP Server
 *
 * Exposes LifeOS Project Management tools via Model Context Protocol.
 * Calls the Convex HTTP /tool-call endpoint.
 *
 * Environment variables:
 * - CONVEX_URL: Convex deployment URL (e.g., https://your-deployment.convex.cloud)
 * - LIFEOS_API_KEY: API key for authentication (or use LIFEOS_USER_ID with built-in key)
 * - LIFEOS_USER_ID: User ID for API key auth
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

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
    name: "get_tasks",
    description:
      "Get tasks/issues with optional filters. Use this to list tasks in a project or by status/priority.",
    inputSchema: {
      type: "object" as const,
      properties: {
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
      properties: {},
    },
  },
  {
    name: "create_issue",
    description:
      "Create a new task/issue. Optionally assign to a project, set priority, and due date.",
    inputSchema: {
      type: "object" as const,
      properties: {
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
      properties: {},
    },
  },
  {
    name: "assign_issue_to_cycle",
    description:
      "Assign a task to a cycle. Defaults to current active cycle if no cycleId provided.",
    inputSchema: {
      type: "object" as const,
      properties: {
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

  // Agenda Tools
  {
    name: "get_daily_agenda",
    description:
      "Get today's full agenda: tasks due today, calendar events, and top priorities.",
    inputSchema: {
      type: "object" as const,
      properties: {
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
        startDate: {
          type: "string",
          description: "Start date in ISO format (optional, default: today)",
        },
      },
    },
  },

  // Notes Tools
  {
    name: "search_notes",
    description: "Search voice memos/notes by content.",
    inputSchema: {
      type: "object" as const,
      properties: {
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
];

// Configuration
const CONVEX_URL =
  process.env.CONVEX_URL || "https://exalted-shrimp-978.convex.cloud";
const API_KEY = process.env.LIFEOS_API_KEY || "tool-call-secret-key-2024";
const USER_ID = process.env.LIFEOS_USER_ID;

if (!USER_ID) {
  console.error(
    "Error: LIFEOS_USER_ID environment variable is required",
  );
  console.error("Set it to your Convex user ID to authenticate API calls.");
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

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify({
      tool,
      userId: USER_ID,
      params,
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
