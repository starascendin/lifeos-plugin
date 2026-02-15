import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Notebook } from "lucide-react";

const DAY_LABELS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = DAY_LABELS[d.getDay()];
  return `${day} ${d.getMonth() + 1}/${d.getDate()}`;
}

export function WeeklyNotesSection() {
  const { weekStartDate, weekEndDate } = useAgenda();

  const notes = useQuery(api.lifeos.agenda.getDailyNotesForRange, {
    startDate: weekStartDate,
    endDate: weekEndDate,
  });

  if (notes === undefined) {
    return (
      <div className="rounded-lg border bg-card/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Notebook className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-medium">Daily Notes</h3>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="rounded-lg border bg-card/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Notebook className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-medium">Daily Notes</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          No notes written this week.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Notebook className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-medium">Daily Notes</h3>
        <span className="text-xs text-muted-foreground font-normal">
          ({notes.length})
        </span>
      </div>
      <div className="space-y-2">
        {notes.map((note) => (
          <div key={note.date} className="space-y-0.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              {formatDayLabel(note.date)}
            </p>
            <p className="text-xs whitespace-pre-wrap leading-relaxed">
              {note.userNote}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
