import { Clock, Calendar } from "lucide-react";

export function TimelineView() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-full bg-muted p-4">
        <Clock className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-lg font-medium">Timeline Coming Soon</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          See a chronological view of all your interactions with people,
          including voice memos, notes, and AI profile updates.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>Phase 4 of implementation</span>
      </div>
    </div>
  );
}
