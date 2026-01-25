import { writable, derived } from 'svelte/store'
import type { MCPServer, MCPPresets, PresetServer, PresetSkill } from '$lib/api/types'
import { getMCPServers, importMCPToml, exportMCPToml, deleteMCPServer, getMCPPresets, convertJsonToToml, importMCPJson } from '$lib/api/client'

function createMCPStore() {
  const { subscribe, set, update } = writable<MCPServer[]>([])
  const loading = writable(false)
  const error = writable<string | null>(null)

  async function refresh() {
    loading.set(true)
    error.set(null)
    try {
      const servers = await getMCPServers()
      set(servers || [])
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to fetch MCP servers')
    } finally {
      loading.set(false)
    }
  }

  async function importToml(toml: string) {
    loading.set(true)
    error.set(null)
    try {
      const result = await importMCPToml(toml)
      // Refresh to get the latest state
      await refresh()
      return result
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to import TOML')
      throw e
    } finally {
      loading.set(false)
    }
  }

  async function exportToml() {
    loading.set(true)
    error.set(null)
    try {
      const result = await exportMCPToml()
      return result.toml
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to export TOML')
      throw e
    } finally {
      loading.set(false)
    }
  }

  async function remove(name: string) {
    loading.set(true)
    error.set(null)
    try {
      await deleteMCPServer(name)
      update(servers => (servers || []).filter(s => s.name !== name))
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to delete MCP server')
      throw e
    } finally {
      loading.set(false)
    }
  }

  async function jsonToToml(json: string): Promise<string> {
    loading.set(true)
    error.set(null)
    try {
      const result = await convertJsonToToml(json)
      return result.toml
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to convert JSON to TOML')
      throw e
    } finally {
      loading.set(false)
    }
  }

  async function importJson(json: string) {
    loading.set(true)
    error.set(null)
    try {
      const result = await importMCPJson(json)
      // Refresh to get the latest state
      await refresh()
      return result
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to import JSON')
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
    importToml,
    exportToml,
    jsonToToml,
    importJson,
    remove,
  }
}

export const mcpServers = createMCPStore()

// Presets Store
function createPresetsStore() {
  const { subscribe, set } = writable<MCPPresets>({ servers: [], skills: [] })
  const loading = writable(false)
  const error = writable<string | null>(null)

  async function refresh() {
    loading.set(true)
    error.set(null)
    try {
      const presets = await getMCPPresets()
      set(presets)
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to fetch presets')
    } finally {
      loading.set(false)
    }
  }

  // Derived store for servers grouped by category
  const serversByCategory = derived({ subscribe }, ($presets) => {
    const grouped: Record<string, PresetServer[]> = {}
    for (const server of $presets.servers) {
      if (!grouped[server.category]) {
        grouped[server.category] = []
      }
      grouped[server.category].push(server)
    }
    return grouped
  })

  // Derived store for skills grouped by category
  const skillsByCategory = derived({ subscribe }, ($presets) => {
    const grouped: Record<string, PresetSkill[]> = {}
    for (const skill of $presets.skills) {
      if (!grouped[skill.category]) {
        grouped[skill.category] = []
      }
      grouped[skill.category].push(skill)
    }
    return grouped
  })

  return {
    subscribe,
    loading,
    error,
    refresh,
    serversByCategory,
    skillsByCategory,
  }
}

export const mcpPresets = createPresetsStore()
