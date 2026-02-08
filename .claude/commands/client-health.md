Show health dashboard across all clients. Use lifeos-prod MCP tools.

1. Call `get_clients` to get all active clients
2. For each client, call `get_projects_for_client` to get project stats
3. Call `get_tasks` to analyze overdue/at-risk tasks per client
4. Call `get_beeper_threads` to check communication recency

Calculate health score for each client based on:
- **Project health**: Are projects on_track, at_risk, or off_track?
- **Task completion**: % of tasks done vs total
- **Overdue items**: Number of overdue tasks
- **Communication**: Days since last message/meeting
- **Revenue risk**: Active projects nearing completion without follow-on

Present as a dashboard:
| Client | Health | Projects | Overdue | Last Contact | Action |
|--------|--------|----------|---------|--------------|--------|

Then detail:
- **Healthy clients**: All good, maintain relationship
- **At-risk clients**: Need attention soon (explain why)
- **Critical clients**: Immediate action needed

For at-risk and critical, provide specific recommended actions.

If $ARGUMENTS contains "critical", only show at-risk and critical clients.
