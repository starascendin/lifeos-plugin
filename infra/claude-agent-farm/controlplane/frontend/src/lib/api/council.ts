import type { CouncilProvider, CouncilEvent, CouncilPodStatus } from './types'
import { API_BASE } from '$lib/config'
import { Capacitor, CapacitorHttp } from '@capacitor/core'

// Helper for API calls that works on both web and native
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const fullUrl = `${API_BASE}${url}`

  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      url: fullUrl,
      method: (options?.method as 'GET' | 'POST' | 'PUT' | 'DELETE') || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string>),
      },
      data: options?.body ? JSON.parse(options.body as string) : undefined,
    })

    if (response.status >= 400) {
      throw new Error(typeof response.data === 'string' ? response.data : JSON.stringify(response.data))
    }

    return typeof response.data === 'string' ? JSON.parse(response.data) : response.data
  }

  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(await response.text() || `HTTP ${response.status}`)
  }

  return response.json()
}

// Fetch available council providers
export async function getCouncilProviders(): Promise<CouncilProvider[]> {
  return apiFetch<CouncilProvider[]>('/council/providers')
}

// Get council pod status
export async function getCouncilPodStatus(): Promise<CouncilPodStatus> {
  return apiFetch<CouncilPodStatus>('/council/pod')
}

// Launch council pod
export async function launchCouncilPod(): Promise<{ pod_name: string; status: string }> {
  return apiFetch<{ pod_name: string; status: string }>('/council/pod/launch', { method: 'POST' })
}

// Refresh council pod
export async function refreshCouncilPod(): Promise<{ pod_name: string; status: string }> {
  return apiFetch<{ pod_name: string; status: string }>('/council/pod/refresh', { method: 'POST' })
}

// SSE streaming using fetch with ReadableStream (works on native webview)
function streamSSE(
  url: string,
  onEvent: (event: CouncilEvent) => void
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
        onEvent({ type: 'error', message: `HTTP ${response.status}` })
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        onEvent({ type: 'error', message: 'No response body' })
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
              const data = JSON.parse(line.slice(6)) as CouncilEvent
              onEvent(data)

              if (data.type === 'done' || data.type === 'error') {
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
        onEvent({ type: 'error', message: 'Connection lost' })
      }
    }
  }

  connect()

  return () => controller.abort()
}

// Ask the council a question with SSE streaming
export function askCouncil(
  question: string,
  providers: string[],
  chairmen: string[],
  onEvent: (event: CouncilEvent) => void
): () => void {
  const params = new URLSearchParams({
    question,
    providers: providers.join(','),
    chairmen: chairmen.join(',')
  })

  const url = `${API_BASE}/council/ask?${params}`

  // Use fetch-based SSE on native (EventSource has issues with Capacitor)
  if (Capacitor.isNativePlatform()) {
    return streamSSE(url, onEvent)
  }

  // Web uses native EventSource
  const eventSource = new EventSource(url)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as CouncilEvent
      onEvent(data)

      if (data.type === 'done' || data.type === 'error') {
        eventSource.close()
      }
    } catch (e) {
      console.error('Failed to parse council SSE event:', e)
    }
  }

  eventSource.onerror = () => {
    onEvent({ type: 'error', message: 'Connection lost' })
    eventSource.close()
  }

  return () => eventSource.close()
}
