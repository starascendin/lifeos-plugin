import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

// ==================== TYPES ====================

export interface ToolCall {
  name: string;
  args: unknown;
}

export interface ToolResult {
  name: string;
  result: unknown;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIAgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  usage?: TokenUsage;
  modelUsed?: string;
  timestamp: Date;
}

// ==================== AVAILABLE MODELS ====================

/**
 * Available models for the demo agent
 * Must match DEMO_AGENT_MODELS in demo_agent.ts
 */
export const AI_AGENT_MODELS = [
  { id: "openai/gpt-5-nano", name: "GPT-5 Nano", provider: "openai", description: "Ultra-fast, cheapest" },
  { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", provider: "google", description: "Fast & affordable" },
  { id: "xai/grok-4.1-fast-reasoning", name: "Grok 4.1 Fast Reasoning", provider: "xai", description: "Fast with reasoning" },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini", provider: "openai", description: "Balanced speed & quality" },
  { id: "openai/gpt-5.1-codex-mini", name: "GPT-5.1 Codex Mini", provider: "openai", description: "Optimized for code" },
  { id: "google/gemini-3-flash", name: "Gemini 3 Flash", provider: "google", description: "Latest Google model" },
  { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5", provider: "anthropic", description: "Fast Anthropic model" },
] as const;

export type AIAgentModelId = (typeof AI_AGENT_MODELS)[number]["id"];

export const DEFAULT_AI_AGENT_MODEL = AI_AGENT_MODELS[0];

interface AIAgentState {
  threadId: string | null;
  messages: AIAgentMessage[];
  isLoading: boolean;
  error: string | null;
  apiKey: string;
  selectedModelId: AIAgentModelId;
  cumulativeUsage: TokenUsage;
}

interface AIAgentContextValue extends AIAgentState {
  setApiKey: (key: string) => void;
  setSelectedModelId: (modelId: AIAgentModelId) => void;
  createThread: (overrideApiKey?: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
  resetUsage: () => void;
}

// Get Convex site URL for HTTP endpoints
const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_URL?.replace(".cloud", ".site") || "";

// LocalStorage key for persisting API key
const API_KEY_STORAGE_KEY = "ai-agent-api-key";

/**
 * Get persisted API key from localStorage
 */
function getPersistedApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * Persist API key to localStorage
 */
function persistApiKey(key: string): void {
  try {
    if (key) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

const defaultState: AIAgentState = {
  threadId: null,
  messages: [],
  isLoading: false,
  error: null,
  apiKey: "",
  selectedModelId: DEFAULT_AI_AGENT_MODEL.id,
  cumulativeUsage: {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  },
};

// ==================== CONTEXT ====================

const AIAgentContext = createContext<AIAgentContextValue | null>(null);

// ==================== PROVIDER ====================

interface AIAgentProviderProps {
  children: ReactNode;
}

export function AIAgentProvider({ children }: AIAgentProviderProps) {
  const [state, setState] = useState<AIAgentState>(defaultState);

  // Load persisted API key on mount and auto-create thread
  useEffect(() => {
    const persistedKey = getPersistedApiKey();
    if (persistedKey) {
      setState((prev) => ({ ...prev, apiKey: persistedKey }));
      // Auto-create a thread with the persisted key
      createThreadWithKey(persistedKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to create thread (used by useEffect, doesn't depend on state.apiKey)
  const createThreadWithKey = useCallback(async (apiKey: string) => {
    if (!apiKey) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`${CONVEX_SITE_URL}/demo-agent/create-thread`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      setState((prev) => ({
        ...prev,
        threadId: result.threadId,
        messages: [],
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create thread";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, []);

  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // Set API key and persist to localStorage
  const setApiKey = useCallback((key: string) => {
    persistApiKey(key);
    setState((prev) => ({ ...prev, apiKey: key }));
  }, []);

  // Set selected model
  const setSelectedModelId = useCallback((modelId: AIAgentModelId) => {
    setState((prev) => ({ ...prev, selectedModelId: modelId }));
  }, []);

  // Reset cumulative usage
  const resetUsage = useCallback(() => {
    setState((prev) => ({
      ...prev,
      cumulativeUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    }));
  }, []);

  // Create a new thread via HTTP endpoint
  const createThread = useCallback(async (overrideApiKey?: string) => {
    const keyToUse = overrideApiKey || state.apiKey;

    if (!keyToUse) {
      setState((prev) => ({
        ...prev,
        error: "Please enter an API key first",
      }));
      return;
    }

    await createThreadWithKey(keyToUse);
  }, [state.apiKey, createThreadWithKey]);

  // Send a message and get response via HTTP endpoint
  const sendMessage = useCallback(
    async (message: string) => {
      if (!state.apiKey) {
        setState((prev) => ({
          ...prev,
          error: "Please enter an API key first",
        }));
        return;
      }

      if (!state.threadId) {
        setState((prev) => ({
          ...prev,
          error: "No active thread. Please create a new conversation first.",
        }));
        return;
      }

      // Add user message immediately
      const userMessage: AIAgentMessage = {
        id: generateMessageId(),
        role: "user",
        content: message,
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isLoading: true,
        error: null,
      }));

      try {
        const response = await fetch(`${CONVEX_SITE_URL}/demo-agent/send-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": state.apiKey,
          },
          body: JSON.stringify({
            threadId: state.threadId,
            message,
            modelId: state.selectedModelId,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || `HTTP ${response.status}`);
        }

        // Add assistant message with usage info
        const assistantMessage: AIAgentMessage = {
          id: generateMessageId(),
          role: "assistant",
          content: result.text,
          toolCalls: result.toolCalls,
          toolResults: result.toolResults,
          usage: result.usage,
          modelUsed: result.modelUsed,
          timestamp: new Date(),
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isLoading: false,
          // Update cumulative usage
          cumulativeUsage: result.usage
            ? {
                promptTokens: prev.cumulativeUsage.promptTokens + (result.usage.promptTokens || 0),
                completionTokens: prev.cumulativeUsage.completionTokens + (result.usage.completionTokens || 0),
                totalTokens: prev.cumulativeUsage.totalTokens + (result.usage.totalTokens || 0),
              }
            : prev.cumulativeUsage,
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to send message";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
      }
    },
    [state.apiKey, state.threadId, state.selectedModelId, generateMessageId]
  );

  // Clear all messages and reset thread (also resets usage)
  const clearMessages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      threadId: null,
      messages: [],
      error: null,
      cumulativeUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const contextValue: AIAgentContextValue = {
    ...state,
    setApiKey,
    setSelectedModelId,
    createThread,
    sendMessage,
    clearMessages,
    clearError,
    resetUsage,
  };

  return (
    <AIAgentContext.Provider value={contextValue}>
      {children}
    </AIAgentContext.Provider>
  );
}

// ==================== HOOK ====================

export function useAIAgent() {
  const context = useContext(AIAgentContext);
  if (!context) {
    throw new Error("useAIAgent must be used within an AIAgentProvider");
  }
  return context;
}
