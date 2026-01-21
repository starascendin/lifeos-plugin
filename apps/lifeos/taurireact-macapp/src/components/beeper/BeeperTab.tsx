import { useEffect, useState } from "react";
import { useBeeper } from "@/lib/contexts/BeeperContext";
import { ThreadsList } from "./ThreadsList";
import { ConversationView } from "./ConversationView";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, MessageCircle, AlertCircle } from "lucide-react";

export function BeeperTab() {
  const {
    threads,
    selectedThread,
    searchResults,
    isLoadingThreads,
    isSearching,
    hasDatabaseSynced,
    loadThreads,
    search,
    clearSearch,
    searchQuery,
    setSearchQuery,
    checkDatabase,
  } = useBeeper();

  const [searchInput, setSearchInput] = useState("");

  // Check database and load threads on mount
  useEffect(() => {
    async function init() {
      await checkDatabase();
    }
    init();
  }, [checkDatabase]);

  // Load threads when database is synced
  useEffect(() => {
    if (hasDatabaseSynced) {
      loadThreads();
    }
  }, [hasDatabaseSynced, loadThreads]);

  // Handle search submit
  const handleSearch = () => {
    if (searchInput.trim()) {
      setSearchQuery(searchInput.trim());
      search(searchInput.trim());
    }
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchInput("");
    clearSearch();
  };

  // Handle keydown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    } else if (e.key === "Escape") {
      handleClearSearch();
    }
  };

  // Show database not synced state
  if (hasDatabaseSynced === false) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Database Not Synced</h2>
          <p className="text-muted-foreground mb-4">
            Your Beeper messages haven't been synced yet. Go to the Background
            Sync Jobs window and click "Sync Now" in the Beeper tab to import
            your WhatsApp messages.
          </p>
          <Button variant="outline" onClick={() => checkDatabase()}>
            Check Again
          </Button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (hasDatabaseSynced === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-muted-foreground">Checking database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with search */}
      <div className="border-b p-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Beeper Messages</h1>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search messages..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9 pr-9"
            />
            {searchInput && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <Button onClick={handleSearch} disabled={!searchInput.trim()}>
            Search
          </Button>
        </div>
        {searchQuery && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Showing results for: <strong>"{searchQuery}"</strong>
            </span>
            <button
              onClick={handleClearSearch}
              className="text-primary hover:underline"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Main content - two column layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Threads list */}
        <div className="w-80 border-r flex-shrink-0 overflow-hidden">
          <ThreadsList
            threads={searchQuery ? [] : threads}
            searchResults={searchQuery ? searchResults : []}
            isLoading={isLoadingThreads || isSearching}
            isSearchMode={!!searchQuery}
          />
        </div>

        {/* Conversation view */}
        <div className="flex-1 overflow-hidden">
          <ConversationView />
        </div>
      </div>
    </div>
  );
}
