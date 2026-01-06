import {
  useAgenda,
  formatDisplayDate,
  formatWeekRange,
  isToday,
} from "@/lib/contexts/AgendaContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, CalendarDays, Calendar } from "lucide-react";
import { DailyView } from "./daily/DailyView";
import { WeeklyView } from "./weekly/WeeklyView";
import { IssueDetailPanel } from "@/components/pm/issue/IssueDetailPanel";

function isThisWeek(weekStart: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentWeekStart = getWeekStartDate(today);
  return weekStart.getTime() === currentWeekStart.getTime();
}

function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function AgendaTab() {
  const {
    currentDate,
    currentWeekStart,
    goToToday,
    goToPreviousDay,
    goToNextDay,
    goToPreviousWeek,
    goToNextWeek,
    goToThisWeek,
    viewMode,
    setViewMode,
  } = useAgenda();

  const isDaily = viewMode === "daily";
  const isWeekly = viewMode === "weekly";

  // Navigation handlers based on view mode
  const handlePrevious = isDaily ? goToPreviousDay : goToPreviousWeek;
  const handleNext = isDaily ? goToNextDay : goToNextWeek;
  const handleGoToNow = isDaily ? goToToday : goToThisWeek;
  const isAtNow = isDaily ? isToday(currentDate) : isThisWeek(currentWeekStart);

  // Date display based on view mode
  const dateDisplay = isDaily
    ? formatDisplayDate(currentDate)
    : formatWeekRange(currentWeekStart);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 md:px-6 md:py-4">
        <div className="flex flex-col gap-3">
          {/* Top row: Title, View Tabs, Navigation */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between sm:justify-start gap-3 md:gap-4">
              <h1 className="text-xl md:text-2xl font-semibold">Agenda</h1>

              {/* View Mode Tabs */}
              <Tabs
                value={viewMode}
                onValueChange={(v) => setViewMode(v as "daily" | "weekly")}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="daily" className="text-xs px-3">
                    Daily
                  </TabsTrigger>
                  <TabsTrigger value="weekly" className="text-xs px-3">
                    Weekly
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between sm:justify-end gap-2">
              <div className="flex items-center gap-1 md:gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrevious}
                  className="h-8 w-8"
                  title={isDaily ? "Previous day" : "Previous week"}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGoToNow}
                  disabled={isAtNow}
                  className="h-8 px-2 md:px-3"
                >
                  {isDaily ? (
                    <CalendarDays className="h-4 w-4 md:mr-2" />
                  ) : (
                    <Calendar className="h-4 w-4 md:mr-2" />
                  )}
                  <span className="hidden md:inline">
                    {isDaily ? "Today" : "This Week"}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNext}
                  className="h-8 w-8"
                  title={isDaily ? "Next day" : "Next week"}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Date display */}
          <div className="text-xs md:text-sm text-muted-foreground text-center sm:text-left">
            {dateDisplay}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === "daily" && <DailyView />}
        {viewMode === "weekly" && <WeeklyView />}
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
