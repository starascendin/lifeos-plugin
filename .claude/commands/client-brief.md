Get a full client briefing. $ARGUMENTS should be the client name or ID.

Use the lifeos-prod MCP tools:

1. Call `get_clients` to find the matching client
2. Call `get_client` with the client ID for full details
3. Call `get_projects_for_client` to see all their projects and completion stats
4. Call `get_beeper_threads_for_client` to see linked chat threads

For each active project, also call `get_phases` to see phase breakdown.

Present as a client brief:
- **Client Overview**: Name, status, description
- **Projects**: Each project with status, health, priority, and phase breakdown
- **Completion Stats**: Issues done vs total across all projects
- **Recent Comms**: Latest Beeper thread activity
- **Action Items**: Any overdue or urgent tasks for this client

If no client is specified in $ARGUMENTS, list all active clients and ask which one.
