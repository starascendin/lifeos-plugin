import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Id, Doc } from "@holaai/convex";
import { invoke } from "@tauri-apps/api/core";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

// ==================== TYPES ====================

export type PomodoroStatus = "idle" | "active" | "paused" | "break";

export interface PomodoroState {
  status: PomodoroStatus;
  sessionId: Id<"lifeos_pmPomodoroSessions"> | null;
  issueId: Id<"lifeos_pmIssues"> | null;
  issue: Doc<"lifeos_pmIssues"> | null;
  project: Doc<"lifeos_pmProjects"> | null;
  // Timer state (calculated client-side)
  remainingMs: number;
  totalDurationMs: number;
  // Break timer
  breakRemainingMs: number;
  // Settings
  durationMinutes: number;
  breakMinutes: number;
}

interface PomodoroContextValue {
  state: PomodoroState;

  // Actions
  startPomodoro: (issueId?: Id<"lifeos_pmIssues">) => Promise<void>;
  pausePomodoro: () => Promise<void>;
  resumePomodoro: () => Promise<void>;
  abandonPomodoro: () => Promise<void>;
  skipBreak: () => void;

  // Settings
  setDuration: (minutes: number) => void;
  setBreakDuration: (minutes: number) => void;

  // Stats
  todayStats: Doc<"lifeos_pmPomodoroDailyStats"> | null | undefined;

  // Loading
  isLoading: boolean;
}

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

// ==================== PROVIDER ====================

