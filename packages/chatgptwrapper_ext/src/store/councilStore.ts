import { create } from 'zustand';
import type { LLMType } from '../config/llm';
import { generateUUID } from '../utils/uuid';

export interface Stage1Result {
  model: string;
  llmType: LLMType;
  response: string;
}

export interface CriterionScore {
  criterion: string;
  score: number;
  assessment: string;
}

export interface ResponseEvaluation {
  responseLabel: string;
  scores: CriterionScore[];
  totalScore: number;
  strengths: string[];
  weaknesses: string[];
  pointsDocked: string[];
}

export interface Stage2Result {
  model: string;
  llmType: LLMType;
  ranking: string;
  parsedRanking: string[];
  evaluations: ResponseEvaluation[];
}

export interface Stage3Result {
  model: string;
  llmType: LLMType;
  response: string;
}

export interface AggregateRanking {
  model: string;
  llmType: LLMType;
  averageRank: number;
  rankingsCount: number;
}

export interface CouncilMessage {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  stage1?: Stage1Result[];
  stage2?: Stage2Result[];
  stage3?: Stage3Result[];
  metadata?: {
    labelToModel: Record<string, { model: string; llmType: LLMType }>;
    aggregateRankings: AggregateRanking[];
  };
  loading?: {
    stage1?: boolean;
    stage2?: boolean;
    stage3?: boolean;
  };
  error?: string;
}

interface CouncilState {
  messages: CouncilMessage[];
  isLoading: boolean;
  selectedLLMs: LLMType[];
  addUserMessage: (content: string) => string;
  addAssistantMessage: () => string;
  updateMessage: (id: string, updates: Partial<CouncilMessage>) => void;
  clearMessages: () => void;
  setIsLoading: (isLoading: boolean) => void;
  setMessages: (messages: CouncilMessage[]) => void;
  setSelectedLLMs: (llms: LLMType[]) => void;
  toggleLLM: (llm: LLMType) => void;
}

export const useCouncilStore = create<CouncilState>((set) => ({
  messages: [],
  isLoading: false,
  selectedLLMs: ['chatgpt', 'claude', 'gemini'] as LLMType[],

  addUserMessage: (content) => {
    const id = generateUUID();
    set((state) => ({
      messages: [...state.messages, { id, role: 'user', content }]
    }));
    return id;
  },

  addAssistantMessage: () => {
    const id = generateUUID();
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id,
          role: 'assistant',
          loading: { stage1: true, stage2: false, stage3: false }
        }
      ]
    }));
    return id;
  },

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      )
    })),

  clearMessages: () => set({ messages: [] }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setMessages: (messages) => set({ messages }),

  setSelectedLLMs: (llms) => set({ selectedLLMs: llms }),

  toggleLLM: (llm) =>
    set((state) => {
      const isSelected = state.selectedLLMs.includes(llm);
      if (isSelected) {
        // Don't allow deselecting if only 2 LLMs remain (min required for council)
        if (state.selectedLLMs.length <= 2) {
          return state;
        }
        return { selectedLLMs: state.selectedLLMs.filter((l) => l !== llm) };
      } else {
        return { selectedLLMs: [...state.selectedLLMs, llm] };
      }
    })
}));
