import {
  useAgenda,
  formatDisplayDate,
  formatWeekRange,
  isToday,
  type ViewMode,
} from "@/lib/contexts/AgendaContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Calendar,
} from "lucide-react";
import { DailyView } from "./daily/DailyView";
import { WeeklyView } from "./weekly/WeeklyView";
import { MonthlyView } from "./monthly/MonthlyView";
import { QuarterlyView } from "./quarterly/QuarterlyView";
import { YearlyView } from "./yearly/YearlyView";
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

function isThisMonth(year: number, month: number): boolean {
  const today = new Date();
  return year === today.getFullYear() && month === today.getMonth() + 1;
}

function isThisQuarter(year: number, quarter: number): boolean {
  const today = new Date();
  const currentQuarter = Math.ceil((today.getMonth() + 1) / 3);
  return year === today.getFullYear() && quarter === currentQuarter;
}

function isThisYear(year: number): boolean {
  return year === new Date().getFullYear();
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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
    currentMonth,
    currentMonthYear,
    goToPreviousMonth,
    goToNextMonth,
    goToThisMonth,
    currentQuarter,
    currentQuarterYear,
    goToPreviousQuarter,
    goToNextQuarter,
    goToThisQuarter,
    currentYear,
    goToPreviousYear,
    goToNextYear,
    goToThisYear,
    viewMode,
    setViewMode,
  } = useAgenda();

  // Navigation handlers based on view mode
  const getNavigationConfig = () => {
    switch (viewMode) {
      case "daily":
        return {
          handlePrevious: goToPreviousDay,
          handleNext: goToNextDay,
          handleGoToNow: goToToday,
          isAtNow: isToday(currentDate),
          nowLabel: "Today",
          prevTitle: "Previous day",
          nextTitle: "Next day",
        };
      case "weekly":
        return {
          handlePrevious: goToPreviousWeek,
          handleNext: goToNextWeek,
          handleGoToNow: goToThisWeek,
          isAtNow: isThisWeek(currentWeekStart),
          nowLabel: "This Week",
          prevTitle: "Previous week",
          nextTitle: "Next week",
        };
      case "monthly":
        return {
          handlePrevious: goToPreviousMonth,
          handleNext: goToNextMonth,
          handleGoToNow: goToThisMonth,
          isAtNow: isThisMonth(currentMonthYear, currentMonth),
          nowLabel: "This Month",
          prevTitle: "Previous month",
          nextTitle: "Next month",
        };
      case "quarterly":
        return {
          handlePrevious: goToPreviousQuarter,
          handleNext: goToNextQuarter,
          handleGoToNow: goToThisQuarter,
          isAtNow: isThisQuarter(currentQuarterYear, currentQuarter),
          nowLabel: "This Quarter",
          prevTitle: "Previous quarter",
          nextTitle: "Next quarter",
        };
      case "yearly":
        return {
          handlePrevious: goToPreviousYear,
          handleNext: goToNextYear,
          handleGoToNow: goToThisYear,
          isAtNow: isThisYear(currentYear),
          nowLabel: "This Year",
          prevTitle: "Previous year",
          nextTitle: "Next year",
        };
      default:
        return {
          handlePrevious: goToPreviousDay,
          handleNext: goToNextDay,
          handleGoToNow: goToToday,
          isAtNow: isToday(currentDate),
          nowLabel: "Today",
          prevTitle: "Previous day",
          nextTitle: "Next day",
        };
    }
  };

  const {
    handlePrevious,
    handleNext,
    handleGoToNow,
    isAtNow,
    nowLabel,
    prevTitle,
    nextTitle,
  } = getNavigationConfig();

  // Date display based on view mode
  const getDateDisplay = () => {
    switch (viewMode) {
      case "daily":
        return formatDisplayDate(currentDate);
      case "weekly":
        return formatWeekRange(currentWeekStart);
      case "monthly":
        return `${MONTH_NAMES[currentMonth - 1]} ${currentMonthYear}`;
      case "quarterly":
        return `Q${currentQuarter} ${currentQuarterYear}`;
      case "yearly":
        return `${currentYear}`;
      default:
        return formatDisplayDate(currentDate);
    }
  };

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
                onValueChange={(v) => setViewMode(v as ViewMode)}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="daily" className="text-xs px-2 md:px-3">
                    Daily
                  </TabsTrigger>
                  <TabsTrigger value="weekly" className="text-xs px-2 md:px-3">
                    Weekly
                  </TabsTrigger>
                  <TabsTrigger value="monthly" className="text-xs px-2 md:px-3">
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger
                    value="quarterly"
                    className="text-xs px-2 md:px-3"
                  >
                    Quarterly
                  </TabsTrigger>
                  <TabsTrigger value="yearly" className="text-xs px-2 md:px-3">
                    Yearly
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
                  title={prevTitle}
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
                  {viewMode === "daily" ? (
                    <CalendarDays className="h-4 w-4 md:mr-2" />
                  ) : (
                    <Calendar className="h-4 w-4 md:mr-2" />
                  )}
                  <span className="hidden md:inline">{nowLabel}</span>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNext}
                  className="h-8 w-8"
                  title={nextTitle}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Date display */}
          <div className="text-xs md:text-sm text-muted-foreground text-center sm:text-left">
            {getDateDisplay()}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === "daily" && <DailyView />}
        {viewMode === "weekly" && <WeeklyView />}
        {viewMode === "monthly" && (
          <MonthlyView year={currentMonthYear} month={currentMonth} />
        )}
        {viewMode === "quarterly" && (
          <QuarterlyView year={currentQuarterYear} quarter={currentQuarter} />
        )}
        {viewMode === "yearly" && <YearlyView year={currentYear} />}
      </div>

      {/* Issue Detail Panel */}
      <IssueDetailPanel />
    </div>
  );
}
