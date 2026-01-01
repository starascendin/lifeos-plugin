import { useAgenda, formatDisplayDate, isToday } from "@/lib/contexts/AgendaContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { DailyView } from "./daily/DailyView";

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
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold">Agenda</h1>
            <div className="flex items-center gap-2">
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
                className="h-8"
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                Today
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
          <div className="text-sm text-muted-foreground">
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
    </div>
  );
}
