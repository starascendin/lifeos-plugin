import {
  createContext,
  useContext,
  useState,
  useCallback,
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

export interface AIAgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: Date;
}

interface AIAgentState {
  threadId: string | null;
  messages: AIAgentMessage[];
  isLoading: boolean;
  error: string | null;
  apiKey: string;
}

interface AIAgentContextValue extends AIAgentState {
  setApiKey: (key: string) => void;
  createThread: (overrideApiKey?: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
}

// Get Convex site URL for HTTP endpoints
const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_URL?.replace(".cloud", ".site") || "";

const defaultState: AIAgentState = {
  threadId: null,
  messages: [],
  isLoading: false,
  error: null,
  apiKey: "",
};

// ==================== CONTEXT ====================

const AIAgentContext = createContext<AIAgentContextValue | null>(null);

// ==================== PROVIDER ====================

interface AIAgentProviderProps {
  children: ReactNode;
}

export function AIAgentProvider({ children }: AIAgentProviderProps) {
  const [state, setState] = useState<AIAgentState>(defaultState);

  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // Set API key
  const setApiKey = useCallback((key: string) => {
    setState((prev) => ({ ...prev, apiKey: key }));
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

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`${CONVEX_SITE_URL}/demo-agent/create-thread`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": keyToUse,
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
  }, [state.apiKey]);

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
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || `HTTP ${response.status}`);
        }

        // Add assistant message
        const assistantMessage: AIAgentMessage = {
          id: generateMessageId(),
          role: "assistant",
          content: result.text,
          toolCalls: result.toolCalls,
          toolResults: result.toolResults,
          timestamp: new Date(),
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isLoading: false,
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
    [state.apiKey, state.threadId, generateMessageId]
  );

  // Clear all messages and reset thread
  const clearMessages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      threadId: null,
      messages: [],
      error: null,
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const contextValue: AIAgentContextValue = {
    ...state,
    setApiKey,
    createThread,
    sendMessage,
    clearMessages,
    clearError,
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
