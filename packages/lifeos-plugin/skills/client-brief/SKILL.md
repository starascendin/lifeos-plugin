---
name: client-brief
description: Full client briefing with projects, phases, completion stats, and recent communications
---

Get a full client briefing. $ARGUMENTS should be the client name or ID.

Use the Bash tool to run lifeos CLI commands:

1. Run: `lifeos get_clients` to find the matching client
2. Run: `lifeos get_client clientId=<ID>` with the client ID for full details
3. Run: `lifeos get_projects_for_client clientId=<ID>` to see all their projects and completion stats
4. Run: `lifeos get_beeper_threads_for_client clientId=<ID>` to see linked chat threads

For each active project, also run: `lifeos get_phases projectId=<ID>` to see phase breakdown.

Present as a client brief:
- **Client Overview**: Name, status, description
- **Projects**: Each project with status, health, priority, and phase breakdown
- **Completion Stats**: Issues done vs total across all projects
- **Recent Comms**: Latest Beeper thread activity
- **Action Items**: Any overdue or urgent tasks for this client

If no client is specified in $ARGUMENTS, list all active clients and ask which one.

Each lifeos command outputs JSON. Parse the results accordingly.
