import { invoke } from "@tauri-apps/api/core";

// Types matching the Rust structs

export interface ContainerStatus {
  exists: boolean;
  running: boolean;
  name: string;
}

export interface ClaudeCodeResult {
  success: boolean;
  output?: string;
  error?: string;
  json_output?: string;
}

export type Environment = "dev" | "staging" | "prod";

// MCP Tools available in the Claude agent containers
export interface MCPTool {
  name: string;
  description: string;
  category: string;
}

// Hardcoded list of MCP tools from .mcp.json
export const MCP_TOOLS: MCPTool[] = [
  // Projects
  { name: "get_projects", description: "Get user's projects with issue counts and completion stats", category: "Projects" },
  { name: "get_tasks", description: "Get tasks/issues with optional filters", category: "Projects" },
  { name: "create_issue", description: "Create a new task/issue", category: "Projects" },
  { name: "mark_issue_complete", description: "Mark a task as complete", category: "Projects" },
  // Cycles
  { name: "get_current_cycle", description: "Get the currently active cycle/sprint", category: "Cycles" },
  { name: "assign_issue_to_cycle", description: "Assign a task to a cycle", category: "Cycles" },
  // Agenda
  { name: "get_daily_agenda", description: "Get today's full agenda: tasks, events, priorities", category: "Agenda" },
  { name: "get_weekly_agenda", description: "Get weekly agenda for the next 7 days", category: "Agenda" },
  { name: "get_todays_tasks", description: "Get today's tasks including due and priority items", category: "Agenda" },
  // Notes
  { name: "search_notes", description: "Search voice memos/notes by content", category: "Notes" },
  { name: "get_recent_notes", description: "Get recent voice memos/notes with transcripts", category: "Notes" },
  { name: "create_quick_note", description: "Create a quick text note", category: "Notes" },
  { name: "add_tags_to_note", description: "Add tags to an existing note", category: "Notes" },
  // People/FRM
  { name: "get_people", description: "Get all contacts/people with optional filters", category: "People" },
  { name: "get_person", description: "Get a person's details with AI-generated profile", category: "People" },
  { name: "search_people", description: "Search contacts by name", category: "People" },
  { name: "create_person", description: "Create a new contact/person", category: "People" },
  { name: "update_person", description: "Update a contact's details", category: "People" },
  { name: "get_memos_for_person", description: "Get voice memos linked to a person", category: "People" },
  { name: "get_person_timeline", description: "Get interaction timeline for a person", category: "People" },
  { name: "link_memo_to_person", description: "Link a voice memo to a person", category: "People" },
  // Clients
  { name: "get_clients", description: "Get all clients for consulting/freelance work", category: "Clients" },
  { name: "get_client", description: "Get a single client's details", category: "Clients" },
  { name: "get_projects_for_client", description: "Get all projects for a client", category: "Clients" },
  { name: "create_client", description: "Create a new client", category: "Clients" },
  { name: "update_client", description: "Update a client's details", category: "Clients" },
  // Phases
  { name: "get_phases", description: "Get all phases for a project", category: "Phases" },
  { name: "get_phase", description: "Get a single phase with its issues", category: "Phases" },
  { name: "create_phase", description: "Create a new phase in a project", category: "Phases" },
  { name: "update_phase", description: "Update a phase's details", category: "Phases" },
  { name: "delete_phase", description: "Delete a phase", category: "Phases" },
  { name: "assign_issue_to_phase", description: "Assign an issue to a phase", category: "Phases" },
];

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

/**
 * Check if Docker is available on the system
 */
export async function checkDockerAvailable(): Promise<boolean> {
  if (!isTauri) return false;
  try {
    return await invoke<boolean>("check_docker_available");
  } catch (error) {
    console.error("Failed to check Docker availability:", error);
    return false;
  }
}

/**
 * Get the status of a Claude agent container for a specific environment
 */
export async function getContainerStatus(env: Environment): Promise<ContainerStatus> {
  if (!isTauri) {
    return { exists: false, running: false, name: `claude-agent-${env}` };
  }
  try {
    return await invoke<ContainerStatus>("get_container_status", { env });
  } catch (error) {
    console.error("Failed to get container status:", error);
    return { exists: false, running: false, name: `claude-agent-${env}` };
  }
}

/**
 * Start a Claude agent container
 */
export async function startContainer(env: Environment): Promise<void> {
  if (!isTauri) {
    throw new Error("Not running in Tauri");
  }
  await invoke<void>("start_container", { env });
}

/**
 * Stop a Claude agent container
 */
export async function stopContainer(env: Environment): Promise<void> {
  if (!isTauri) {
    throw new Error("Not running in Tauri");
  }
  await invoke<void>("stop_container", { env });
}

/**
 * Execute a Claude prompt in the Docker container
 */
export async function executePrompt(
  env: Environment,
  prompt: string,
  jsonOutput: boolean = false
): Promise<ClaudeCodeResult> {
  if (!isTauri) {
    return { success: false, error: "Not running in Tauri" };
  }
  try {
    return await invoke<ClaudeCodeResult>("execute_claude_prompt", {
      env,
      prompt,
      jsonOutput,
    });
  } catch (error) {
    console.error("Failed to execute Claude prompt:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get MCP tools grouped by category
 */
export function getMCPToolsByCategory(): Record<string, MCPTool[]> {
  return MCP_TOOLS.reduce((acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = [];
    }
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, MCPTool[]>);
}
