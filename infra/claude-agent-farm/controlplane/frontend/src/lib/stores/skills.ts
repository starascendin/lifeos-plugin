import { writable, derived } from 'svelte/store'
import type { Skill, SkillCreate } from '$lib/api/types'
import { getSkills, createSkill, updateSkill, deleteSkill, toggleSkill } from '$lib/api/client'

function createSkillsStore() {
  const { subscribe, set, update } = writable<Skill[]>([])
  const loading = writable(false)
  const error = writable<string | null>(null)

  async function refresh() {
    loading.set(true)
    error.set(null)
    try {
      const skills = await getSkills()
      set(skills || [])
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to fetch skills')
    } finally {
      loading.set(false)
    }
  }

  async function add(skill: SkillCreate) {
    loading.set(true)
    error.set(null)
    try {
      const newSkill = await createSkill(skill)
      update(skills => [...(skills || []), newSkill])
      return newSkill
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to create skill')
      throw e
    } finally {
      loading.set(false)
    }
  }

  async function edit(name: string, skill: Partial<SkillCreate>) {
    loading.set(true)
    error.set(null)
    try {
      const updatedSkill = await updateSkill(name, skill)
      update(skills => (skills || []).map(s => s.name === name ? updatedSkill : s))
      return updatedSkill
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to update skill')
      throw e
    } finally {
      loading.set(false)
    }
  }

  async function remove(name: string) {
    loading.set(true)
    error.set(null)
    try {
      await deleteSkill(name)
      update(skills => (skills || []).filter(s => s.name !== name))
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to delete skill')
      throw e
    } finally {
      loading.set(false)
    }
  }

  async function toggle(name: string, enabled: boolean) {
    error.set(null)
    try {
      await toggleSkill(name, enabled)
      update(skills => (skills || []).map(s => s.name === name ? { ...s, enabled } : s))
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Failed to toggle skill')
      throw e
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
    toggle,
  }
}

export const skills = createSkillsStore()

// Derived store for skills grouped by category
export const skillsByCategory = derived(skills, ($skills) => {
  const grouped: Record<string, Skill[]> = {}
  for (const skill of $skills) {
    const category = skill.category || 'other'
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push(skill)
  }
  return grouped
})

// Category labels for display
export const categoryLabels: Record<string, string> = {
  git: 'Git Tools',
  productivity: 'Productivity',
  other: 'Other',
}
