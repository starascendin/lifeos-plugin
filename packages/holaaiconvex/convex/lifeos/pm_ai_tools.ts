/**
 * PM AI Tool Definitions
 * Tools for AI assistant to manage projects, issues, cycles, and labels
 * Compatible with OpenAI function calling format
 */

export const PM_AI_TOOLS = [
  // ==================== ISSUE TOOLS ====================
  {
    type: "function" as const,
    function: {
      name: "create_issue",
      description: "Create a new issue/task in the project management system",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Issue title (required)" },
          description: { type: "string", description: "Issue description (markdown supported)" },
          status: {
            type: "string",
            enum: ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"],
            description: "Issue status. Default: backlog",
          },
          priority: {
            type: "string",
            enum: ["urgent", "high", "medium", "low", "none"],
            description: "Issue priority. Default: none",
          },
          projectId: { type: "string", description: "Project ID to add issue to" },
          cycleId: { type: "string", description: "Cycle ID to assign issue to" },
          dueDate: { type: "string", description: "Due date in ISO format (YYYY-MM-DD)" },
          estimate: { type: "number", description: "Story points estimate" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_issue",
      description: "Update an existing issue by ID or identifier (e.g., PROJ-123)",
      parameters: {
        type: "object",
        properties: {
          issueId: { type: "string", description: "Issue ID or identifier (e.g., PROJ-123)" },
          title: { type: "string", description: "New title" },
          description: { type: "string", description: "New description" },
          status: {
            type: "string",
            enum: ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"],
          },
          priority: {
            type: "string",
            enum: ["urgent", "high", "medium", "low", "none"],
          },
          dueDate: { type: "string", description: "Due date in ISO format (YYYY-MM-DD)" },
          estimate: { type: "number", description: "Story points estimate" },
        },
        required: ["issueId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_issue",
      description: "Delete an issue by ID or identifier",
      parameters: {
        type: "object",
        properties: {
          issueId: { type: "string", description: "Issue ID or identifier to delete" },
        },
        required: ["issueId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_issues",
      description: "List issues with optional filters. Returns issue details including ID, title, status, priority.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Filter by project ID" },
          cycleId: { type: "string", description: "Filter by cycle ID" },
          status: {
            type: "string",
            enum: ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"],
          },
          priority: {
            type: "string",
            enum: ["urgent", "high", "medium", "low", "none"],
          },
          limit: { type: "number", description: "Max issues to return. Default: 20" },
        },
      },
    },
  },

  // ==================== PROJECT TOOLS ====================
  {
    type: "function" as const,
    function: {
      name: "create_project",
      description: "Create a new project",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Project name (required)" },
          description: { type: "string", description: "Project description" },
          status: {
            type: "string",
            enum: ["planned", "in_progress", "paused", "completed", "cancelled"],
          },
          priority: {
            type: "string",
            enum: ["urgent", "high", "medium", "low", "none"],
          },
          color: { type: "string", description: "Hex color for the project (e.g., #6366f1)" },
          startDate: { type: "string", description: "Start date in ISO format" },
          targetDate: { type: "string", description: "Target completion date in ISO format" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_project",
      description: "Update an existing project",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project ID (required)" },
          name: { type: "string", description: "New project name" },
          description: { type: "string", description: "New description" },
          status: {
            type: "string",
            enum: ["planned", "in_progress", "paused", "completed", "cancelled"],
          },
          health: {
            type: "string",
            enum: ["on_track", "at_risk", "off_track"],
          },
          priority: {
            type: "string",
            enum: ["urgent", "high", "medium", "low", "none"],
          },
        },
        required: ["projectId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_projects",
      description: "List all projects with their status and issue counts",
      parameters: {
        type: "object",
        properties: {
          includeArchived: { type: "boolean", description: "Include archived projects" },
          status: {
            type: "string",
            enum: ["planned", "in_progress", "paused", "completed", "cancelled"],
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "archive_project",
      description: "Archive a project (soft delete)",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project ID to archive" },
        },
        required: ["projectId"],
      },
    },
  },

  // ==================== CYCLE TOOLS ====================
  {
    type: "function" as const,
    function: {
      name: "create_cycle",
      description: "Create a new cycle/sprint for organizing work within a time period",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Cycle name (optional, auto-generated if not provided)" },
          description: { type: "string", description: "Cycle description" },
          startDate: { type: "string", description: "Start date in ISO format (YYYY-MM-DD)" },
          endDate: { type: "string", description: "End date in ISO format (YYYY-MM-DD)" },
          projectId: { type: "string", description: "Project ID to associate cycle with" },
          goals: {
            type: "array",
            items: { type: "string" },
            description: "List of cycle goals",
          },
        },
        required: ["startDate", "endDate"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_cycle",
      description: "Update an existing cycle",
      parameters: {
        type: "object",
        properties: {
          cycleId: { type: "string", description: "Cycle ID (required)" },
          name: { type: "string", description: "New cycle name" },
          description: { type: "string", description: "New description" },
          status: {
            type: "string",
            enum: ["upcoming", "active", "completed"],
          },
          goals: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["cycleId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_cycle",
      description: "Delete a cycle (issues are unassigned, not deleted)",
      parameters: {
        type: "object",
        properties: {
          cycleId: { type: "string", description: "Cycle ID to delete" },
        },
        required: ["cycleId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_cycles",
      description: "List all cycles with their status and issue counts",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Filter by project ID" },
          status: {
            type: "string",
            enum: ["upcoming", "active", "completed"],
          },
        },
      },
    },
  },

  // ==================== LABEL TOOLS ====================
  {
    type: "function" as const,
    function: {
      name: "create_label",
      description: "Create a new label for categorizing issues",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Label name (required)" },
          color: { type: "string", description: "Hex color (required, e.g., #ef4444)" },
          description: { type: "string", description: "Label description" },
          projectId: { type: "string", description: "Project ID for project-specific label" },
        },
        required: ["name", "color"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_labels",
      description: "List all available labels",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Filter by project ID" },
        },
      },
    },
  },

  // ==================== CONTEXT TOOL ====================
  {
    type: "function" as const,
    function: {
      name: "get_pm_context",
      description:
        "Get current PM context including projects summary, active cycle, and recent issues. Call this to understand the current state before making changes.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

/**
 * System prompt for PM AI Assistant
 */
export function buildPMAISystemPrompt(context: {
  projectCount: number;
  issueCount: number;
  activeCycleName?: string;
  selectedProjectName?: string;
}): string {
  return `You are a helpful project management assistant for LifeOS.
You can help users manage their projects, issues, cycles, and labels.

Current Context:
- User has ${context.projectCount} projects and ${context.issueCount} total issues
- Active cycle: ${context.activeCycleName || "None"}
- Selected project: ${context.selectedProjectName || "None (all projects)"}

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
- After creating items, report the ID/identifier so the user can reference it`;
}
