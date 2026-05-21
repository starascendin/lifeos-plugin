---
name: project-status
description: Project status report with phases, task breakdown, blockers, and urgent items
---

Get project status. $ARGUMENTS should be a project key like "ACME" or project name.

Use the LifeOS MCP tools:

1. Call get_project with the project key/ID from $ARGUMENTS
2. Call get_phases for the project to see phase breakdown
3. Call get_tasks filtered by the project ID to see all issues
4. Call `get_belief_reframes` with `projectIds: [project._id]` to surface linked fears, inversions, and limiting-belief friction records.
5. When the user asks how this project connects to PPV, prefer `get_project_graph` because it includes PPV context and `belief_reframe` friction nodes.
6. Use FalkorDB only for sidecar PPV/project traversal or agent-owned graph links: call `falkor_graph_schema`, then `falkor_graph_query`; use `falkor_graph_link` with a clear reason and confidence only for missing durable relationships. Do not mutate project fields through FalkorDB.

Present a project status report:

- **Overview**: Name, status, health, priority, client (if linked)
- **Phases**: Each phase with status and issue counts
- **Task Breakdown**: Count by status (backlog / todo / in_progress / in_review / done)
- **Urgent/Overdue**: Any urgent or overdue tasks
- **In Progress**: What's actively being worked on
- **Blockers**: Anything that looks stuck
- **Fears / Inversions**: Linked friction records that may explain risk, avoidance, or operating constraints
- **Graph Context**: Any FalkorDB sidecar relationships that explain why this project matters or what it connects to

If no project is specified in $ARGUMENTS, call get_projects and list all active projects, then ask which one.
