import { writable } from 'svelte/store'
import type { AgentConfig, AgentConfigCreate } from '$lib/api/types'
import { getConfigs, createConfig, updateConfig, deleteConfig } from '$lib/api/client'

// Helper to get the effective ID for a config (convex_id if present, otherwise id)
function getEffectiveId(config: AgentConfig): string | number {
  return config.convex_id || config.id
}

function createConfigsStore() {
  const { subscribe, set, update } = writable<AgentConfig[]>([])
  const loading = writable(false)
  const error = writable<string | null>(null)

  async function refresh() {
    loading.set(true)
    error.set(null)
    try {
      const configs = await getConfigs()
      set(configs || [])
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to fetch configs')
    } finally {
      loading.set(false)
    }
  }

  async function add(config: AgentConfigCreate) {
    loading.set(true)
    error.set(null)
    try {
      const newConfig = await createConfig(config)
      update(configs => [...(configs || []), newConfig])
      return newConfig
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to create config')
      throw e
    } finally {
      loading.set(false)
    }
  }

  async function edit(id: string | number, config: Partial<AgentConfigCreate>) {
    loading.set(true)
    error.set(null)
    try {
      const updatedConfig = await updateConfig(id, config)
      update(configs => (configs || []).map(c => getEffectiveId(c) === id ? updatedConfig : c))
      return updatedConfig
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to update config')
      throw e
    } finally {
      loading.set(false)
    }
  }

  async function remove(id: string | number) {
    loading.set(true)
    error.set(null)
    try {
      await deleteConfig(id)
      update(configs => (configs || []).filter(c => getEffectiveId(c) !== id))
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to delete config')
      throw e
    } finally {
      loading.set(false)
    }
  }

  return {
    subscribe,
    loading,
    error,
    refresh,
    add,
    edit,
    remove,
    getEffectiveId,
  }
}

export const configs = createConfigsStore()
