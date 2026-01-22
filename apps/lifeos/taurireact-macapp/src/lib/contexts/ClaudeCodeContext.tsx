import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import {
  checkDockerAvailable,
  getContainerStatus,
  startContainer,
  stopContainer,
  createContainer,
  removeContainer,
  executePrompt,
  createSession,
  listSessions,
  deleteSession,
  type ContainerStatus,
  type ClaudeCodeResult,
  type Environment,
  type ConversationThread,
} from "@/lib/services/claudecode";

// Result entry with timestamp and prompt
export interface ClaudeCodeResultEntry {
  id: string;
  timestamp: Date;
  prompt: string;
  result: ClaudeCodeResult;
  environment: Environment;
  threadId: string; // Link to conversation thread
}

// Thread with local metadata
export interface ThreadWithMeta extends ConversationThread {
  messageCount: number;
}

interface ClaudeCodeContextValue {
  // State
  environment: Environment;
  containerStatus: ContainerStatus | null;
  isExecuting: boolean;
  results: ClaudeCodeResultEntry[];
  jsonDebugMode: boolean;
  error: string | null;
  isDockerAvailable: boolean | null;
  isCheckingDocker: boolean;
  isStartingContainer: boolean;
  isStoppingContainer: boolean;
  isCreatingContainer: boolean;
  isRemovingContainer: boolean;

  // Thread state
  activeThreadId: string | null;
  threads: ThreadWithMeta[];
  isLoadingThreads: boolean;

  // Actions
  setEnvironment: (env: Environment) => void;
  setJsonDebugMode: (enabled: boolean) => void;
  refreshContainerStatus: () => Promise<void>;
  startContainerAction: () => Promise<void>;
  stopContainerAction: () => Promise<void>;
  createContainerAction: (mcpConfigPath: string) => Promise<void>;
  removeContainerAction: () => Promise<void>;
  execute: (prompt: string) => Promise<ClaudeCodeResult>;
  clearResults: () => void;
  clearError: () => void;

  // Thread actions
  createThread: () => Promise<string | null>;
  switchThread: (threadId: string | null) => void;
  deleteThread: (threadId: string) => Promise<void>;
  refreshThreads: () => Promise<void>;
  getActiveThreadResults: () => ClaudeCodeResultEntry[];
}

const STORAGE_KEY = "claudecode-results";
const THREADS_STORAGE_KEY = "claudecode-threads";
const ACTIVE_THREAD_STORAGE_KEY = "claudecode-active-thread";
const MAX_STORED_RESULTS = 100;

const ClaudeCodeContext = createContext<ClaudeCodeContextValue | null>(null);

function loadStoredResults(): ClaudeCodeResultEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert timestamp strings back to Date objects
      return parsed.map((entry: ClaudeCodeResultEntry) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }));
    }
  } catch (error) {
    console.error("Failed to load stored results:", error);
  }
  return [];
}

function saveResults(results: ClaudeCodeResultEntry[]) {
  try {
    // Only store the most recent results
    const toStore = results.slice(-MAX_STORED_RESULTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.error("Failed to save results:", error);
  }
}

function loadStoredThreads(): ThreadWithMeta[] {
  try {
    const stored = localStorage.getItem(THREADS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((thread: ThreadWithMeta) => ({
        ...thread,
        createdAt: new Date(thread.createdAt),
        updatedAt: new Date(thread.updatedAt),
      }));
    }
  } catch (error) {
    console.error("Failed to load stored threads:", error);
  }
  return [];
}

function saveThreads(threads: ThreadWithMeta[]) {
  try {
    localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads));
  } catch (error) {
    console.error("Failed to save threads:", error);
  }
}

function loadActiveThread(env: Environment): string | null {
  try {
    const stored = localStorage.getItem(`${ACTIVE_THREAD_STORAGE_KEY}-${env}`);
    return stored || null;
  } catch {
    return null;
  }
}

function saveActiveThread(env: Environment, threadId: string | null) {
  try {
    if (threadId) {
      localStorage.setItem(`${ACTIVE_THREAD_STORAGE_KEY}-${env}`, threadId);
    } else {
      localStorage.removeItem(`${ACTIVE_THREAD_STORAGE_KEY}-${env}`);
    }
  } catch (error) {
    console.error("Failed to save active thread:", error);
  }
}

