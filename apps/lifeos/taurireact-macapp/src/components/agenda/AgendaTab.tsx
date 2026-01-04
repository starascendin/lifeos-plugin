import { useAgenda, formatDisplayDate, isToday } from "@/lib/contexts/AgendaContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { DailyView } from "./daily/DailyView";
import { IssueDetailPanel } from "@/components/pm/issue/IssueDetailPanel";

export function AgendaTab() {
  const {
    currentDate,
    goToToday,
    goToPreviousDay,
    goToNextDay,
    viewMode,
  } = useAgenda();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 md:px-6 md:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between sm:justify-start gap-3 md:gap-4">
            <h1 className="text-xl md:text-2xl font-semibold">Agenda</h1>
            <div className="flex items-center gap-1 md:gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousDay}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                disabled={isToday(currentDate)}
                className="h-8 px-2 md:px-3"
              >
                <CalendarDays className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Today</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextDay}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="text-xs md:text-sm text-muted-foreground text-center sm:text-right">
            {formatDisplayDate(currentDate)}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === "daily" && <DailyView />}
        {viewMode === "weekly" && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Weekly view coming soon
          </div>
        )}
        {viewMode === "monthly" && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Monthly view coming soon
          </div>
        )}
      </div>

      {/* Issue Detail Panel */}
      <IssueDetailPanel />
    </div>
  );
}
