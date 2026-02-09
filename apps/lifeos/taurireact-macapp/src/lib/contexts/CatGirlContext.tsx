import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@holaai/convex";

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

export interface CatGirlThread {
  _id: string;
  title?: string;
  _creationTime: number;
  status: string;
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
  isThreadListOpen: boolean;
}

interface CatGirlContextValue extends CatGirlState {
  threads: CatGirlThread[];
  setSelectedModelId: (modelId: CatGirlModelId) => void;
  createThread: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
  resetUsage: () => void;
  loadThread: (threadId: string) => void;
  deleteThread: (threadId: string) => Promise<void>;
  setThreadListOpen: (open: boolean) => void;
}

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
  isThreadListOpen: false,
};

// ==================== CONTEXT ====================

const CatGirlContext = createContext<CatGirlContextValue | null>(null);

// ==================== PROVIDER ====================

interface CatGirlProviderProps {
  children: ReactNode;
}

export function CatGirlProvider({ children }: CatGirlProviderProps) {
  const [state, setState] = useState<CatGirlState>(defaultState);

  // Convex hooks
  const createThreadAction = useAction(api.lifeos.catgirl_agent.createThread);
  const sendMessageAction = useAction(api.lifeos.catgirl_agent.sendMessage);
  const deleteThreadAction = useAction(api.lifeos.catgirl_agent.deleteThread);

  // Reactive thread list
  const threadsData = useQuery(api.lifeos.catgirl_agent.listThreads, {});

  // Reactive messages for current thread
  const threadMessages = useQuery(
    api.lifeos.catgirl_agent.getThreadMessages,
    state.threadId ? { threadId: state.threadId } : "skip"
  );

  const threads: CatGirlThread[] = useMemo(() => {
    if (!threadsData) return [];
    return threadsData as unknown as CatGirlThread[];
  }, [threadsData]);

  // Auto-create thread on mount
  useEffect(() => {
    if (!state.threadId && !state.isLoading && threadsData !== undefined) {
      createThreadInternal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadsData]);

  // Helper to create thread
  const createThreadInternal = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await createThreadAction({});

      setState((prev) => ({
        ...prev,
        threadId: result.threadId,
        messages: [],
        isLoading: false,
        cumulativeUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create thread";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [createThreadAction]);

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

      // Add user message immediately (optimistic)
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
        const result = await sendMessageAction({
          threadId: state.threadId,
          message,
          modelId: state.selectedModelId,
        });

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
    [state.threadId, state.selectedModelId, sendMessageAction, generateMessageId]
  );

  // Load an existing thread
  const loadThread = useCallback((threadId: string) => {
    setState((prev) => ({
      ...prev,
      threadId,
      messages: [],
      error: null,
      isThreadListOpen: false,
      cumulativeUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    }));
  }, []);

  // When threadMessages changes (reactive query), sync to local state for loaded threads
  useEffect(() => {
    if (threadMessages && state.threadId && !state.isLoading) {
      // Only sync from server if we don't have optimistic messages (no pending send)
      const serverMessages: CatGirlMessage[] = threadMessages
        .filter((m): m is NonNullable<typeof m> => m !== null)
        .map((m) => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          id: (m as any).id ?? `server_${(m as any).createdAt}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          role: (m as any).role as "user" | "assistant",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: (m as any).content ?? "",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          toolCalls: (m as any).toolCalls,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          toolResults: (m as any).toolResults,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          timestamp: new Date((m as any).createdAt),
        }));

      setState((prev) => {
        // Don't overwrite optimistic messages during a send
        if (prev.isLoading) return prev;
        // Only update if the server has more messages (avoids flicker)
        if (serverMessages.length >= prev.messages.length) {
          return { ...prev, messages: serverMessages };
        }
        return prev;
      });
    }
  }, [threadMessages, state.threadId, state.isLoading]);

  // Delete a thread
  const deleteThread = useCallback(
    async (threadId: string) => {
      try {
        await deleteThreadAction({ threadId });
        // If we deleted the current thread, create a new one
        if (state.threadId === threadId) {
          await createThreadInternal();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete thread";
        setState((prev) => ({ ...prev, error: errorMessage }));
      }
    },
    [deleteThreadAction, state.threadId, createThreadInternal]
  );

  // Toggle thread list
  const setThreadListOpen = useCallback((open: boolean) => {
    setState((prev) => ({ ...prev, isThreadListOpen: open }));
  }, []);

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
    createThreadInternal();
  }, [createThreadInternal]);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const contextValue: CatGirlContextValue = {
    ...state,
    threads,
    setSelectedModelId,
    createThread,
    sendMessage,
    clearMessages,
    clearError,
    resetUsage,
    loadThread,
    deleteThread,
    setThreadListOpen,
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
