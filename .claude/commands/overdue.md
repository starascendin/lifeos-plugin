Show what's overdue or slipping. Use lifeos-prod MCP tools.

1. Call `get_tasks` to get all tasks
2. Call `get_projects` to get all projects with health status
3. Call `get_current_cycle` to see sprint status

Analyze and identify:
- **Overdue tasks**: Tasks past their due date (compare dueDate to today)
- **Off-track projects**: Projects with health = "off_track" or "at_risk"
- **Stale in-progress**: Tasks marked "in_progress" for more than 7 days
- **Sprint slippage**: If cycle completion % is behind expected pace

Present as:
- **Critical** (7+ days overdue): Needs immediate attention
- **Overdue** (1-7 days): Should address soon
- **At Risk**: In-progress items that might slip
- **Projects Off Track**: Projects needing intervention

For each item, suggest: reschedule, delegate, or drop.

If $ARGUMENTS contains "critical" or "urgent", only show critical items.
