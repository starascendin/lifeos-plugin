---
name: cycle-review
description: Review the current cycle/sprint with progress, incomplete items, and rollover options
---

Review my current cycle/sprint. Use the LifeOS MCP tools:

1. Call get_current_cycle for the active cycle with progress stats
2. Call get_cycles with status "upcoming" to see what's next
3. Call get_tasks with status "in_progress" to see active work
4. Call get_tasks with status "backlog" or "todo" to see incomplete items in the cycle

Present the cycle review:
- **Cycle Summary**: Name, dates, days remaining
- **Progress**: Completion %, issues done vs total
- **Incomplete Items**: List all non-done/non-cancelled issues with status and priority
- **Next Cycle**: Show the next upcoming cycle (if any)
- **Recommendations**:
  - If cycle is ending soon, suggest closing with rollover
  - If many items are incomplete, suggest re-prioritizing
  - If cycle is already past end date, strongly recommend closing it

If $ARGUMENTS contains "close", call close_cycle to close the current cycle WITHOUT rolling over incomplete issues.
If $ARGUMENTS contains "rollover", call close_cycle with rolloverIncomplete=true to close and move incomplete issues to the next cycle.
Otherwise, ask the user if they want to close the cycle and whether to roll over incomplete issues.
