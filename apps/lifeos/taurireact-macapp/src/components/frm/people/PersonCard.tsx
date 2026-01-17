import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, MessageSquare } from "lucide-react";
import type { Doc } from "@holaai/convex";
import { formatDistanceToNow } from "date-fns";

interface PersonCardProps {
  person: Doc<"lifeos_frmPeople">;
  onClick: () => void;
}

const relationshipTypeLabels: Record<string, string> = {
  family: "Family",
  friend: "Friend",
  colleague: "Colleague",
  acquaintance: "Acquaintance",
  mentor: "Mentor",
  other: "Other",
};

const relationshipTypeColors: Record<string, string> = {
  family: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  friend: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  colleague: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  acquaintance: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  mentor: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  other: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

export function PersonCard({ person, onClick }: PersonCardProps) {
  const lastInteraction = person.lastInteractionAt
    ? formatDistanceToNow(new Date(person.lastInteractionAt), {
        addSuffix: true,
      })
    : null;

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-xl"
            style={{
              backgroundColor: person.color
                ? `${person.color}20`
                : "hsl(var(--muted))",
              color: person.color || "hsl(var(--muted-foreground))",
            }}
          >
            {person.avatarEmoji || <User className="h-6 w-6" />}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{person.name}</h3>
            {person.nickname && (
              <p className="text-sm text-muted-foreground truncate">
                "{person.nickname}"
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {person.relationshipType && (
                <Badge
                  variant="outline"
                  className={
                    relationshipTypeColors[person.relationshipType] || ""
                  }
                >
                  {relationshipTypeLabels[person.relationshipType] ||
                    person.relationshipType}
                </Badge>
              )}

              {person.memoCount > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  {person.memoCount}
                </div>
              )}
            </div>

            {lastInteraction && (
              <p className="mt-2 text-xs text-muted-foreground">
                Last interaction {lastInteraction}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
