// Shared constants for agenda module (safe to import from client or server)

export const DEFAULT_DAILY_PROMPT = `Please provide a brief daily summary for {date}:

{userNote}

CALENDAR EVENTS:
{eventsFormatted}

TOP PRIORITIES ({topPriorityCount}):
{topTasksFormatted}

TASKS DUE TODAY ({totalTasks}):
{otherTasksFormatted}

OVERDUE TASKS ({overdueCount}):
{overdueTasksFormatted}

HABITS ({habitCompletionCount}/{totalHabits} completed):
{habitNames}

VOICE MEMOS:
{memosFormatted}

Provide a 3-5 sentence summary that:
1. References the user's note if provided
2. Highlights calendar events and key priorities
3. Flags overdue items that need attention
4. Gives an actionable recommendation for the day`;
