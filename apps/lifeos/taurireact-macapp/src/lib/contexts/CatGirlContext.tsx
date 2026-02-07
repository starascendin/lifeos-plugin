import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { useAuth } from "@clerk/clerk-react";

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

export interface CatGirlMessage {
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
 * Available models for the CatGirl agent
 * Must match CATGIRL_AGENT_MODELS in catgirl_agent.ts
 */
export const CATGIRL_MODELS = [
  { id: "google/gemini-3-flash", name: "Gemini 3 Flash", provider: "google", description: "Fast & capable" },
  { id: "openai/gpt-5", name: "GPT-5", provider: "openai", description: "Most capable" },
] as const;

export type CatGirlModelId = (typeof CATGIRL_MODELS)[number]["id"];

export const DEFAULT_CATGIRL_MODEL = CATGIRL_MODELS[0];

interface CatGirlState {
  threadId: string | null;
  messages: CatGirlMessage[];
  isLoading: boolean;
  error: string | null;
  selectedModelId: CatGirlModelId;
  cumulativeUsage: TokenUsage;
}

interface CatGirlContextValue extends CatGirlState {
  setSelectedModelId: (modelId: CatGirlModelId) => void;
  createThread: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
  resetUsage: () => void;
}

// Get Convex site URL for HTTP endpoints
const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_URL?.replace(".cloud", ".site") || "";

const defaultState: CatGirlState = {
  threadId: null,
  messages: [],
  isLoading: false,
  error: null,
  selectedModelId: DEFAULT_CATGIRL_MODEL.id,
  cumulativeUsage: {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  },
};

// ==================== CONTEXT ====================

const CatGirlContext = createContext<CatGirlContextValue | null>(null);

// ==================== PROVIDER ====================

interface CatGirlProviderProps {
  children: ReactNode;
}

export function CatGirlProvider({ children }: CatGirlProviderProps) {
  const [state, setState] = useState<CatGirlState>(defaultState);
  const { getToken, isSignedIn } = useAuth();

  // Auto-create thread on mount when signed in
  useEffect(() => {
    if (isSignedIn && !state.threadId && !state.isLoading) {
      createThreadInternal();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  // Helper to create thread
  const createThreadInternal = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const token = await getToken({ template: "convex" });
      if (!token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`${CONVEX_SITE_URL}/catgirl-agent/create-thread`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
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
  }, [getToken]);

  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // Set selected model
  const setSelectedModelId = useCallback((modelId: CatGirlModelId) => {
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

  // Create a new thread
  const createThread = useCallback(async () => {
    await createThreadInternal();
  }, [createThreadInternal]);

  // Send a message and get response
  const sendMessage = useCallback(
    async (message: string) => {
      if (!state.threadId) {
        setState((prev) => ({
          ...prev,
          error: "No active thread. Please wait for initialization.",
        }));
        return;
      }

      // Add user message immediately
      const userMessage: CatGirlMessage = {
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
        const token = await getToken({ template: "convex" });
        if (!token) {
          throw new Error("Not authenticated");
        }

        const response = await fetch(`${CONVEX_SITE_URL}/catgirl-agent/send-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
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
        const assistantMessage: CatGirlMessage = {
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
    [state.threadId, state.selectedModelId, getToken, generateMessageId]
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
    // Create a new thread
    createThreadInternal();
  }, [createThreadInternal]);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const contextValue: CatGirlContextValue = {
    ...state,
    setSelectedModelId,
    createThread,
    sendMessage,
    clearMessages,
    clearError,
    resetUsage,
  };

  return (
    <CatGirlContext.Provider value={contextValue}>
      {children}
    </CatGirlContext.Provider>
  );
}

// ==================== HOOK ====================

export function useCatGirl() {
  const context = useContext(CatGirlContext);
  if (!context) {
    throw new Error("useCatGirl must be used within a CatGirlProvider");
  }
  return context;
}
