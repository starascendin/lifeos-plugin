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
  executePrompt,
  type ContainerStatus,
  type ClaudeCodeResult,
  type Environment,
} from "@/lib/services/claudecode";

// Result entry with timestamp and prompt
export interface ClaudeCodeResultEntry {
  id: string;
  timestamp: Date;
  prompt: string;
  result: ClaudeCodeResult;
  environment: Environment;
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

  // Actions
  setEnvironment: (env: Environment) => void;
  setJsonDebugMode: (enabled: boolean) => void;
  refreshContainerStatus: () => Promise<void>;
  startContainerAction: () => Promise<void>;
  stopContainerAction: () => Promise<void>;
  execute: (prompt: string) => Promise<ClaudeCodeResult>;
  clearResults: () => void;
  clearError: () => void;
}

const STORAGE_KEY = "claudecode-results";
const MAX_STORED_RESULTS = 50;

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

export function ClaudeCodeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // State
  const [environment, setEnvironment] = useState<Environment>("dev");
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

  // Save results to localStorage whenever they change
  useEffect(() => {
    saveResults(results);
  }, [results]);

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

  const execute = useCallback(
    async (prompt: string): Promise<ClaudeCodeResult> => {
      setIsExecuting(true);
      setError(null);

      try {
        const result = await executePrompt(environment, prompt, jsonDebugMode);

        const entry: ClaudeCodeResultEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          prompt,
          result,
          environment,
        };

        setResults((prev) => [...prev, entry]);

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
    [environment, jsonDebugMode]
  );

  const clearResults = useCallback(() => {
    setResults([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

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

    // Actions
    setEnvironment,
    setJsonDebugMode,
    refreshContainerStatus,
    startContainerAction,
    stopContainerAction,
    execute,
    clearResults,
    clearError,
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
