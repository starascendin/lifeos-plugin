---
name: daily-standup
description: Get daily standup briefing with agenda, tasks due today, and sprint progress
---

Get my daily standup briefing. Use the Bash tool to run lifeos CLI commands to gather:

1. Run: `lifeos get_daily_agenda` for today's agenda (tasks due today, calendar events, top priorities)
2. Run: `lifeos get_todays_tasks` for today's task list
3. Run: `lifeos get_current_cycle` for current sprint progress and stats

Then summarize everything in a concise standup format:
- **Today's Focus**: Top 3 things to focus on
- **Tasks Due**: List tasks due today with priority
- **Sprint Progress**: Cycle completion % and key stats
- **Calendar**: Any meetings or events today

Keep it short and actionable. If $ARGUMENTS contains a date, use that date instead of today (e.g. `lifeos get_daily_agenda date=2025-01-15`).

Each lifeos command outputs JSON. Parse the results accordingly.
