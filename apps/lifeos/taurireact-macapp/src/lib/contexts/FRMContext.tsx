import React, { createContext, useContext, useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Id, Doc } from "@holaai/convex";

// Types
export type RelationshipType =
  | "family"
  | "friend"
  | "colleague"
  | "acquaintance"
  | "mentor"
  | "other";

export type PersonWithProfile = Doc<"lifeos_frmPeople"> & {
  profile: Doc<"lifeos_frmProfiles"> | null;
};

interface FRMContextValue {
  // Active tab
  activeTab: "people" | "timeline";
  setActiveTab: (tab: "people" | "timeline") => void;

  // Selection
  selectedPersonId: Id<"lifeos_frmPeople"> | null;
  setSelectedPersonId: (id: Id<"lifeos_frmPeople"> | null) => void;

  // Data - People
  people: Doc<"lifeos_frmPeople">[] | undefined;
  selectedPerson: PersonWithProfile | null | undefined;
  isLoadingPeople: boolean;
  isLoadingPerson: boolean;

  // Mutations - People
  createPerson: ReturnType<typeof useMutation>;
  updatePerson: ReturnType<typeof useMutation>;
  archivePerson: ReturnType<typeof useMutation>;
  restorePerson: ReturnType<typeof useMutation>;
  deletePerson: ReturnType<typeof useMutation>;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: Doc<"lifeos_frmPeople">[] | undefined;
  isSearching: boolean;

  // Archive filter
  showArchived: boolean;
  setShowArchived: (show: boolean) => void;
}

const FRMContext = createContext<FRMContextValue | null>(null);

export function FRMProvider({ children }: { children: React.ReactNode }) {
  // Tab state
  const [activeTab, setActiveTab] = useState<"people" | "timeline">("people");

  // Selection state
  const [selectedPersonId, setSelectedPersonId] =
    useState<Id<"lifeos_frmPeople"> | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Archive filter state
  const [showArchived, setShowArchived] = useState(false);

  // Queries
  const people = useQuery(api.lifeos.frm_people.getPeople, {
    includeArchived: showArchived,
  });

  const selectedPerson = useQuery(
    api.lifeos.frm_people.getPerson,
    selectedPersonId ? { personId: selectedPersonId } : "skip"
  );

  const searchResults = useQuery(
    api.lifeos.frm_people.searchPeople,
    searchQuery.trim().length > 0
      ? { searchQuery: searchQuery.trim(), limit: 20 }
      : "skip"
  );

  // Mutations
  const createPerson = useMutation(api.lifeos.frm_people.createPerson);
  const updatePerson = useMutation(api.lifeos.frm_people.updatePerson);
  const archivePerson = useMutation(api.lifeos.frm_people.archivePerson);
  const restorePerson = useMutation(api.lifeos.frm_people.restorePerson);
  const deletePerson = useMutation(api.lifeos.frm_people.deletePerson);

  // Loading states
  const isLoadingPeople = people === undefined;
  const isLoadingPerson = selectedPersonId !== null && selectedPerson === undefined;
  const isSearching = searchQuery.trim().length > 0 && searchResults === undefined;

  // Callbacks
  const handleSetSelectedPersonId = useCallback(
    (id: Id<"lifeos_frmPeople"> | null) => {
      setSelectedPersonId(id);
    },
    []
  );

  const handleSetActiveTab = useCallback((tab: "people" | "timeline") => {
    setActiveTab(tab);
  }, []);

  const handleSetSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleSetShowArchived = useCallback((show: boolean) => {
    setShowArchived(show);
  }, []);

  const value: FRMContextValue = {
    // Tab
    activeTab,
    setActiveTab: handleSetActiveTab,

    // Selection
    selectedPersonId,
    setSelectedPersonId: handleSetSelectedPersonId,

    // Data
    people,
    selectedPerson,
    isLoadingPeople,
    isLoadingPerson,

    // Mutations
    createPerson,
    updatePerson,
    archivePerson,
    restorePerson,
    deletePerson,

    // Search
    searchQuery,
    setSearchQuery: handleSetSearchQuery,
    searchResults,
    isSearching,

    // Archive filter
    showArchived,
    setShowArchived: handleSetShowArchived,
  };

  return <FRMContext.Provider value={value}>{children}</FRMContext.Provider>;
}

export function useFRM() {
  const context = useContext(FRMContext);
  if (!context) {
    throw new Error("useFRM must be used within a FRMProvider");
  }
  return context;
}
