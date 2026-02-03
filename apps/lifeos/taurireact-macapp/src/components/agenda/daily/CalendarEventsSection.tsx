import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, RefreshCw, MapPin, Clock, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doc } from "@holaai/convex";

interface EventItemProps {
  event: Doc<"lifeos_calendarEvents">;
  isAllDay?: boolean;
}

function formatEventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeRange(startTime: number, endTime: number): string {
  const start = formatEventTime(startTime);
  const end = formatEventTime(endTime);
  return `${start} - ${end}`;
}

function EventItem({ event, isAllDay }: EventItemProps) {
  const externalAttendees = event.attendees?.filter((a) => !a.self) ?? [];
  const isOneOnOne = externalAttendees.length === 1;
  const isGroupMeeting = externalAttendees.length > 1;

  return (
    <div className="flex items-start gap-3 py-2 px-1 rounded-md hover:bg-muted/50 transition-colors">
      <div className="flex-shrink-0 w-14 text-xs text-muted-foreground pt-0.5">
        {isAllDay ? (
          <span className="text-purple-500 font-medium">All day</span>
        ) : (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatEventTime(event.startTime)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{event.title}</p>
          {isOneOnOne && (
            <Badge variant="secondary" className="h-5 text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-400 flex items-center gap-1">
              <User className="h-3 w-3" />
              1:1
            </Badge>
          )}
          {isGroupMeeting && (
            <Badge variant="secondary" className="h-5 text-[10px] bg-orange-500/10 text-orange-700 dark:text-orange-400 flex items-center gap-1">
              <Users className="h-3 w-3" />
              {externalAttendees.length + 1}
            </Badge>
          )}
        </div>
        {!isAllDay && (
          <p className="text-xs text-muted-foreground">
            {formatTimeRange(event.startTime, event.endTime)}
          </p>
        )}
        {event.location && (
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" />
            {event.location}
          </p>
        )}
        {externalAttendees.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {externalAttendees.slice(0, 3).map((attendee, idx) => (
              <span
                key={attendee.email || idx}
                className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                title={attendee.email}
              >
                {attendee.displayName || attendee.email.split("@")[0]}
              </span>
            ))}
            {externalAttendees.length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                +{externalAttendees.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasNeverSynced }: { hasNeverSynced: boolean }) {
  const { syncCalendar, isSyncingCalendar } = useAgenda();

  return (
    <div className="text-center py-6 text-muted-foreground">
      <CalendarDays className="h-6 w-6 mx-auto mb-2 opacity-40" />
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
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isSyncingCalendar && "animate-spin")} />
            {isSyncingCalendar ? "Syncing..." : "Sync"}
          </Button>
        </>
      ) : (
        <p className="text-xs">No events today</p>
      )}
    </div>
  );
}

export function CalendarEventsSection() {
  const {
    todaysEvents,
    isLoadingEvents,
    syncCalendar,
    isSyncingCalendar,
    calendarSyncStatus,
  } = useAgenda();

  const allDayEvents = todaysEvents?.filter((e) => e.isAllDay) ?? [];
  const timedEvents = todaysEvents?.filter((e) => !e.isAllDay) ?? [];
  const hasNeverSynced = calendarSyncStatus === null;

  const lastSyncText = calendarSyncStatus?.lastSyncAt
    ? new Date(calendarSyncStatus.lastSyncAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="p-4 md:p-5">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Calendar</h3>
          {todaysEvents && todaysEvents.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({todaysEvents.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastSyncText && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              {lastSyncText}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={syncCalendar}
            disabled={isSyncingCalendar}
            title="Sync calendar"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isSyncingCalendar && "animate-spin")}
            />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoadingEvents ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : todaysEvents && todaysEvents.length > 0 ? (
        <div className="space-y-0.5">
          {allDayEvents.length > 0 && (
            <div className="mb-1 pb-1 border-b border-purple-500/20">
              {allDayEvents.map((event) => (
                <EventItem key={event._id} event={event} isAllDay />
              ))}
            </div>
          )}
          {timedEvents.map((event) => (
            <EventItem key={event._id} event={event} />
          ))}
        </div>
      ) : (
        <EmptyState hasNeverSynced={hasNeverSynced} />
      )}

      {calendarSyncStatus?.lastSyncError && (
        <div className="mt-2 p-2 rounded-md bg-red-500/10 text-red-500 text-xs">
          {calendarSyncStatus.lastSyncError}
        </div>
      )}
    </div>
  );
}
