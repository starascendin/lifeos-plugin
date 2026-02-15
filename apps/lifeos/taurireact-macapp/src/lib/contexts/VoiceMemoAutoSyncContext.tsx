import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface AutoSyncStatus {
  lastRunAt: Date | null;
  lastRunResult: string | null;
  isRunning: boolean;
  nextRunAt: Date | null;
}

interface VoiceMemoAutoSyncContextType {
  status: AutoSyncStatus;
  updateStatus: (update: Partial<AutoSyncStatus>) => void;
}

const VoiceMemoAutoSyncContext = createContext<VoiceMemoAutoSyncContextType | null>(null);

const defaultStatus: AutoSyncStatus = {
  lastRunAt: null,
  lastRunResult: null,
  isRunning: false,
  nextRunAt: null,
};

export function VoiceMemoAutoSyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AutoSyncStatus>(defaultStatus);

  const updateStatus = useCallback((update: Partial<AutoSyncStatus>) => {
    setStatus((prev) => ({ ...prev, ...update }));
  }, []);

  return (
    <VoiceMemoAutoSyncContext.Provider value={{ status, updateStatus }}>
      {children}
    </VoiceMemoAutoSyncContext.Provider>
  );
}

export function useAutoSyncStatus() {
  const ctx = useContext(VoiceMemoAutoSyncContext);
  return ctx?.status ?? defaultStatus;
}

export function useAutoSyncUpdater() {
  const ctx = useContext(VoiceMemoAutoSyncContext);
  return ctx?.updateStatus;
}
