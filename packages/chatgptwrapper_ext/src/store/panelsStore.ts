import { create } from 'zustand';
import type { LLMType, Tier } from '../config/llm';
import { MODEL_TIERS, LLM_PROVIDERS } from '../config/llm';
import { generateUUID } from '../utils/uuid';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface PanelState {
  id: number;
  llmType: LLMType;
  model: string;
  conversationId: string | null;
  parentMessageId: string;
  claudeOrgUuid: string | null;
  geminiContextIds: string[];
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  status: string | null;
}

interface PanelsState {
  panels: PanelState[];
  addPanel: (llmType: LLMType, tier: Tier) => void;
  removeLastPanel: () => void;
  setPanelCount: (count: number, tier: Tier) => void;
  updatePanel: (id: number, updates: Partial<PanelState>) => void;
  clearPanel: (id: number) => void;
  addMessage: (panelId: number, message: Message) => void;
  updateLastMessage: (panelId: number, content: string) => void;
  removeLastMessage: (panelId: number) => void;
  setLLMType: (panelId: number, llmType: LLMType, tier: Tier) => void;
  setModelFromTier: (panelId: number, tier: Tier) => void;
  updateAllPanelsTier: (tier: Tier) => void;
  getNextProvider: () => LLMType;
}

function createPanel(id: number, llmType: LLMType, tier: Tier): PanelState {
  return {
    id,
    llmType,
    model: MODEL_TIERS[tier][llmType],
    conversationId: null,
    parentMessageId: generateUUID(),
    claudeOrgUuid: null,
    geminiContextIds: ['', '', ''],
    messages: [],
    isLoading: false,
    error: null,
    status: null
  };
}

export const usePanelsStore = create<PanelsState>((set, get) => ({
  panels: [],

  getNextProvider: () => {
    const usedProviders = new Set(get().panels.map(p => p.llmType));
    for (const provider of LLM_PROVIDERS) {
      if (!usedProviders.has(provider)) {
        return provider;
      }
    }
    return LLM_PROVIDERS[get().panels.length % LLM_PROVIDERS.length];
  },

  addPanel: (llmType, tier) =>
    set((state) => ({
      panels: [...state.panels, createPanel(state.panels.length, llmType, tier)]
    })),

  removeLastPanel: () =>
    set((state) => ({
      panels: state.panels.slice(0, -1)
    })),

  setPanelCount: (count, tier) =>
    set((state) => {
      const currentCount = state.panels.length;
      if (currentCount === count) return state;

      if (currentCount < count) {
        // Add panels
        const usedProviders = new Set(state.panels.map(p => p.llmType));
        const newPanels = [...state.panels];
        for (let i = currentCount; i < count; i++) {
          let provider: LLMType = LLM_PROVIDERS[0];
          for (const p of LLM_PROVIDERS) {
            if (!usedProviders.has(p)) {
              provider = p;
              usedProviders.add(p);
              break;
            }
          }
          if (usedProviders.size === LLM_PROVIDERS.length) {
            provider = LLM_PROVIDERS[i % LLM_PROVIDERS.length];
          }
          newPanels.push(createPanel(i, provider, tier));
        }
        return { panels: newPanels };
      } else {
        // Remove panels
        return { panels: state.panels.slice(0, count) };
      }
    }),

  updatePanel: (id, updates) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      )
    })),

  clearPanel: (id) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === id
          ? {
              ...p,
              conversationId: null,
              parentMessageId: generateUUID(),
              claudeOrgUuid: null,
              geminiContextIds: ['', '', ''],
              messages: [],
              error: null,
              status: null
            }
          : p
      )
    })),

  addMessage: (panelId, message) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === panelId ? { ...p, messages: [...p.messages, message] } : p
      )
    })),

  updateLastMessage: (panelId, content) =>
    set((state) => ({
      panels: state.panels.map((p) => {
        if (p.id !== panelId) return p;
        const messages = [...p.messages];
        if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
          messages[messages.length - 1] = { ...messages[messages.length - 1], content };
        }
        return { ...p, messages };
      })
    })),

  removeLastMessage: (panelId) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === panelId ? { ...p, messages: p.messages.slice(0, -1) } : p
      )
    })),

  setLLMType: (panelId, llmType, tier) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === panelId
          ? {
              ...p,
              llmType,
              model: MODEL_TIERS[tier][llmType],
              conversationId: null,
              parentMessageId: generateUUID(),
              claudeOrgUuid: null,
              geminiContextIds: ['', '', ''],
              messages: [],
              error: null,
              status: null
            }
          : p
      )
    })),

  setModelFromTier: (panelId, tier) =>
    set((state) => ({
      panels: state.panels.map((p) => {
        if (p.id !== panelId) return p;
        const newModel = MODEL_TIERS[tier][p.llmType];
        if (newModel === p.model) return p;
        return {
          ...p,
          model: newModel,
          conversationId: p.llmType === 'claude' ? null : p.conversationId
        };
      })
    })),

  updateAllPanelsTier: (tier) =>
    set((state) => ({
      panels: state.panels.map((p) => {
        const newModel = MODEL_TIERS[tier][p.llmType];
        if (newModel === p.model) return p;
        return {
          ...p,
          model: newModel,
          conversationId: p.llmType === 'claude' ? null : p.conversationId
        };
      })
    }))
}));
