import React, { createContext, useContext, useState, useCallback } from "react";
import {
  getBeeperThreads,
  getBeeperConversation,
  searchBeeperMessages,
  checkBeeperDatabaseExists,
  type BeeperThread,
  type BeeperMessage,
} from "@/lib/services/beeper";

interface BeeperContextValue {
  // Data
  threads: BeeperThread[];
  selectedThread: BeeperThread | null;
  conversation: BeeperMessage[];
  searchResults: BeeperMessage[];

  // Loading states
  isLoadingThreads: boolean;
  isLoadingConversation: boolean;
  isSearching: boolean;
  hasDatabaseSynced: boolean | null;

  // Actions
  loadThreads: (search?: string) => Promise<void>;
  selectThread: (thread: BeeperThread | null) => Promise<void>;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;
  checkDatabase: () => Promise<void>;

  // Search state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const BeeperContext = createContext<BeeperContextValue | null>(null);

export function BeeperProvider({ children }: { children: React.ReactNode }) {
  // Data state
  const [threads, setThreads] = useState<BeeperThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<BeeperThread | null>(
    null
  );
  const [conversation, setConversation] = useState<BeeperMessage[]>([]);
  const [searchResults, setSearchResults] = useState<BeeperMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Loading states
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasDatabaseSynced, setHasDatabaseSynced] = useState<boolean | null>(
    null
  );

  // Check if database exists
  const checkDatabase = useCallback(async () => {
    const exists = await checkBeeperDatabaseExists();
    setHasDatabaseSynced(exists);
  }, []);

  // Load threads
  const loadThreads = useCallback(async (search?: string) => {
    setIsLoadingThreads(true);
    try {
      const threadList = await getBeeperThreads(search);
      setThreads(threadList);
    } catch (error) {
      console.error("Failed to load threads:", error);
      setThreads([]);
    } finally {
      setIsLoadingThreads(false);
    }
  }, []);

  // Select a thread and load its conversation
  const selectThread = useCallback(
    async (thread: BeeperThread | null) => {
      setSelectedThread(thread);

      if (!thread) {
        setConversation([]);
        return;
      }

      setIsLoadingConversation(true);
      try {
        const messages = await getBeeperConversation(thread.name);
        setConversation(messages);
      } catch (error) {
        console.error("Failed to load conversation:", error);
        setConversation([]);
      } finally {
        setIsLoadingConversation(false);
      }
    },
    []
  );

  // Search messages
  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchBeeperMessages(query);
      setSearchResults(results);
    } catch (error) {
      console.error("Failed to search messages:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  const value: BeeperContextValue = {
    // Data
    threads,
    selectedThread,
    conversation,
    searchResults,

    // Loading states
    isLoadingThreads,
    isLoadingConversation,
    isSearching,
    hasDatabaseSynced,

    // Actions
    loadThreads,
    selectThread,
    search,
    clearSearch,
    checkDatabase,

    // Search state
    searchQuery,
    setSearchQuery,
  };

  return (
    <BeeperContext.Provider value={value}>{children}</BeeperContext.Provider>
  );
}

export function useBeeper() {
  const context = useContext(BeeperContext);
  if (!context) {
    throw new Error("useBeeper must be used within a BeeperProvider");
  }
  return context;
}