export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  // Convex queries
  const activePomodoroData = useQuery(
    api.lifeos.pm_pomodoro.getActivePomodoroWithIssue,
    {}
  );
  const todayStats = useQuery(api.lifeos.pm_pomodoro.getTodayStats, {});

  // Debug logging - on mount
  useEffect(() => {
    console.log("[PomodoroContext] Provider mounted");
  }, []);

  // Debug logging - on data change
  useEffect(() => {
    console.log("[PomodoroContext] Query data changed:", {
      activePomodoroData,
      todayStats,
      isLoading: activePomodoroData === undefined,
    });
  }, [activePomodoroData, todayStats]);


  // Convex mutations
  const startPomodoroMutation = useMutation(
    api.lifeos.pm_pomodoro.startPomodoro
  );
  const pausePomodoroMutation = useMutation(
    api.lifeos.pm_pomodoro.pausePomodoro
  );
  const resumePomodoroMutation = useMutation(
    api.lifeos.pm_pomodoro.resumePomodoro
  );
  const completePomodoroMutation = useMutation(
    api.lifeos.pm_pomodoro.completePomodoro
  );
  const abandonPomodoroMutation = useMutation(
    api.lifeos.pm_pomodoro.abandonPomodoro
  );

  // Local state
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [remainingMs, setRemainingMs] = useState(0);
  const [breakRemainingMs, setBreakRemainingMs] = useState(0);
  const [isInBreak, setIsInBreak] = useState(false);

  // Timer interval ref
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completingRef = useRef(false);

  // Extract session data
  const session = activePomodoroData?.session;
  const issue = activePomodoroData?.issue ?? null;
  const project = activePomodoroData?.project ?? null;

  // Calculate remaining time based on server state
  const calculateRemainingMs = useCallback(() => {
    if (!session) return 0;

    const totalDurationMs = session.durationMinutes * 60 * 1000;
    const now = Date.now();

    if (session.status === "active") {
      const elapsedMs = now - session.startedAt - session.totalPausedMs;
      return Math.max(0, totalDurationMs - elapsedMs);
    } else if (session.status === "paused" && session.pausedAt) {
      const elapsedMs =
        session.pausedAt - session.startedAt - session.totalPausedMs;
      return Math.max(0, totalDurationMs - elapsedMs);
    }

    return 0;
  }, [session]);

  // Handle timer completion
  const handleTimerComplete = useCallback(async () => {
    if (!session || completingRef.current) return;
    completingRef.current = true;

    try {
      // Complete the pomodoro
      await completePomodoroMutation({ sessionId: session._id });

      // Show notification
      showNotification("Pomodoro Complete!", "Time for a break.");

      // Start break timer
      setIsInBreak(true);
      setBreakRemainingMs(session.breakMinutes * 60 * 1000);
    } catch (error) {
      console.error("Failed to complete pomodoro:", error);
    } finally {
      completingRef.current = false;
    }
  }, [session, completePomodoroMutation]);

  // Handle break completion
  const handleBreakComplete = useCallback(() => {
    showNotification("Break Over!", "Ready for another pomodoro?");
    setIsInBreak(false);
    setBreakRemainingMs(0);
  }, []);

  // Timer tick effect
  useEffect(() => {
    // Clear existing interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isInBreak) {
      // Break timer
      timerRef.current = setInterval(() => {
        setBreakRemainingMs((prev) => {
          const next = prev - 1000;
          if (next <= 0) {
            handleBreakComplete();
            return 0;
          }
          return next;
        });
      }, 1000);
    } else if (session?.status === "active") {
      // Work timer
      setRemainingMs(calculateRemainingMs());

      timerRef.current = setInterval(() => {
        const remaining = calculateRemainingMs();
        setRemainingMs(remaining);

        if (remaining <= 0) {
          handleTimerComplete();
        }
      }, 1000);
    } else if (session?.status === "paused") {
      setRemainingMs(calculateRemainingMs());
    } else {
      setRemainingMs(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [
    session?.status,
    session?.startedAt,
    session?.pausedAt,
    session?.totalPausedMs,
    isInBreak,
    calculateRemainingMs,
    handleTimerComplete,
    handleBreakComplete,
  ]);

  // Sync pomodoro timer to macOS menu bar tray
  useEffect(() => {
    if (!isTauri) return;

    const syncTray = async () => {
      try {
        if (isInBreak && breakRemainingMs > 0) {
          // Break mode: show coffee indicator
          const time = formatTime(breakRemainingMs);
          await invoke("set_tray_title", { title: `☕ ${time}` });
        } else if (session?.status === "active" && remainingMs > 0) {
          // Work mode: show tomato indicator
          const time = formatTime(remainingMs);
          await invoke("set_tray_title", { title: `🍅 ${time}` });
        } else if (session?.status === "paused" && remainingMs > 0) {
          // Paused: show pause indicator
          const time = formatTime(remainingMs);
          await invoke("set_tray_title", { title: `⏸ ${time}` });
        } else {
          // Idle: clear tray title
          await invoke("clear_tray_title");
        }
      } catch (error) {
        console.error("[PomodoroContext] Failed to update tray:", error);
      }
    };

    syncTray();
  }, [remainingMs, breakRemainingMs, isInBreak, session?.status]);

  // Actions
  const startPomodoro = useCallback(
    async (issueId?: Id<"lifeos_pmIssues">) => {
      console.log("[PomodoroContext] Starting pomodoro", { issueId, durationMinutes, breakMinutes });
      try {
        const sessionId = await startPomodoroMutation({
          issueId,
          durationMinutes,
          breakMinutes,
        });
        console.log("[PomodoroContext] Pomodoro started, sessionId:", sessionId);
      } catch (error) {
        console.error("[PomodoroContext] Failed to start pomodoro:", error);
        throw error;
      }
    },
    [startPomodoroMutation, durationMinutes, breakMinutes]
  );

  const pausePomodoro = useCallback(async () => {
    if (session) {
      await pausePomodoroMutation({ sessionId: session._id });
    }
  }, [session, pausePomodoroMutation]);

  const resumePomodoro = useCallback(async () => {
    if (session) {
      await resumePomodoroMutation({ sessionId: session._id });
    }
  }, [session, resumePomodoroMutation]);

  const abandonPomodoro = useCallback(async () => {
    if (session) {
      await abandonPomodoroMutation({ sessionId: session._id });
      setIsInBreak(false);
      setBreakRemainingMs(0);
    }
  }, [session, abandonPomodoroMutation]);

  const skipBreak = useCallback(() => {
    setIsInBreak(false);
    setBreakRemainingMs(0);
  }, []);

  // Determine overall status
  let status: PomodoroStatus = "idle";
  if (isInBreak) {
    status = "break";
  } else if (session?.status === "active") {
    status = "active";
  } else if (session?.status === "paused") {
    status = "paused";
  }

  // Safe defaults for state
  const sessionDurationMinutes = session?.durationMinutes ?? durationMinutes;
  const sessionBreakMinutes = session?.breakMinutes ?? breakMinutes;

  const state = useMemo<PomodoroState>(
    () => ({
      status,
      sessionId: session?._id ?? null,
      issueId: session?.issueId ?? null,
      issue: issue ?? null,
      project: project ?? null,
      remainingMs: remainingMs ?? 0,
      totalDurationMs: sessionDurationMinutes * 60 * 1000,
      breakRemainingMs: breakRemainingMs ?? 0,
      durationMinutes: sessionDurationMinutes,
      breakMinutes: sessionBreakMinutes,
    }),
    [
      status,
      session?._id,
      session?.issueId,
      issue,
      project,
      remainingMs,
      breakRemainingMs,
      sessionDurationMinutes,
      sessionBreakMinutes,
    ]
  );

  const value = useMemo<PomodoroContextValue>(
    () => ({
      state,
      startPomodoro,
      pausePomodoro,
      resumePomodoro,
      abandonPomodoro,
      skipBreak,
      setDuration: setDurationMinutes,
      setBreakDuration: setBreakMinutes,
      todayStats,
      isLoading: activePomodoroData === undefined,
    }),
    [
      state,
      startPomodoro,
      pausePomodoro,
      resumePomodoro,
      abandonPomodoro,
      skipBreak,
      todayStats,
      activePomodoroData,
    ]
  );

  return (
    <PomodoroContext.Provider value={value}>
      {children}
    </PomodoroContext.Provider>
  );
}

// ==================== HOOK ====================

export function usePomodoro(): PomodoroContextValue {
  const context = useContext(PomodoroContext);
  if (!context) {
    // Return a safe default when context is not available
    // This can happen during initial render or when not wrapped in provider
    return {
      state: {
        status: "idle",
        sessionId: null,
        issueId: null,
        issue: null,
        project: null,
        remainingMs: 0,
        totalDurationMs: 25 * 60 * 1000,
        breakRemainingMs: 0,
        durationMinutes: 25,
        breakMinutes: 5,
      },
      startPomodoro: async () => {},
      pausePomodoro: async () => {},
      resumePomodoro: async () => {},
      abandonPomodoro: async () => {},
      skipBreak: () => {},
      setDuration: () => {},
      setBreakDuration: () => {},
      todayStats: null,
      isLoading: true,
    };
  }
  return context;
}

// ==================== UTILITIES ====================

/**
 * Format milliseconds as MM:SS
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Format milliseconds as human-readable duration
 */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Show notification (platform-specific)
 */
async function showNotification(title: string, body: string) {
  // For now, use Web Notification API which works in both web and Tauri
  // Tauri notification plugin can be added later if needed
  showWebNotification(title, body);
}

function showWebNotification(title: string, body: string) {
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(title, { body });
        }
      });
    }
  }
}
