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
5. For each active project, call `get_belief_reframes` with `projectIds: [project._id]` to surface linked fears, inversions, and limiting-belief friction records.
6. When the user needs PPV/project graph context, prefer `get_project_graph` for the relevant project because it includes PPV context and `belief_reframe` friction nodes. Use FalkorDB only for sidecar traversal or agent-owned relationship links.

For each active project, also call get_phases to see phase breakdown.

Use `falkor_graph_link` only when you find a durable PPV/project relationship that should be remembered but should not mutate Convex canonical records. Always include `reason` and `confidence`.

Present as a client brief:

- **Client Overview**: Name, status, description
- **Projects**: Each project with status, health, priority, and phase breakdown
- **Fears / Inversions**: Linked project friction records that may affect delivery, attention, or client risk
- **Completion Stats**: Issues done vs total across all projects
- **Recent Comms**: Latest Beeper thread activity
- **Graph Context**: Relevant FalkorDB sidecar relationships across PPV and projects
- **Action Items**: Any overdue or urgent tasks for this client

If no client is specified in $ARGUMENTS, list all active clients and ask which one.
