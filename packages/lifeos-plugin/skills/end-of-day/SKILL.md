---
name: end-of-day
description: Run end-of-day wrap-up with completion summary and tomorrow planning
---

Run my end-of-day wrap-up. Use the Bash tool to run lifeos CLI commands:

1. Run: `lifeos get_daily_agenda` for today's agenda
2. Run: `lifeos get_tasks status=done` to see what was completed today
3. Run: `lifeos get_tasks status=in_progress` to see what's still in flight
4. Run: `lifeos get_todays_tasks` to see what was planned vs actual
5. Run: `lifeos get_recent_notes limit=5` for any thoughts captured today

Present an end-of-day summary:
- **Completed today**: What got done (celebrate wins!)
- **Still in progress**: What's carrying over
- **Moved to tomorrow**: Tasks that got bumped
- **Unplanned work**: Things that came up unexpectedly
- **Notes captured**: Any thoughts/ideas from today

Then prompt for reflection:
- What went well today?
- What was challenging?
- What's the #1 priority for tomorrow morning?

Offer to:
- Update any task statuses
- Create tasks for tomorrow based on reflection
- Capture any final thoughts as a note

If $ARGUMENTS contains a date, run EOD for that date instead of today (e.g. `lifeos get_daily_agenda date=2025-01-15`).

Each lifeos command outputs JSON. Parse the results accordingly.
