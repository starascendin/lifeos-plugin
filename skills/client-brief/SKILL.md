---
name: client-brief
description: Full client briefing with projects, phases, completion stats, and recent communications
---

Get a full client briefing. $ARGUMENTS should be the client name or ID.

Use the LifeOS MCP tools:

1. Call get_clients to find the matching client
2. Call get_client with the client ID for full details
3. Call get_projects_for_client to see all their projects and completion stats
4. Call get_beeper_threads_for_client to see linked chat threads
5. When the user needs PPV/project graph context, call `falkor_graph_schema`, then use `falkor_graph_query` to inspect Falkor graph links between PPV context and projects.

For each active project, also call get_phases to see phase breakdown.

Use `falkor_graph_link` only when you find a durable PPV/project relationship that should be remembered but should not mutate Convex canonical records. Always include `reason` and `confidence`.

Present as a client brief:
- **Client Overview**: Name, status, description
- **Projects**: Each project with status, health, priority, and phase breakdown
- **Completion Stats**: Issues done vs total across all projects
- **Recent Comms**: Latest Beeper thread activity
- **Graph Context**: Relevant FalkorDB sidecar relationships across PPV and projects
- **Action Items**: Any overdue or urgent tasks for this client

If no client is specified in $ARGUMENTS, list all active clients and ask which one.
