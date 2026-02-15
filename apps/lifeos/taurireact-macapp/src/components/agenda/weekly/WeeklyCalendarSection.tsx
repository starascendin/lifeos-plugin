import { useState } from "react";
import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, RefreshCw, Clock, MapPin, ChevronDown, Users, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Doc } from "@holaai/convex";

const SHORT_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
  const externalAttendees = event.attendees?.filter((a) => !a.self) ?? [];
  const isOneOnOne = externalAttendees.length === 1;
  const isGroupMeeting = externalAttendees.length > 1;

  return (
    <div className="flex items-start gap-1.5 py-1">
      <div className="flex-shrink-0 w-12 text-[10px] text-muted-foreground pt-0.5">
        {isAllDay ? (
          <span className="text-purple-500 font-medium">All day</span>
        ) : (
          <div className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {formatEventTime(event.startTime)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs leading-tight truncate">{event.title}</span>
          {isOneOnOne && (
            <Badge variant="secondary" className="h-3.5 text-[8px] bg-blue-500/10 text-blue-700 px-0.5 flex items-center gap-0.5">
              <User className="h-2 w-2" />
              1:1
            </Badge>
          )}
          {isGroupMeeting && (
            <Badge variant="secondary" className="h-3.5 text-[8px] bg-orange-500/10 text-orange-700 px-0.5 flex items-center gap-0.5">
              <Users className="h-2 w-2" />
              {externalAttendees.length + 1}
            </Badge>
          )}
        </div>
        {event.location && (
          <span className="text-[10px] text-muted-foreground truncate flex items-center gap-0.5">
            <MapPin className="h-2.5 w-2.5" />
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

  const allDayEvents = events.filter((e) => e.isAllDay);
  const timedEvents = events.filter((e) => !e.isAllDay);

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2 py-1.5">
      <div className="flex-shrink-0 w-10 text-right pr-1.5 border-r">
        <div className="text-[10px] text-muted-foreground">{SHORT_DAY_NAMES[dayIndex]}</div>
        <div className="text-sm font-semibold">{dayNum}</div>
      </div>
      <div className="flex-1 min-w-0 space-y-0">
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

  const hasNeverSynced = calendarSyncStatus === null;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform",
                  !isOpen && "-rotate-90",
                )}
              />
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="h-4 w-4" />
                Calendar
                <span className="text-xs font-normal text-muted-foreground">
                  ({totalEvents})
                </span>
              </CardTitle>
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                syncCalendar();
              }}
              disabled={isSyncingCalendar}
              title="Sync calendar"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isSyncingCalendar && "animate-spin")}
              />
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoadingWeeklyData ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
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
              <div className="text-center py-4 text-muted-foreground">
                <CalendarDays className="h-6 w-6 mx-auto mb-1 opacity-50" />
                {hasNeverSynced ? (
                  <>
                    <p className="text-xs">Sync your Google Calendar</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={syncCalendar}
                      disabled={isSyncingCalendar}
                      className="mt-2 h-7 text-xs"
                    >
                      {isSyncingCalendar ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Sync
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <p className="text-xs">No events this week</p>
                )}
              </div>
            )}

            {calendarSyncStatus?.lastSyncError && (
              <div className="mt-2 p-1.5 rounded-md bg-red-500/10 text-red-500 text-[10px]">
                {calendarSyncStatus.lastSyncError}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
