---
name: overdue
description: Show what's overdue or slipping - tasks, projects, and sprint items
---

Show what's overdue or slipping. Use the LifeOS MCP tools:

1. Call get_overdue_tasks to get overdue open tasks
2. Call get_tasks with status "in_progress" to find stale active work
3. Call get_projects to get all projects with health status
4. Call get_current_cycle to see sprint status

Analyze and identify:
- **Overdue tasks**: Tasks returned by get_overdue_tasks
- **Off-track projects**: Projects with health = "off_track" or "at_risk"
- **Stale in-progress**: Tasks marked "in_progress" for more than 7 days
- **Sprint slippage**: If cycle completion % is behind expected pace

Present as:
- **Critical** (7+ days overdue): Needs immediate attention
- **Overdue** (1-7 days): Should address soon
- **At Risk**: In-progress items that might slip
- **Projects Off Track**: Projects needing intervention

For each item, suggest: reschedule, delegate, or drop.
When rescheduling execution time, keep `dueDate` as the deadline/day marker and use `schedule_issue` to add a new issue calendar block. Do not overwrite existing calendar blocks unless the user explicitly asks.

If $ARGUMENTS contains "critical" or "urgent", only show critical items.
