---
name: weekly-review
description: Run weekly review with completed work, in-progress items, sprint health, and blockers
---

Run my weekly review. Use the LifeOS MCP tools to gather:

1. Call `get_weekly_agenda` for this week's agenda and AI summary
2. Call `get_current_cycle` for sprint progress
3. Call `get_tasks` with status "done" to see what was completed this week
4. Call `get_tasks` with status "in_progress" to see what's still in flight
5. Call `get_tasks` with status "todo" to see upcoming work

Then present a weekly review:
- **Completed**: What got done this week
- **In Progress**: What's still being worked on
- **Sprint Health**: Cycle progress, burndown status
- **Blockers**: Anything overdue or stuck
- **Next Week**: Key items to tackle

If $ARGUMENTS contains a date, use that as the week start date.
