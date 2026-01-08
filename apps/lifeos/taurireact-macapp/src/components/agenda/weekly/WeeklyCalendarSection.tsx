import { useState } from "react";
import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, RefreshCw, Clock, MapPin, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Doc } from "@holaai/convex";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function formatEventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function EventItem({
  event,
  isAllDay,
}: {
  event: Doc<"lifeos_calendarEvents">;
  isAllDay?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="flex-shrink-0 w-14 text-xs text-muted-foreground pt-0.5">
        {isAllDay ? (
          <span className="text-purple-500 font-medium">All day</span>
        ) : (
          <div className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {formatEventTime(event.startTime)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm leading-tight truncate block">{event.title}</span>
        {event.location && (
          <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {event.location}
          </span>
        )}
      </div>
    </div>
  );
}

function DayEventsGroup({
  date,
  dayIndex,
  events,
}: {
  date: string;
  dayIndex: number;
  events: Doc<"lifeos_calendarEvents">[];
}) {
  const dayDate = new Date(date);
  const dayNum = dayDate.getDate();
  const monthName = dayDate.toLocaleDateString("en-US", { month: "short" });

  // Separate all-day events from timed events
  const allDayEvents = events.filter((e) => e.isAllDay);
  const timedEvents = events.filter((e) => !e.isAllDay);

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-3 py-2">
      <div className="flex-shrink-0 w-16 text-right pr-2 border-r">
        <div className="text-xs text-muted-foreground">{DAY_NAMES[dayIndex]}</div>
        <div className="text-lg font-semibold">{dayNum}</div>
        <div className="text-xs text-muted-foreground">{monthName}</div>
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        {allDayEvents.map((event) => (
          <EventItem key={event._id} event={event} isAllDay />
        ))}
        {timedEvents.map((event) => (
          <EventItem key={event._id} event={event} />
        ))}
      </div>
    </div>
  );
}

export function WeeklyCalendarSection() {
  const [isOpen, setIsOpen] = useState(true);
  const {
    weeklyEvents,
    weekStartDate,
    isLoadingWeeklyData,
    syncCalendar,
    isSyncingCalendar,
    calendarSyncStatus,
  } = useAgenda();

  // Generate array of dates for the week
  const weekDates: string[] = [];
  const startDate = new Date(weekStartDate);
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    weekDates.push(d.toISOString().split("T")[0]);
  }

  // Count total events
  const totalEvents = weekDates.reduce((sum, date) => {
    return sum + (weeklyEvents?.[date]?.length ?? 0);
  }, 0);

  // Check if user has never synced
  const hasNeverSynced = calendarSyncStatus === null;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  !isOpen && "-rotate-90"
                )}
              />
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5" />
                Calendar Events
                <span className="text-sm font-normal text-muted-foreground">
                  ({totalEvents})
                </span>
              </CardTitle>
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                syncCalendar();
              }}
              disabled={isSyncingCalendar}
              title="Sync calendar"
            >
              <RefreshCw
                className={cn("h-4 w-4", isSyncingCalendar && "animate-spin")}
              />
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoadingWeeklyData ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : totalEvents > 0 ? (
              <div className="divide-y">
                {weekDates.map((date, idx) => (
                  <DayEventsGroup
                    key={date}
                    date={date}
                    dayIndex={idx}
                    events={weeklyEvents?.[date] ?? []}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {hasNeverSynced ? (
                  <>
                    <p className="text-sm">Sync your Google Calendar</p>
                    <p className="text-xs mt-1 mb-3">
                      Connect to see your events here
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={syncCalendar}
                      disabled={isSyncingCalendar}
                    >
                      {isSyncingCalendar ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sync Calendar
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm">No calendar events this week</p>
                )}
              </div>
            )}

            {/* Show sync error if any */}
            {calendarSyncStatus?.lastSyncError && (
              <div className="mt-3 p-2 rounded-md bg-red-500/10 text-red-500 text-xs">
                {calendarSyncStatus.lastSyncError}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
