import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, RefreshCw, MapPin, Clock } from "lucide-react";
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
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-shrink-0 w-16 text-xs text-muted-foreground pt-0.5">
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
        <p className="font-medium truncate">{event.title}</p>
        {!isAllDay && (
          <p className="text-xs text-muted-foreground">
            {formatTimeRange(event.startTime, event.endTime)}
          </p>
        )}
        {event.location && (
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-1">
            <MapPin className="h-3 w-3" />
            {event.location}
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasNeverSynced }: { hasNeverSynced: boolean }) {
  const { syncCalendar, isSyncingCalendar } = useAgenda();

  return (
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
        <p className="text-sm">No events scheduled for today</p>
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

  // Separate all-day events from timed events
  const allDayEvents = todaysEvents?.filter((e) => e.isAllDay) ?? [];
  const timedEvents = todaysEvents?.filter((e) => !e.isAllDay) ?? [];

  // Check if user has never synced
  const hasNeverSynced = calendarSyncStatus === null;

  // Format last sync time
  const lastSyncText = calendarSyncStatus?.lastSyncAt
    ? `Last synced ${new Date(calendarSyncStatus.lastSyncAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5" />
            Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastSyncText && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {lastSyncText}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={syncCalendar}
              disabled={isSyncingCalendar}
              title="Sync calendar"
            >
              <RefreshCw
                className={cn("h-4 w-4", isSyncingCalendar && "animate-spin")}
              />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoadingEvents ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : todaysEvents && todaysEvents.length > 0 ? (
          <div className="space-y-1">
            {/* All-day events first */}
            {allDayEvents.length > 0 && (
              <div className="mb-2 pb-2 border-b border-purple-500/20">
                {allDayEvents.map((event) => (
                  <EventItem key={event._id} event={event} isAllDay />
                ))}
              </div>
            )}
            {/* Timed events */}
            {timedEvents.map((event) => (
              <EventItem key={event._id} event={event} />
            ))}
          </div>
        ) : (
          <EmptyState hasNeverSynced={hasNeverSynced} />
        )}

        {/* Show sync error if any */}
        {calendarSyncStatus?.lastSyncError && (
          <div className="mt-3 p-2 rounded-md bg-red-500/10 text-red-500 text-xs">
            {calendarSyncStatus.lastSyncError}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
