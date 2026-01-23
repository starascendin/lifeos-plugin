import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  getBeeperThreads,
  getBeeperConversationById,
  searchBeeperMessages,
  checkBeeperDatabaseExists,
  getBusinessMarks,
  markThreadAsBusiness as markThreadAsBusinessLocal,
  isThreadMarkedAsBusiness,
  getBusinessNote,
  type BeeperThread,
  type BeeperMessage,
  type BusinessThreadMark,
} from "@/lib/services/beeper";

interface BeeperContextValue {
  // Data
  threads: BeeperThread[];
  selectedThread: BeeperThread | null;
  conversation: BeeperMessage[];
  searchResults: BeeperMessage[];

  // Business state
  businessMarks: Map<string, BusinessThreadMark>;
  showBusinessOnly: boolean;

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

  // Business actions
  markAsBusiness: (threadId: string, isBusinessChat: boolean, businessNote?: string) => void;
  isThreadBusiness: (threadId: string) => boolean;
  getThreadBusinessNote: (threadId: string) => string | undefined;
  setShowBusinessOnly: (show: boolean) => void;
  refreshBusinessMarks: () => void;

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

  // Business state
  const [businessMarks, setBusinessMarks] = useState<Map<string, BusinessThreadMark>>(
    () => getBusinessMarks()
  );
  const [showBusinessOnly, setShowBusinessOnly] = useState(false);

  // Loading states
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasDatabaseSynced, setHasDatabaseSynced] = useState<boolean | null>(
    null
  );

  // Refresh business marks from localStorage
  const refreshBusinessMarks = useCallback(() => {
    setBusinessMarks(getBusinessMarks());
  }, []);

  // Load business marks on mount
  useEffect(() => {
    refreshBusinessMarks();
  }, [refreshBusinessMarks]);

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
        // Use thread_id instead of name to avoid issues with duplicate names
        // like "WhatsApp private chat" which is shared by many DM threads
        const messages = await getBeeperConversationById(thread.thread_id);
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

  // Mark thread as business (or unmark)
  const markAsBusiness = useCallback(
    (threadId: string, isBusinessChat: boolean, businessNote?: string) => {
      markThreadAsBusinessLocal(threadId, isBusinessChat, businessNote);
      refreshBusinessMarks();
    },
    [refreshBusinessMarks]
  );

  // Check if thread is marked as business
  const isThreadBusiness = useCallback(
    (threadId: string) => {
      return businessMarks.has(threadId);
    },
    [businessMarks]
  );

  // Get business note for thread
  const getThreadBusinessNote = useCallback(
    (threadId: string) => {
      return businessMarks.get(threadId)?.businessNote;
    },
    [businessMarks]
  );

  // Filter threads if showing business only
  const filteredThreads = showBusinessOnly
    ? threads.filter((t) => businessMarks.has(t.thread_id))
    : threads;

  const value: BeeperContextValue = {
    // Data
    threads: filteredThreads,
    selectedThread,
    conversation,
    searchResults,

    // Business state
    businessMarks,
    showBusinessOnly,

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

    // Business actions
    markAsBusiness,
    isThreadBusiness,
    getThreadBusinessNote,
    setShowBusinessOnly,
    refreshBusinessMarks,

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
