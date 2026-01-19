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
