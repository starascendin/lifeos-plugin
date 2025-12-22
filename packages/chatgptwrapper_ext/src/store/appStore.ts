import { create } from 'zustand';
import type { Tier } from '../config/llm';

export type TabType = 'chat' | 'council';

interface AuthStatus {
  chatgpt: boolean;
  claude: boolean;
  gemini: boolean;
}

interface AppState {
  currentTab: TabType;
  currentLayout: 1 | 2 | 3 | 4;
  currentTier: Tier;
  authStatus: AuthStatus;
  setTab: (tab: TabType) => void;
  setLayout: (layout: 1 | 2 | 3 | 4) => void;
  setTier: (tier: Tier) => void;
  setAuthStatus: (status: Partial<AuthStatus>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentTab: 'chat',
  currentLayout: 2,
  currentTier: 'normal',
  authStatus: { chatgpt: false, claude: false, gemini: false },

  setTab: (tab) => set({ currentTab: tab }),

  setLayout: (layout) => set({ currentLayout: layout }),

  setTier: (tier) => set({ currentTier: tier }),

  setAuthStatus: (status) =>
    set((state) => ({
      authStatus: { ...state.authStatus, ...status }
    }))
}));
