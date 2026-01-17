import { useFRM } from "@/lib/contexts/FRMContext";
import { PersonCard } from "./PersonCard";
import { Input } from "@/components/ui/input";
import { Search, Users } from "lucide-react";
import type { Id } from "@holaai/convex";

interface PeopleListProps {
  onPersonSelect: (personId: Id<"lifeos_frmPeople">) => void;
}

export function PeopleList({ onPersonSelect }: PeopleListProps) {
  const {
    people,
    isLoadingPeople,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
  } = useFRM();

  // Use search results if searching, otherwise use all people
  const displayPeople = searchQuery.trim() ? searchResults : people;
  const isLoading = searchQuery.trim() ? isSearching : isLoadingPeople;

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="border-b border-border px-6 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* People Grid */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : !displayPeople || displayPeople.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-muted p-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-medium">
                {searchQuery.trim() ? "No results found" : "No people yet"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery.trim()
                  ? "Try a different search term"
                  : "Add someone to start tracking your relationships"}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayPeople.map((person) => (
              <PersonCard
                key={person._id}
                person={person}
                onClick={() => onPersonSelect(person._id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
