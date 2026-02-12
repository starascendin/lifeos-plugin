---
name: daily-standup
description: Get daily standup briefing with agenda, tasks due today, and sprint progress
---

Get my daily standup briefing. Use the LifeOS MCP tools to gather:

1. Call get_daily_agenda for today's agenda (tasks due today, calendar events, top priorities)
2. Call get_todays_tasks for today's task list
3. Call get_current_cycle for current sprint progress and stats

Then summarize everything in a concise standup format:
- **Today's Focus**: Top 3 things to focus on
- **Tasks Due**: List tasks due today with priority
- **Sprint Progress**: Cycle completion % and key stats
- **Calendar**: Any meetings or events today

Keep it short and actionable. If $ARGUMENTS contains a date, use that date instead of today.
