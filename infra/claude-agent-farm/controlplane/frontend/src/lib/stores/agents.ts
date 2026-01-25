import { writable, derived } from 'svelte/store'
import type { RunningAgent } from '$lib/api/types'
import { getAgents } from '$lib/api/client'

function createAgentsStore() {
  const { subscribe, set, update } = writable<RunningAgent[]>([])
  const loading = writable(false)
  const error = writable<string | null>(null)

  let refreshInterval: ReturnType<typeof setInterval> | null = null

  async function refresh() {
    loading.set(true)
    error.set(null)
    try {
      const agents = await getAgents()
      set(agents || [])
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to fetch agents')
    } finally {
      loading.set(false)
    }
  }

  function startAutoRefresh(intervalMs = 10000) {
    stopAutoRefresh()
    refresh()
    refreshInterval = setInterval(refresh, intervalMs)
  }

  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }

  function removeAgent(podName: string) {
    update(agents => (agents || []).filter(a => a.pod_name !== podName))
  }

  return {
    subscribe,
    loading,
    error,
    refresh,
    startAutoRefresh,
    stopAutoRefresh,
    removeAgent,
  }
}

export const agents = createAgentsStore()

export const runningCount = derived(agents, $agents =>
  ($agents || []).filter(a => a.status === 'Running').length
)

export const pendingCount = derived(agents, $agents =>
  ($agents || []).filter(a => a.status === 'Pending').length
)
