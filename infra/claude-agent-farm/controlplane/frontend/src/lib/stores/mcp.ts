import { writable, derived } from 'svelte/store'
import type { MCPPresets, PresetServer, PresetSkill } from '$lib/api/types'
import { getMCPPresets, convertJsonToToml } from '$lib/api/client'

// JSON to TOML conversion utility
export async function jsonToToml(json: string): Promise<string> {
  const result = await convertJsonToToml(json)
  return result.toml
}

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
