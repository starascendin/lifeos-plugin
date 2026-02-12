---
name: end-of-day
description: Run end-of-day wrap-up with completion summary and tomorrow planning
---

Run my end-of-day wrap-up. Use the LifeOS MCP tools:

1. Call get_daily_agenda for today's agenda
2. Call get_tasks with status "done" to see what was completed today
3. Call get_tasks with status "in_progress" to see what's still in flight
4. Call get_todays_tasks to see what was planned vs actual
5. Call get_recent_notes with limit 5 for any thoughts captured today

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

If $ARGUMENTS contains a date, run EOD for that date instead of today.
