import React, { createContext, useContext, useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Doc, Id } from "@holaai/convex";

// Note: These API paths will be available after running `convex codegen`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initiativesApi = (api as any).lifeos.initiatives;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initiativesRollupApi = (api as any).lifeos.initiatives_rollup;

// Types for initiatives with stats
export interface InitiativeWithStats extends Doc<"lifeos_yearlyInitiatives"> {
  projectCount: number;
  habitCount: number;
  taskCount: number;
  completedTaskCount: number;
  calculatedProgress: number;
}

interface InitiativesContextValue {
  // Year selection
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  availableYears: number[] | undefined;

  // Initiatives data
  initiatives: InitiativeWithStats[] | undefined;
  isLoading: boolean;

  // Selected initiative for detail view
  selectedInitiativeId: Id<"lifeos_yearlyInitiatives"> | null;
  setSelectedInitiativeId: (id: Id<"lifeos_yearlyInitiatives"> | null) => void;

  // Dialog states
  isCreateDialogOpen: boolean;
  setIsCreateDialogOpen: (open: boolean) => void;
  editingInitiative: Doc<"lifeos_yearlyInitiatives"> | null;
  setEditingInitiative: (
    initiative: Doc<"lifeos_yearlyInitiatives"> | null,
  ) => void;

  // Mutations
  createInitiative: ReturnType<typeof useMutation>;
  updateInitiative: ReturnType<typeof useMutation>;
  archiveInitiative: ReturnType<typeof useMutation>;
  deleteInitiative: ReturnType<typeof useMutation>;
  reorderInitiatives: ReturnType<typeof useMutation>;
}

const InitiativesContext = createContext<InitiativesContextValue | null>(null);

export function InitiativesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Current year as default
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedInitiativeId, setSelectedInitiativeId] =
    useState<Id<"lifeos_yearlyInitiatives"> | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingInitiative, setEditingInitiative] =
    useState<Doc<"lifeos_yearlyInitiatives"> | null>(null);

  // Queries
  const initiatives = useQuery(initiativesApi.getInitiativesWithStats, {
    year: selectedYear,
  });

  const availableYears = useQuery(initiativesApi.getInitiativeYears, {});

  // Mutations
  const createInitiative = useMutation(initiativesApi.createInitiative);
  const updateInitiative = useMutation(initiativesApi.updateInitiative);
  const archiveInitiative = useMutation(initiativesApi.archiveInitiative);
  const deleteInitiative = useMutation(initiativesApi.deleteInitiative);
  const reorderInitiatives = useMutation(initiativesApi.reorderInitiatives);

  // Ensure current year is always available
  const yearsWithCurrent = useMemo(() => {
    if (!availableYears) return [currentYear];
    const years = new Set([...availableYears, currentYear]);
    return Array.from(years).sort((a, b) => b - a);
  }, [availableYears, currentYear]);

  const value: InitiativesContextValue = {
    // Year selection
    selectedYear,
    setSelectedYear,
    availableYears: yearsWithCurrent,

    // Initiatives data
    initiatives,
    isLoading: initiatives === undefined,

    // Selected initiative
    selectedInitiativeId,
    setSelectedInitiativeId,

    // Dialog states
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    editingInitiative,
    setEditingInitiative,

    // Mutations
    createInitiative,
    updateInitiative,
    archiveInitiative,
    deleteInitiative,
    reorderInitiatives,
  };

  return (
    <InitiativesContext.Provider value={value}>
      {children}
    </InitiativesContext.Provider>
  );
}

export function useInitiatives() {
  const context = useContext(InitiativesContext);
  if (!context) {
    throw new Error(
      "useInitiatives must be used within an InitiativesProvider",
    );
  }
  return context;
}

// Category metadata for display
export const INITIATIVE_CATEGORIES = {
  career: {
    label: "Career",
    icon: "Briefcase",
    color: "#6366f1",
  },
  health: {
    label: "Health",
    icon: "Heart",
    color: "#ef4444",
  },
  learning: {
    label: "Learning",
    icon: "BookOpen",
    color: "#f59e0b",
  },
  relationships: {
    label: "Relationships",
    icon: "Users",
    color: "#ec4899",
  },
  finance: {
    label: "Finance",
    icon: "DollarSign",
    color: "#22c55e",
  },
  personal: {
    label: "Personal",
    icon: "Sparkles",
    color: "#8b5cf6",
  },
} as const;

export type InitiativeCategory = keyof typeof INITIATIVE_CATEGORIES;
