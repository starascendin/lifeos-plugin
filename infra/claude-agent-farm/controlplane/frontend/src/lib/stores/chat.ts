import { writable, derived, get } from 'svelte/store'
import type {
  ChatMessage,
  ChatEvent,
  ChatThread,
  ToolCall,
  StreamSystemInit,
  StreamEvent,
  StreamToolResult
} from '$lib/api/types'
import { sendChatMessage } from '$lib/api/client'

const STORAGE_KEY = 'claude-chat-threads'

// Individual stores
const messages = writable<ChatMessage[]>([])
const threadId = writable<string | null>(null)
const podName = writable<string | null>(null)
const selectedAgent = writable<string | null>(null) // Selected agent pod name (for display)
const selectedAgentId = writable<string | number | null>(null) // Selected agent config ID (for API) - supports Convex string IDs
const isStreaming = writable(false)
const streamingContent = writable('')
const streamingToolCalls = writable<ToolCall[]>([])
const connectionStatus = writable<'disconnected' | 'connecting' | 'connected'>('disconnected')
const error = writable<string | null>(null)
const systemInfo = writable<StreamSystemInit | null>(null)
const threads = writable<ChatThread[]>([])
const streamEvents = writable<StreamEvent[]>([])

let closeStream: (() => void) | null = null

