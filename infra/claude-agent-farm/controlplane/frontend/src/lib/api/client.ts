import type { AgentConfig, AgentConfigCreate, RunningAgent, ChatEvent, MCPServer, MCPImportResponse, MCPExportResponse, MCPPresets, MCPTomlConfig, GitHubRepo } from './types'
import { API_BASE } from '$lib/config'

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || `HTTP ${response.status}`)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

// Configs
export async function getConfigs(): Promise<AgentConfig[]> {
  return fetchJson<AgentConfig[]>('/configs')
}

export async function getConfig(id: number): Promise<AgentConfig> {
  return fetchJson<AgentConfig>(`/configs/${id}`)
}

export async function createConfig(config: AgentConfigCreate): Promise<AgentConfig> {
  return fetchJson<AgentConfig>('/configs', {
    method: 'POST',
    body: JSON.stringify(config),
  })
}

export async function updateConfig(id: number, config: Partial<AgentConfigCreate>): Promise<AgentConfig> {
  return fetchJson<AgentConfig>(`/configs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

export async function deleteConfig(id: number): Promise<void> {
  await fetchJson<void>(`/configs/${id}`, { method: 'DELETE' })
}

// Agents
export async function getAgents(): Promise<RunningAgent[]> {
  return fetchJson<RunningAgent[]>('/agents')
}

export async function launchAgent(configId: number, taskPrompt: string): Promise<{ pod_name: string }> {
  return fetchJson<{ pod_name: string }>(`/agents/launch/${configId}`, {
    method: 'POST',
    body: JSON.stringify({ task_prompt: taskPrompt }),
  })
}

export async function stopAgent(podName: string): Promise<void> {
  await fetchJson<void>(`/agents/${podName}`, { method: 'DELETE' })
}

export async function getAgentLogs(podName: string, lines = 100): Promise<{ pod_name: string; logs: string }> {
  return fetchJson<{ pod_name: string; logs: string }>(`/agents/${podName}/logs?lines=${lines}`)
}

// Streaming logs
export function streamAgentLogs(podName: string, onLog: (log: string) => void): () => void {
  const eventSource = new EventSource(`${API_BASE}/agents/${podName}/logs/stream`)

  eventSource.onmessage = (event) => {
    onLog(event.data)
  }

  eventSource.onerror = () => {
    eventSource.close()
  }

  return () => eventSource.close()
}

// Chat
export function sendChatMessage(
  message: string,
  threadId: string | null,
  options: { skipPermissions?: boolean; streamJson?: boolean; podName?: string; agentId?: number } = {},
  onEvent: (event: ChatEvent) => void
): () => void {
  const params = new URLSearchParams({
    message,
    ...(threadId && { thread_id: threadId }),
    ...(options.podName && { pod_name: options.podName }),
    ...(options.agentId && { agent_id: String(options.agentId) }),
    skip_permissions: String(options.skipPermissions ?? true),
    stream_json: String(options.streamJson ?? false),
  })

  const eventSource = new EventSource(`${API_BASE}/chat/send?${params}`)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as ChatEvent
      onEvent(data)

      if (data.type === 'done' || data.type === 'error') {
        eventSource.close()
      }
    } catch (e) {
      console.error('Failed to parse SSE event:', e)
    }
  }

  eventSource.onerror = () => {
    onEvent({ type: 'error', message: 'Connection lost' })
    eventSource.close()
  }

  return () => eventSource.close()
}

// MCP Servers
export async function getMCPServers(): Promise<MCPServer[]> {
  return fetchJson<MCPServer[]>('/mcp/servers')
}

export async function importMCPToml(toml: string): Promise<MCPImportResponse> {
  return fetchJson<MCPImportResponse>('/mcp/import-toml', {
    method: 'POST',
    body: JSON.stringify({ toml }),
  })
}

export async function exportMCPToml(): Promise<MCPExportResponse> {
  return fetchJson<MCPExportResponse>('/mcp/export-toml')
}

export async function convertJsonToToml(json: string): Promise<{ toml: string }> {
  return fetchJson<{ toml: string }>('/mcp/convert-json', {
    method: 'POST',
    body: JSON.stringify({ json }),
  })
}

export async function importMCPJson(json: string): Promise<MCPImportResponse> {
  return fetchJson<MCPImportResponse>('/mcp/import-json', {
    method: 'POST',
    body: JSON.stringify({ json }),
  })
}

export async function deleteMCPServer(name: string): Promise<void> {
  await fetchJson<void>(`/mcp/servers/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

// MCP Presets
export async function getMCPPresets(): Promise<MCPPresets> {
  return fetchJson<MCPPresets>('/mcp/presets')
}

// MCP TOML Configs (saved configurations)
export async function getTomlConfigs(): Promise<MCPTomlConfig[]> {
  return fetchJson<MCPTomlConfig[]>('/mcp/configs')
}

export async function getTomlConfig(name: string): Promise<MCPTomlConfig> {
  return fetchJson<MCPTomlConfig>(`/mcp/configs/${encodeURIComponent(name)}`)
}

export async function createTomlConfig(name: string, content: string): Promise<MCPTomlConfig> {
  return fetchJson<MCPTomlConfig>('/mcp/configs', {
    method: 'POST',
    body: JSON.stringify({ name, content }),
  })
}

export async function updateTomlConfig(name: string, content: string): Promise<void> {
  await fetchJson<void>(`/mcp/configs/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
}

export async function deleteTomlConfig(name: string): Promise<void> {
  await fetchJson<void>(`/mcp/configs/${encodeURIComponent(name)}`, { method: 'DELETE' })
}


export async function getActiveServers(): Promise<MCPServer[]> {
  return fetchJson<MCPServer[]>('/mcp/active-servers')
}

// GitHub Repos
export async function getGitHubRepos(): Promise<GitHubRepo[]> {
  return fetchJson<GitHubRepo[]>('/github/repos')
}

// Cleanup
export async function cleanupPods(minutes = 30): Promise<{ cleaned: number; message: string }> {
  return fetchJson<{ cleaned: number; message: string }>(`/agents/cleanup?minutes=${minutes}`, {
    method: 'POST',
  })
}
