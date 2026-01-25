// Agent Configuration
export interface AgentConfig {
  id: number
  name: string
  repos: string
  task_prompt: string
  system_prompt: string
  max_turns: number
  max_budget_usd: number
  cpu_limit: string
  memory_limit: string
  allowed_tools: string
  enabled_mcps: string
  enabled_skills: string
  created_at: string
  updated_at: string
}

export interface AgentConfigCreate {
  name: string
  repos?: string
  task_prompt?: string
  system_prompt?: string
  max_turns?: number
  max_budget_usd?: number
  cpu_limit?: string
  memory_limit?: string
  allowed_tools?: string
  enabled_mcps?: string
  enabled_skills?: string
}

// MCP Preset Types
export interface PresetServer {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  description: string
  category: string
}

export interface PresetSkill {
  name: string
  install_command: string
  description: string
  category: string
}

export interface MCPPresets {
  servers: PresetServer[]
  skills: PresetSkill[]
}

// MCP Server Configuration
export interface MCPServer {
  id: number
  name: string
  command: string
  args: string  // JSON array
  env: string   // JSON object
  description: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface MCPImportResponse {
  message: string
  servers: MCPServer[]
}

export interface MCPExportResponse {
  toml: string
}

// Saved TOML configuration
export interface MCPTomlConfig {
  id: number
  name: string
  content: string
  is_default: boolean
  enabled: boolean
  created_at: string
  updated_at: string
}

// Running Agent (Pod)
export interface RunningAgent {
  pod_name: string
  pod_type: 'chat' | 'agent' | 'job'
  persistent: boolean
  config_id: number
  config_name: string
  task_prompt: string
  status: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown'
  started_at: string
  node: string
  runtime_class: string
}

// Chat Messages
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  status: 'pending' | 'running' | 'completed' | 'error'
  result?: string
}

export interface ToolResult {
  toolUseId: string
  content: string
  isError?: boolean
}

// Stream JSON Events from Claude CLI
export interface StreamSystemInit {
  type: 'system'
  subtype: 'init'
  cwd: string
  session_id: string
  tools: string[]
  mcp_servers?: Array<{ name: string; status: string }>
  model: string
  claude_code_version: string
}

export interface StreamAssistantText {
  type: 'assistant'
  message: {
    id: string
    content: Array<{ type: 'text'; text: string }>
  }
}

export interface StreamAssistantToolUse {
  type: 'assistant'
  tool_use: {
    id: string
    name: string
    input: Record<string, unknown>
  }
}

export interface StreamToolResult {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

export interface StreamResult {
  type: 'result'
  result?: string
  cost_usd?: number
  duration_ms?: number
  num_turns?: number
}

export type StreamEvent =
  | StreamSystemInit
  | StreamAssistantText
  | StreamAssistantToolUse
  | StreamToolResult
  | StreamResult
  | { type: string; [key: string]: unknown }

// SSE Events from backend
export interface ChatStartEvent {
  type: 'start'
  thread_id: string
  pod_name: string
}

export interface ChatContentEvent {
  type: 'content'
  content: string
}

export interface ChatJsonEvent {
  type: 'json'
  data: StreamEvent
}

export interface ChatErrorEvent {
  type: 'error'
  message: string
}

export interface ChatDoneEvent {
  type: 'done'
}

export type ChatEvent = ChatStartEvent | ChatContentEvent | ChatJsonEvent | ChatErrorEvent | ChatDoneEvent

// Thread history
export interface ChatThread {
  id: string
  title: string
  podName: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
  systemInfo?: StreamSystemInit
}

// GitHub Repository
export interface GitHubRepo {
  full_name: string
  clone_url: string
  ssh_url: string
  private: boolean
  description: string
}

// API Responses
export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface DashboardData {
  agents: RunningAgent[]
  configs: AgentConfig[]
}