// Load threads from localStorage
function loadThreads(): ChatThread[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Save threads to localStorage
function saveThreads(threadList: ChatThread[]) {
  if (typeof window === 'undefined') return
  try {
    // Keep only last 50 threads
    const toSave = threadList.slice(-50)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (e) {
    console.error('Failed to save threads:', e)
  }
}

// Initialize threads from storage
if (typeof window !== 'undefined') {
  threads.set(loadThreads())
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

function send(
  message: string,
  options: { skipPermissions?: boolean; streamJson?: boolean } = {}
) {
  if (get(isStreaming)) return

  const msgId = generateId()
  const now = new Date().toISOString()

  // Add user message
  messages.update(msgs => [...msgs, {
    id: msgId,
    role: 'user',
    content: message,
    timestamp: now
  }])

  isStreaming.set(true)
  streamingContent.set('')
  streamingToolCalls.set([])
  streamEvents.set([])
  connectionStatus.set('connecting')
  error.set(null)

  const currentThreadId = get(threadId)
  const currentSelectedAgent = get(selectedAgent)
  const currentAgentId = get(selectedAgentId)

  closeStream = sendChatMessage(
    message,
    currentThreadId,
    {
      ...options,
      podName: currentSelectedAgent || undefined,
      agentId: currentAgentId || undefined
    },
    (event: ChatEvent) => {
      switch (event.type) {
        case 'start':
          threadId.set(event.thread_id)
          podName.set(event.pod_name)
          connectionStatus.set('connected')
          break

        case 'content':
          streamingContent.update(content => content + event.content)
          break

        case 'json':
          handleStreamEvent(event.data)
          break

        case 'done':
          finishStreaming()
          break

        case 'error':
          handleError(event.message)
          break
      }
    }
  )
}

function handleStreamEvent(event: StreamEvent) {
  // Store all events for display
  streamEvents.update(events => [...events, event])

  if (event.type === 'system' && 'subtype' in event && event.subtype === 'init') {
    systemInfo.set(event as StreamSystemInit)
  } else if (event.type === 'assistant') {
    if ('message' in event && event.message?.content) {
      // Extract text from message content
      const textContent = event.message.content
        .filter((c: { type: string }) => c.type === 'text')
        .map((c: { text: string }) => c.text)
        .join('')
      if (textContent) {
        streamingContent.update(content => content + textContent)
      }
    } else if ('tool_use' in event && event.tool_use) {
      // Add tool call
      const toolCall: ToolCall = {
        id: event.tool_use.id,
        name: event.tool_use.name,
        input: event.tool_use.input,
        status: 'running'
      }
      streamingToolCalls.update(calls => [...calls, toolCall])
    }
  } else if (event.type === 'tool_result') {
    // Update tool call status and result
    const resultEvent = event as StreamToolResult
    streamingToolCalls.update(calls =>
      calls.map(call =>
        call.id === resultEvent.tool_use_id
          ? {
              ...call,
              status: resultEvent.is_error ? 'error' : 'completed' as const,
              result: resultEvent.content
            }
          : call
      )
    )
  }
}

function finishStreaming() {
  const finalContent = get(streamingContent)
  const toolCalls = get(streamingToolCalls)
  const now = new Date().toISOString()

  if (finalContent || toolCalls.length > 0) {
    messages.update(msgs => [...msgs, {
      id: generateId(),
      role: 'assistant',
      content: finalContent,
      timestamp: now,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    }])
  }

  // Save thread
  saveCurrentThread()

  streamingContent.set('')
  streamingToolCalls.set([])
  isStreaming.set(false)
  connectionStatus.set('connected')
}

function handleError(errorMessage: string) {
  error.set(errorMessage)
  const errorContent = get(streamingContent)
  const now = new Date().toISOString()

  if (errorContent) {
    messages.update(msgs => [...msgs, {
      id: generateId(),
      role: 'assistant',
      content: errorContent + '\n\n**Error:** ' + errorMessage,
      timestamp: now
    }])
  } else {
    messages.update(msgs => [...msgs, {
      id: generateId(),
      role: 'assistant',
      content: '**Error:** ' + errorMessage,
      timestamp: now
    }])
  }

  saveCurrentThread()
  streamingContent.set('')
  streamingToolCalls.set([])
  isStreaming.set(false)
  connectionStatus.set('disconnected')
}

function saveCurrentThread() {
  const currentThreadId = get(threadId)
  const currentMessages = get(messages)
  const currentPodName = get(podName)
  const currentSystemInfo = get(systemInfo)

  if (!currentThreadId || currentMessages.length === 0) return

  const firstUserMsg = currentMessages.find(m => m.role === 'user')
  const title = firstUserMsg?.content.slice(0, 50) || 'New Chat'

  const thread: ChatThread = {
    id: currentThreadId,
    title: title + (title.length >= 50 ? '...' : ''),
    podName: currentPodName || '',
    createdAt: currentMessages[0]?.timestamp || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: currentMessages,
    systemInfo: currentSystemInfo || undefined
  }

  threads.update(threadList => {
    const existing = threadList.findIndex(t => t.id === currentThreadId)
    if (existing >= 0) {
      threadList[existing] = thread
    } else {
      threadList.push(thread)
    }
    saveThreads(threadList)
    return [...threadList]
  })
}

function stop() {
  if (closeStream) {
    closeStream()
    closeStream = null
  }
  isStreaming.set(false)
  connectionStatus.set('disconnected')
}

function newThread() {
  stop()
  messages.set([])
  threadId.set(null)
  podName.set(null)
  streamingContent.set('')
  streamingToolCalls.set([])
  streamEvents.set([])
  systemInfo.set(null)
  error.set(null)
}

function loadThread(thread: ChatThread) {
  stop()
  messages.set(thread.messages)
  threadId.set(thread.id)
  podName.set(thread.podName)
  systemInfo.set(thread.systemInfo || null)
  streamingContent.set('')
  streamingToolCalls.set([])
  streamEvents.set([])
  error.set(null)
  connectionStatus.set('disconnected')
}

function deleteThread(id: string) {
  threads.update(threadList => {
    const filtered = threadList.filter(t => t.id !== id)
    saveThreads(filtered)
    return filtered
  })

  // If deleting current thread, start new
  if (get(threadId) === id) {
    newThread()
  }
}

function clearAllThreads() {
  threads.set([])
  saveThreads([])
  newThread()
}

function selectAgent(agentName: string | null, agentId: string | number | null = null) {
  const currentAgentId = get(selectedAgentId)
  selectedAgent.set(agentName)
  selectedAgentId.set(agentId)
  // When selecting a new agent, start a fresh thread
  if (agentId !== currentAgentId) {
    newThread()
  }
}

// Combine into a single derived store for easy $chat access
export const chat = derived(
  [messages, threadId, podName, selectedAgent, selectedAgentId, isStreaming, streamingContent, streamingToolCalls, connectionStatus, error, systemInfo, threads, streamEvents],
  ([$messages, $threadId, $podName, $selectedAgent, $selectedAgentId, $isStreaming, $streamingContent, $streamingToolCalls, $connectionStatus, $error, $systemInfo, $threads, $streamEvents]) => ({
    messages: $messages,
    threadId: $threadId,
    podName: $podName,
    selectedAgent: $selectedAgent,
    selectedAgentId: $selectedAgentId,
    isStreaming: $isStreaming,
    streamingContent: $streamingContent,
    streamingToolCalls: $streamingToolCalls,
    connectionStatus: $connectionStatus,
    error: $error,
    systemInfo: $systemInfo,
    threads: $threads,
    streamEvents: $streamEvents,
  })
)

// Export actions separately (not reactive, just functions)
export const chatActions = {
  send,
  stop,
  newThread,
  loadThread,
  deleteThread,
  clearAllThreads,
  selectAgent
}