export function ClaudeCodeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // State
  const [environment, setEnvironmentState] = useState<Environment>("dev");
  const [containerStatus, setContainerStatus] =
    useState<ContainerStatus | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<ClaudeCodeResultEntry[]>(() =>
    loadStoredResults()
  );
  const [jsonDebugMode, setJsonDebugMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDockerAvailable, setIsDockerAvailable] = useState<boolean | null>(
    null
  );
  const [isCheckingDocker, setIsCheckingDocker] = useState(false);
  const [isStartingContainer, setIsStartingContainer] = useState(false);
  const [isStoppingContainer, setIsStoppingContainer] = useState(false);
  const [isCreatingContainer, setIsCreatingContainer] = useState(false);
  const [isRemovingContainer, setIsRemovingContainer] = useState(false);

  // Thread state
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadWithMeta[]>(() =>
    loadStoredThreads()
  );
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);

  // Load active thread when environment changes
  useEffect(() => {
    const savedThread = loadActiveThread(environment);
    setActiveThreadId(savedThread);
  }, [environment]);

  // Save results to localStorage whenever they change
  useEffect(() => {
    saveResults(results);
  }, [results]);

  // Save threads to localStorage whenever they change
  useEffect(() => {
    saveThreads(threads);
  }, [threads]);

  // Check Docker availability on mount
  useEffect(() => {
    async function checkDocker() {
      setIsCheckingDocker(true);
      try {
        const available = await checkDockerAvailable();
        setIsDockerAvailable(available);
      } catch (err) {
        setIsDockerAvailable(false);
        setError("Failed to check Docker availability");
      } finally {
        setIsCheckingDocker(false);
      }
    }
    checkDocker();
  }, []);

  // Refresh container status when environment changes or Docker becomes available
  useEffect(() => {
    if (isDockerAvailable) {
      refreshContainerStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment, isDockerAvailable]);

  const refreshContainerStatus = useCallback(async () => {
    try {
      const status = await getContainerStatus(environment);
      setContainerStatus(status);
      setError(null);
    } catch (err) {
      setError(`Failed to get container status: ${err}`);
    }
  }, [environment]);

  const refreshThreads = useCallback(async () => {
    if (!containerStatus?.running) return;

    setIsLoadingThreads(true);
    try {
      const remoteThreads = await listSessions(environment);

      // Merge with local metadata (message counts)
      setThreads((prevThreads) => {
        const localThreadMap = new Map(
          prevThreads
            .filter((t) => t.environment === environment)
            .map((t) => [t.id, t])
        );

        const merged = remoteThreads.map((remote) => {
          const local = localThreadMap.get(remote.id);
          return {
            ...remote,
            messageCount: local?.messageCount || 0,
          };
        });

        // Keep threads from other environments
        const otherEnvThreads = prevThreads.filter(
          (t) => t.environment !== environment
        );

        return [...otherEnvThreads, ...merged];
      });
    } catch (err) {
      console.error("Failed to refresh threads:", err);
    } finally {
      setIsLoadingThreads(false);
    }
  }, [environment, containerStatus?.running]);

  // Refresh threads when container starts running
  useEffect(() => {
    if (containerStatus?.running) {
      refreshThreads();
    }
  }, [containerStatus?.running, refreshThreads]);

  const setEnvironment = useCallback((env: Environment) => {
    setEnvironmentState(env);
  }, []);

  const startContainerAction = useCallback(async () => {
    setIsStartingContainer(true);
    setError(null);
    try {
      await startContainer(environment);
      await refreshContainerStatus();
    } catch (err) {
      setError(`Failed to start container: ${err}`);
    } finally {
      setIsStartingContainer(false);
    }
  }, [environment, refreshContainerStatus]);

  const stopContainerAction = useCallback(async () => {
    setIsStoppingContainer(true);
    setError(null);
    try {
      await stopContainer(environment);
      await refreshContainerStatus();
    } catch (err) {
      setError(`Failed to stop container: ${err}`);
    } finally {
      setIsStoppingContainer(false);
    }
  }, [environment, refreshContainerStatus]);

  const createContainerAction = useCallback(
    async (mcpConfigPath: string) => {
      setIsCreatingContainer(true);
      setError(null);
      try {
        await createContainer(environment, mcpConfigPath);
        await refreshContainerStatus();
      } catch (err) {
        setError(`Failed to create container: ${err}`);
      } finally {
        setIsCreatingContainer(false);
      }
    },
    [environment, refreshContainerStatus]
  );

  const removeContainerAction = useCallback(async () => {
    setIsRemovingContainer(true);
    setError(null);
    try {
      await removeContainer(environment);
      await refreshContainerStatus();
    } catch (err) {
      setError(`Failed to remove container: ${err}`);
    } finally {
      setIsRemovingContainer(false);
    }
  }, [environment, refreshContainerStatus]);

  const createThread = useCallback(async (): Promise<string | null> => {
    setError(null);
    try {
      const sessionId = await createSession(environment);
      if (sessionId) {
        const newThread: ThreadWithMeta = {
          id: sessionId,
          environment,
          title: "New Conversation",
          createdAt: new Date(),
          updatedAt: new Date(),
          messageCount: 1, // Initial message was sent
        };

        setThreads((prev) => [...prev, newThread]);
        setActiveThreadId(sessionId);
        saveActiveThread(environment, sessionId);

        return sessionId;
      }
      return null;
    } catch (err) {
      setError(`Failed to create thread: ${err}`);
      return null;
    }
  }, [environment]);

  const switchThread = useCallback(
    (threadId: string | null) => {
      setActiveThreadId(threadId);
      saveActiveThread(environment, threadId);
    },
    [environment]
  );

  const deleteThreadAction = useCallback(
    async (threadId: string) => {
      setError(null);
      try {
        const success = await deleteSession(environment, threadId);
        if (success) {
          setThreads((prev) => prev.filter((t) => t.id !== threadId));
          // Also remove results for this thread
          setResults((prev) => prev.filter((r) => r.threadId !== threadId));

          // If deleting active thread, clear it
          if (activeThreadId === threadId) {
            setActiveThreadId(null);
            saveActiveThread(environment, null);
          }
        }
      } catch (err) {
        setError(`Failed to delete thread: ${err}`);
      }
    },
    [environment, activeThreadId]
  );

  const execute = useCallback(
    async (prompt: string): Promise<ClaudeCodeResult> => {
      setIsExecuting(true);
      setError(null);

      let currentThreadId = activeThreadId;

      // Auto-create a thread if none is active
      if (!currentThreadId) {
        currentThreadId = await createThread();
        if (!currentThreadId) {
          setIsExecuting(false);
          return { success: false, error: "Failed to create conversation thread" };
        }
      }

      try {
        const result = await executePrompt(
          environment,
          prompt,
          jsonDebugMode,
          currentThreadId
        );

        const entry: ClaudeCodeResultEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          prompt,
          result,
          environment,
          threadId: currentThreadId,
        };

        setResults((prev) => [...prev, entry]);

        // Update thread title from first message if it's a new thread
        setThreads((prev) =>
          prev.map((t) => {
            if (t.id === currentThreadId) {
              const isFirstMessage = t.title === "New Conversation";
              return {
                ...t,
                title: isFirstMessage
                  ? prompt.slice(0, 50) + (prompt.length > 50 ? "..." : "")
                  : t.title,
                updatedAt: new Date(),
                messageCount: t.messageCount + 1,
              };
            }
            return t;
          })
        );

        if (!result.success && result.error) {
          setError(result.error);
        }

        return result;
      } catch (err) {
        const errorMessage = `Failed to execute prompt: ${err}`;
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsExecuting(false);
      }
    },
    [environment, jsonDebugMode, activeThreadId, createThread]
  );

  const clearResults = useCallback(() => {
    if (activeThreadId) {
      // Only clear results for active thread
      setResults((prev) => prev.filter((r) => r.threadId !== activeThreadId));
    } else {
      // Clear all results for current environment
      setResults((prev) => prev.filter((r) => r.environment !== environment));
    }
  }, [activeThreadId, environment]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getActiveThreadResults = useCallback(() => {
    if (!activeThreadId) {
      // Return results without threadId for backward compatibility
      return results.filter(
        (r) => r.environment === environment && !r.threadId
      );
    }
    return results.filter((r) => r.threadId === activeThreadId);
  }, [results, activeThreadId, environment]);

  const value: ClaudeCodeContextValue = {
    // State
    environment,
    containerStatus,
    isExecuting,
    results,
    jsonDebugMode,
    error,
    isDockerAvailable,
    isCheckingDocker,
    isStartingContainer,
    isStoppingContainer,
    isCreatingContainer,
    isRemovingContainer,

    // Thread state
    activeThreadId,
    threads,
    isLoadingThreads,

    // Actions
    setEnvironment,
    setJsonDebugMode,
    refreshContainerStatus,
    startContainerAction,
    stopContainerAction,
    createContainerAction,
    removeContainerAction,
    execute,
    clearResults,
    clearError,

    // Thread actions
    createThread,
    switchThread,
    deleteThread: deleteThreadAction,
    refreshThreads,
    getActiveThreadResults,
  };

  return (
    <ClaudeCodeContext.Provider value={value}>
      {children}
    </ClaudeCodeContext.Provider>
  );
}

export function useClaudeCode() {
  const context = useContext(ClaudeCodeContext);
  if (!context) {
    throw new Error("useClaudeCode must be used within a ClaudeCodeProvider");
  }
  return context;
}
