import { writable, derived, get } from 'svelte/store'
import type {
  CouncilProvider,
  CouncilProviderResponse,
  CouncilPeerRanking,
  CouncilEvent,
  CouncilResult,
  CouncilPodStatus,
  CouncilTier,
  ChairmanSynthesis
} from '$lib/api/types'
import { getCouncilProviders, askCouncil, getCouncilPodStatus, launchCouncilPod, refreshCouncilPod } from '$lib/api/council'

export type CouncilStage = 'idle' | 'deliberating' | 'reviewing' | 'synthesizing' | 'done' | 'error'

// Session type for history
export interface CouncilSession {
  id: string
  question: string
  tier: CouncilTier
  providerIds: string[]
  chairmenIds: string[]
  responses: CouncilProviderResponse[]
  peerReviews: CouncilPeerRanking[]
  syntheses: ChairmanSynthesis[]
  stage: CouncilStage  // Track what stage this session reached
  createdAt: string
}

const STORAGE_KEY = 'council-sessions'

// Individual stores
const providers = writable<CouncilProvider[]>([])
const tier = writable<CouncilTier>('normal')
const selectedProviders = writable<Set<string>>(new Set(['claude', 'openai', 'gemini']))
const chairmen = writable<Set<string>>(new Set(['claude'])) // Multiple chairmen
const question = writable<string>('')
const responses = writable<Map<string, CouncilProviderResponse>>(new Map())
const peerReviews = writable<CouncilPeerRanking[]>([])
const syntheses = writable<Map<string, ChairmanSynthesis>>(new Map()) // Multiple syntheses by chairman_id
const stage = writable<CouncilStage>('idle')
const error = writable<string | null>(null)
const activeProviders = writable<Set<string>>(new Set())
const activeSynthesizers = writable<Set<string>>(new Set()) // Track which chairmen are synthesizing
const result = writable<CouncilResult | null>(null)
const podStatus = writable<CouncilPodStatus>({ status: 'not_found', pod_name: '' })
const podLoading = writable<boolean>(false)
const sessions = writable<CouncilSession[]>([])
const currentSessionId = writable<string | null>(null)

let closeStream: (() => void) | null = null

