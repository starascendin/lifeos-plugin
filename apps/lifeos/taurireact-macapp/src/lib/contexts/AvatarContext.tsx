import React, { createContext, useContext, useMemo, useCallback, useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Doc } from "@holaai/convex";

// Types
export type LifeCategory = "health" | "work" | "social" | "learning" | "finance";
export type StatChangeSource = "manual" | "habit_completion" | "project_completion" | "daily_summary" | "system";

export interface AvatarStats {
  _id: string | null;
  userId: string;
  health: number;
  work: number;
  social: number;
  learning: number;
  finance: number;
  overallLevel: number;
  totalXP: number;
  lastUpdatedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface StatInfo {
  key: LifeCategory;
  label: string;
  icon: string;
  color: string;
  description: string;
}

// Stat metadata
export const STAT_INFO: Record<LifeCategory, StatInfo> = {
  health: {
    key: "health",
    label: "Health",
    icon: "Heart",
    color: "#ef4444", // red-500
    description: "Physical wellbeing, exercise, sleep",
  },
  work: {
    key: "work",
    label: "Work",
    icon: "Briefcase",
    color: "#3b82f6", // blue-500
    description: "Career, productivity, projects",
  },
  social: {
    key: "social",
    label: "Social",
    icon: "Users",
    color: "#a855f7", // purple-500
    description: "Relationships, community",
  },
  learning: {
    key: "learning",
    label: "Learning",
    icon: "GraduationCap",
    color: "#22c55e", // green-500
    description: "Skills, education, growth",
  },
  finance: {
    key: "finance",
    label: "Finance",
    icon: "Wallet",
    color: "#eab308", // yellow-500
    description: "Money, investments, stability",
  },
};

export const STAT_CATEGORIES: LifeCategory[] = ["health", "work", "social", "learning", "finance"];

interface AvatarContextValue {
  // Data
  stats: AvatarStats | undefined;
  history: Doc<"lifeos_avatarStatsHistory">[] | undefined;

  // Loading states
  isLoading: boolean;
  isLoadingHistory: boolean;

  // Previous stats for animation
  previousStats: AvatarStats | null;

  // Mutations
  updateStat: (stat: LifeCategory, value: number, note?: string) => Promise<void>;
  updateAllStats: (
    stats: Record<LifeCategory, number>,
    note?: string
  ) => Promise<void>;
  adjustStat: (stat: LifeCategory, delta: number, note?: string) => Promise<void>;
  initializeStats: () => Promise<void>;

  // Helpers
  getStatProgress: (stat: LifeCategory) => number;
  getOverallProgress: () => number;
  getStatColor: (stat: LifeCategory) => string;
}

const AvatarContext = createContext<AvatarContextValue | null>(null);

export function AvatarProvider({ children }: { children: React.ReactNode }) {
  // Track previous stats for animation
  const [previousStats, setPreviousStats] = useState<AvatarStats | null>(null);

  // Queries
  const stats = useQuery(api.lifeos.avatar_stats.getAvatarStats, {});
  const history = useQuery(api.lifeos.avatar_stats.getStatsHistory, { limit: 20 });

  // Update previous stats when stats change (for animations)
  useEffect(() => {
    if (stats && stats._id) {
      // Only update previous if we have real stats (not defaults)
      setPreviousStats((prev) => {
        if (!prev) return stats as AvatarStats;
        // Only update if values changed
        if (
          prev.health !== stats.health ||
          prev.work !== stats.work ||
          prev.social !== stats.social ||
          prev.learning !== stats.learning ||
          prev.finance !== stats.finance
        ) {
          return prev; // Return old for animation comparison
        }
        return stats as AvatarStats;
      });
    }
  }, [stats]);

  // After animation completes, sync previous with current
  useEffect(() => {
    if (stats) {
      const timer = setTimeout(() => {
        setPreviousStats(stats as AvatarStats);
      }, 500); // Animation duration
      return () => clearTimeout(timer);
    }
  }, [stats]);

  // Mutations
  const updateStatMutation = useMutation(api.lifeos.avatar_stats.updateStat);
  const updateAllStatsMutation = useMutation(api.lifeos.avatar_stats.updateAllStats);
  const adjustStatMutation = useMutation(api.lifeos.avatar_stats.adjustStat);
  const initializeStatsMutation = useMutation(api.lifeos.avatar_stats.initializeStats);

  // Mutation wrappers
  const updateStat = useCallback(
    async (stat: LifeCategory, value: number, note?: string) => {
      await updateStatMutation({ stat, value, source: "manual", note });
    },
    [updateStatMutation]
  );

  const updateAllStats = useCallback(
    async (newStats: Record<LifeCategory, number>, note?: string) => {
      await updateAllStatsMutation({
        health: newStats.health,
        work: newStats.work,
        social: newStats.social,
        learning: newStats.learning,
        finance: newStats.finance,
        source: "manual",
        note,
      });
    },
    [updateAllStatsMutation]
  );

  const adjustStat = useCallback(
    async (stat: LifeCategory, delta: number, note?: string) => {
      await adjustStatMutation({ stat, delta, source: "manual", note });
    },
    [adjustStatMutation]
  );

  const initializeStats = useCallback(async () => {
    await initializeStatsMutation({});
  }, [initializeStatsMutation]);

  // Helpers
  const getStatProgress = useCallback(
    (stat: LifeCategory): number => {
      if (!stats) return 50;
      return stats[stat];
    },
    [stats]
  );

  const getOverallProgress = useCallback((): number => {
    if (!stats) return 50;
    return (stats.health + stats.work + stats.social + stats.learning + stats.finance) / 5;
  }, [stats]);

  const getStatColor = useCallback((stat: LifeCategory): string => {
    return STAT_INFO[stat].color;
  }, []);

  const value: AvatarContextValue = useMemo(
    () => ({
      // Data
      stats: stats as AvatarStats | undefined,
      history,

      // Loading states
      isLoading: stats === undefined,
      isLoadingHistory: history === undefined,

      // Previous stats
      previousStats,

      // Mutations
      updateStat,
      updateAllStats,
      adjustStat,
      initializeStats,

      // Helpers
      getStatProgress,
      getOverallProgress,
      getStatColor,
    }),
    [
      stats,
      history,
      previousStats,
      updateStat,
      updateAllStats,
      adjustStat,
      initializeStats,
      getStatProgress,
      getOverallProgress,
      getStatColor,
    ]
  );

  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>;
}

export function useAvatar() {
  const context = useContext(AvatarContext);
  if (!context) {
    throw new Error("useAvatar must be used within an AvatarProvider");
  }
  return context;
}
