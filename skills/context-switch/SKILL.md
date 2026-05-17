---
name: context-switch
description: Quickly load context for a client or project for fast mental context switching
---

Quickly load context for a client or project. $ARGUMENTS should be the client or project name.

Use the LifeOS MCP tools:

**If $ARGUMENTS looks like a client name:**
1. Call get_clients and find the matching client
2. Call get_client with the client ID for details
3. Call get_projects_for_client to see their projects
4. Call get_beeper_threads_for_client for recent communications

**If $ARGUMENTS looks like a project name/key:**
1. Call get_project with the project key/name
2. Call get_phases for the project phases
3. Call get_tasks filtered by the project to see active work
4. If project has a client, load client context too

**For graph context:**
1. Call `falkor_graph_schema` when the user needs PPV/project connections or the context feels incomplete.
2. Use `falkor_graph_query` to inspect related PPV pillars, projects, and agent-created links.
3. Use `falkor_graph_link` only when you discover a durable relationship worth remembering and both endpoint nodes exist in Falkor; include `reason` and `confidence`.
4. Do not edit canonical records through FalkorDB.

Present a quick context brief:
- **Overview**: What this client/project is about
- **Current Status**: Active phase, health, completion %
- **Open Items**: Tasks in progress or todo (top 5)
- **Recent Activity**: Last meeting, last message (if available)
- **Graph Links**: Relevant FalkorDB sidecar relationships that explain adjacent PPV/project context
- **Blockers**: Anything stuck or overdue
- **Quick Actions**: Suggested next steps

Keep it scannable - this is for fast context loading, not deep analysis.

If $ARGUMENTS is empty, ask which client or project to load.