// Load sessions from localStorage
function loadSessions(): CouncilSession[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Save sessions to localStorage
function saveSessions(sessionList: CouncilSession[]) {
  if (typeof window === 'undefined') return
  try {
    // Keep only last 30 sessions
    const toSave = sessionList.slice(-30)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (e) {
    console.error('Failed to save council sessions:', e)
  }
}

// Initialize sessions from storage
if (typeof window !== 'undefined') {
  sessions.set(loadSessions())
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

async function loadProviders() {
  try {
    const providerList = await getCouncilProviders()
    providers.set(providerList)
  } catch (e) {
    console.error('Failed to load council providers:', e)
  }
}

async function checkPodStatus() {
  try {
    const status = await getCouncilPodStatus()
    podStatus.set(status)
  } catch (e) {
    console.error('Failed to check pod status:', e)
    podStatus.set({ status: 'unavailable', pod_name: '', message: 'Failed to check status' })
  }
}

async function launchPod() {
  podLoading.set(true)
  try {
    const res = await launchCouncilPod()
    podStatus.set({ status: 'running', pod_name: res.pod_name })
  } catch (e) {
    console.error('Failed to launch pod:', e)
    error.set('Failed to launch council pod')
  } finally {
    podLoading.set(false)
  }
}

async function refreshPod() {
  podLoading.set(true)
  try {
    const res = await refreshCouncilPod()
    podStatus.set({ status: 'running', pod_name: res.pod_name })
  } catch (e) {
    console.error('Failed to refresh pod:', e)
    error.set('Failed to refresh council pod')
  } finally {
    podLoading.set(false)
  }
}

if (typeof window !== 'undefined') {
  loadProviders()
  checkPodStatus()
}

function setTier(newTier: CouncilTier) {
  tier.set(newTier)
  // Auto-select all providers in the new tier
  const allProviders = get(providers)
  const tierProviders = allProviders.filter(p => p.tier === newTier)
  const newSelected = new Set(tierProviders.map(p => p.id))
  selectedProviders.set(newSelected)
  // Default: all selected providers are chairmen
  chairmen.set(new Set(newSelected))
}

function toggleProvider(providerId: string) {
  selectedProviders.update(set => {
    const newSet = new Set(set)
    if (newSet.has(providerId)) {
      newSet.delete(providerId)
      // Also remove from chairmen if deselected
      chairmen.update(c => { const nc = new Set(c); nc.delete(providerId); return nc })
    } else {
      newSet.add(providerId)
      // Also add to chairmen by default
      chairmen.update(c => { const nc = new Set(c); nc.add(providerId); return nc })
    }
    return newSet
  })
}

function toggleChairman(providerId: string) {
  // Toggle chairman status for a selected provider
  chairmen.update(set => {
    const newSet = new Set(set)
    if (newSet.has(providerId)) {
      // Don't allow removing last chairman
      if (newSet.size > 1) {
        newSet.delete(providerId)
      }
    } else {
      // Must be a selected provider to be chairman
      if (get(selectedProviders).has(providerId)) {
        newSet.add(providerId)
      }
    }
    return newSet
  })
}

// Legacy: set single chairman (clears others)
function setChairman(providerId: string) {
  selectedProviders.update(set => {
    const newSet = new Set(set)
    newSet.add(providerId)
    return newSet
  })
  chairmen.set(new Set([providerId]))
}

function ask(questionText: string) {
  if (get(stage) !== 'idle' && get(stage) !== 'done' && get(stage) !== 'error') {
    return
  }

  const selected = get(selectedProviders)
  if (selected.size < 2) {
    error.set('Please select at least 2 providers')
    return
  }

  const selectedChairmen = get(chairmen)
  if (selectedChairmen.size === 0) {
    error.set('Please select at least 1 chairman')
    return
  }

  // Generate new session ID
  const sessionId = generateId()
  currentSessionId.set(sessionId)

  question.set(questionText)
  responses.set(new Map())
  peerReviews.set([])
  syntheses.set(new Map())
  error.set(null)
  result.set(null)
  activeProviders.set(new Set())
  activeSynthesizers.set(new Set())
  stage.set('deliberating')

  const providerIds = [...selected]
  const chairmenIds = [...selectedChairmen]

  closeStream = askCouncil(questionText, providerIds, chairmenIds, (event: CouncilEvent) => {
    handleEvent(event)
  })
}

function handleEvent(event: CouncilEvent) {
  switch (event.type) {
    case 'start':
    case 'heartbeat':
      // Ignore start and heartbeat events (heartbeat keeps connection alive)
      break
    case 'stage':
      if (event.stage === 'deliberation') stage.set('deliberating')
      else if (event.stage === 'peer_review') stage.set('reviewing')
      else if (event.stage === 'synthesis') stage.set('synthesizing')
      break
    case 'provider_start':
      activeProviders.update(set => { const s = new Set(set); s.add(event.provider_id); return s })
      break
    case 'provider_done':
      activeProviders.update(set => { const s = new Set(set); s.delete(event.provider_id); return s })
      break
    case 'provider_response':
      responses.update(map => {
        const m = new Map(map)
        m.set(event.provider_id, {
          provider: event.provider,
          provider_id: event.provider_id,
          model: event.model,
          response: event.response,
          error: event.error
        })
        return m
      })
      // Auto-save after each response
      saveCurrentSession()
      break
    case 'review_done':
      peerReviews.set(event.rankings)
      // Auto-save after peer review
      saveCurrentSession()
      break
    case 'synthesis_start':
      // Track which chairman is synthesizing
      if (event.chairman_id) {
        activeSynthesizers.update(set => { const s = new Set(set); s.add(event.chairman_id!); return s })
      }
      break
    case 'synthesis_content':
      // Update synthesis for specific chairman
      if (event.chairman_id) {
        syntheses.update(map => {
          const m = new Map(map)
          m.set(event.chairman_id!, {
            chairman_id: event.chairman_id!,
            chairman_name: event.chairman || event.chairman_id!,
            synthesis: event.content
          })
          return m
        })
        activeSynthesizers.update(set => { const s = new Set(set); s.delete(event.chairman_id!); return s })
        // Auto-save after each synthesis
        saveCurrentSession()
      }
      break
    case 'synthesis_error':
      // Handle synthesis failure for specific chairman
      if (event.chairman_id) {
        syntheses.update(map => {
          const m = new Map(map)
          m.set(event.chairman_id!, {
            chairman_id: event.chairman_id!,
            chairman_name: event.chairman || event.chairman_id!,
            synthesis: '',
            error: event.error || 'Synthesis failed'
          })
          return m
        })
        activeSynthesizers.update(set => { const s = new Set(set); s.delete(event.chairman_id!); return s })
        saveCurrentSession()
      }
      break
    case 'result':
      result.set(event.result)
      // Also populate syntheses from result if available
      if (event.result.syntheses) {
        syntheses.update(map => {
          const m = new Map(map)
          for (const syn of event.result.syntheses!) {
            m.set(syn.chairman_id, syn)
          }
          return m
        })
      }
      break
    case 'error':
      error.set(event.message)
      stage.set('error')
      break
    case 'done':
      stage.set('done')
      activeSynthesizers.set(new Set())
      // Save session to history
      saveCurrentSession()
      break
  }
}

function saveCurrentSession() {
  const sessionId = get(currentSessionId)
  const currentQuestion = get(question)
  const currentResponses = get(responses)
  const currentPeerReviews = get(peerReviews)
  const currentSyntheses = get(syntheses)
  const currentTier = get(tier)
  const currentProviders = get(selectedProviders)
  const currentChairmen = get(chairmen)
  const currentStage = get(stage)

  if (!sessionId || !currentQuestion || currentResponses.size === 0) return

  sessions.update(list => {
    const existing = list.findIndex(s => s.id === sessionId)
    const existingSession = existing >= 0 ? list[existing] : null

    const session: CouncilSession = {
      id: sessionId,
      question: currentQuestion,
      tier: currentTier,
      providerIds: [...currentProviders],
      chairmenIds: [...currentChairmen],
      responses: [...currentResponses.values()],
      peerReviews: currentPeerReviews,
      syntheses: [...currentSyntheses.values()],
      stage: currentStage,
      // Preserve original createdAt on updates
      createdAt: existingSession?.createdAt || new Date().toISOString()
    }

    if (existing >= 0) {
      list[existing] = session
    } else {
      list.push(session)
    }
    saveSessions(list)
    return [...list]
  })
}

function loadSession(session: CouncilSession) {
  stop()

  currentSessionId.set(session.id)
  question.set(session.question)
  tier.set(session.tier)
  selectedProviders.set(new Set(session.providerIds))
  chairmen.set(new Set(session.chairmenIds))

  // Convert arrays back to maps
  const respMap = new Map<string, CouncilProviderResponse>()
  for (const r of session.responses) {
    respMap.set(r.provider_id, r)
  }
  responses.set(respMap)

  peerReviews.set(session.peerReviews || [])

  const synthMap = new Map<string, ChairmanSynthesis>()
  for (const s of session.syntheses || []) {
    synthMap.set(s.chairman_id, s)
  }
  syntheses.set(synthMap)

  error.set(null)
  activeProviders.set(new Set())
  activeSynthesizers.set(new Set())
  // Restore saved stage, or 'done' for legacy sessions without stage
  stage.set(session.stage || 'done')
}

function deleteSession(id: string) {
  sessions.update(list => {
    const filtered = list.filter(s => s.id !== id)
    saveSessions(filtered)
    return filtered
  })

  // If deleting current session, reset
  if (get(currentSessionId) === id) {
    reset()
  }
}

function clearAllSessions() {
  sessions.set([])
  saveSessions([])
  reset()
}

function stop() {
  if (closeStream) {
    closeStream()
    closeStream = null
  }
  stage.set('idle')
}

function reset() {
  stop()
  currentSessionId.set(null)
  question.set('')
  responses.set(new Map())
  peerReviews.set([])
  syntheses.set(new Map())
  error.set(null)
  result.set(null)
  activeProviders.set(new Set())
  activeSynthesizers.set(new Set())
  stage.set('idle')
}

export const council = derived(
  [providers, tier, selectedProviders, chairmen, question, responses, peerReviews, syntheses, stage, error, activeProviders, activeSynthesizers, result, podStatus, podLoading, sessions, currentSessionId],
  ([$providers, $tier, $selectedProviders, $chairmen, $question, $responses, $peerReviews, $syntheses, $stage, $error, $activeProviders, $activeSynthesizers, $result, $podStatus, $podLoading, $sessions, $currentSessionId]) => ({
    providers: $providers,
    tier: $tier,
    tierProviders: $providers.filter(p => p.tier === $tier),
    selectedProviders: $selectedProviders,
    chairmen: $chairmen,
    question: $question,
    responses: $responses,
    peerReviews: $peerReviews,
    syntheses: $syntheses,
    // Legacy: first synthesis for backwards compat
    synthesis: $syntheses.size > 0 ? [...$syntheses.values()][0].synthesis : '',
    stage: $stage,
    error: $error,
    activeProviders: $activeProviders,
    activeSynthesizers: $activeSynthesizers,
    result: $result,
    podStatus: $podStatus,
    podLoading: $podLoading,
    sessions: $sessions,
    currentSessionId: $currentSessionId,
  })
)

export const councilActions = {
  loadProviders,
  checkPodStatus,
  launchPod,
  refreshPod,
  setTier,
  toggleProvider,
  toggleChairman,
  setChairman, // legacy
  ask,
  stop,
  reset,
  loadSession,
  deleteSession,
  clearAllSessions
}
