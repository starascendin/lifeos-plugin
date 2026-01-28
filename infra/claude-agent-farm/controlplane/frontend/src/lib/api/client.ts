import type { AgentConfig, AgentConfigCreate, RunningAgent, ChatEvent, MCPServer, MCPPresets, MCPTomlConfig, GitHubRepo, Skill, SkillCreate } from './types'
import { API_BASE } from '$lib/config'
import { Capacitor, CapacitorHttp } from '@capacitor/core'

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const fullUrl = `${API_BASE}${url}`
  console.log('[API] Request:', fullUrl)

  // Use native HTTP on mobile to bypass CORS and properly route through VPN/Tailscale
  if (Capacitor.isNativePlatform()) {
    console.log('[API] Using native HTTP')
    const response = await CapacitorHttp.request({
      url: fullUrl,
      method: (options?.method as 'GET' | 'POST' | 'PUT' | 'DELETE') || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string>),
      },
      data: options?.body ? JSON.parse(options.body as string) : undefined,
    })
    console.log('[API] Response:', response.status, response.data)

    if (response.status >= 400) {
      const error = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
      throw new Error(error || `HTTP ${response.status}`)
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T
    }

    return typeof response.data === 'string' ? JSON.parse(response.data) : response.data
  }

  // Web fallback uses regular fetch
  const response = await fetch(fullUrl, {
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

export async function getConfig(id: string | number): Promise<AgentConfig> {
  return fetchJson<AgentConfig>(`/configs/${id}`)
}

export async function createConfig(config: AgentConfigCreate): Promise<AgentConfig> {
  return fetchJson<AgentConfig>('/configs', {
    method: 'POST',
    body: JSON.stringify(config),
  })
}

export async function updateConfig(id: string | number, config: Partial<AgentConfigCreate>): Promise<AgentConfig> {
  return fetchJson<AgentConfig>(`/configs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

export async function deleteConfig(id: string | number): Promise<void> {
  await fetchJson<void>(`/configs/${id}`, { method: 'DELETE' })
}

// Agents
export async function getAgents(): Promise<RunningAgent[]> {
  return fetchJson<RunningAgent[]>('/agents')
}

export async function launchAgent(configId: string | number, taskPrompt: string): Promise<{ pod_name: string }> {
  return fetchJson<{ pod_name: string }>(`/agents/launch/${configId}`, {
    method: 'POST',
    body: JSON.stringify({ task_prompt: taskPrompt }),
  })
}

export async function recreateAgentPod(configId: string | number): Promise<{ pod_name: string }> {
  return fetchJson<{ pod_name: string }>(`/agents/recreate/${configId}`, {
    method: 'POST',
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

// SSE streaming using fetch with ReadableStream (works on native webview)
function streamSSE<T>(
  url: string,
  onEvent: (event: T) => void,
  isDone: (event: T) => boolean
): () => void {
  const controller = new AbortController()

  async function connect() {
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/event-stream',
        },
      })

      if (!response.ok) {
        onEvent({ type: 'error', message: `HTTP ${response.status}` } as T)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        onEvent({ type: 'error', message: 'No response body' } as T)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as T
              onEvent(data)

              if (isDone(data)) {
                reader.cancel()
                return
              }
            } catch (e) {
              console.error('Failed to parse SSE event:', e)
            }
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        onEvent({ type: 'error', message: 'Connection lost' } as T)
      }
    }
  }

  connect()

  return () => controller.abort()
}

// Chat
export function sendChatMessage(
  message: string,
  threadId: string | null,
  options: { skipPermissions?: boolean; streamJson?: boolean; podName?: string; agentId?: string | number } = {},
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

  const url = `${API_BASE}/chat/send?${params}`

  // Use fetch-based SSE on native (EventSource has issues with Capacitor)
  if (Capacitor.isNativePlatform()) {
    return streamSSE<ChatEvent>(url, onEvent, (e) => e.type === 'done' || e.type === 'error')
  }

  // Web uses native EventSource
  const eventSource = new EventSource(url)

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

// MCP Utilities
export async function convertJsonToToml(json: string): Promise<{ toml: string }> {
  return fetchJson<{ toml: string }>('/mcp/convert-json', {
    method: 'POST',
    body: JSON.stringify({ json }),
  })
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

// Skills
export async function getSkills(): Promise<Skill[]> {
  return fetchJson<Skill[]>('/skills')
}

export async function getSkill(name: string): Promise<Skill> {
  return fetchJson<Skill>(`/skills/${encodeURIComponent(name)}`)
}

export async function createSkill(skill: SkillCreate): Promise<Skill> {
  return fetchJson<Skill>('/skills', {
    method: 'POST',
    body: JSON.stringify(skill),
  })
}

export async function updateSkill(name: string, skill: Partial<SkillCreate>): Promise<Skill> {
  return fetchJson<Skill>(`/skills/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify(skill),
  })
}

export async function deleteSkill(name: string): Promise<void> {
  await fetchJson<void>(`/skills/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

export async function toggleSkill(name: string, enabled: boolean): Promise<void> {
  await fetchJson<void>(`/skills/${encodeURIComponent(name)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  })
}

// System Info
export interface SystemInfo {
  storage_type: 'sqlite' | 'convex'
  convex_url: string
  k8s_enabled: boolean
  github_enabled: boolean
  version: string
  build_time: string
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return fetchJson<SystemInfo>('/system-info')
}
