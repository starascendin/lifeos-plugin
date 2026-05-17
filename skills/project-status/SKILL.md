---
name: project-status
description: Project status report with phases, task breakdown, blockers, and urgent items
---

Get project status. $ARGUMENTS should be a project key like "ACME" or project name.

Use the LifeOS MCP tools:

1. Call get_project with the project key/ID from $ARGUMENTS
2. Call get_phases for the project to see phase breakdown
3. Call get_tasks filtered by the project ID to see all issues
4. When the user asks how this project connects to PPV, call `falkor_graph_schema`, then use `falkor_graph_query` for the sidecar graph neighborhood.
5. If you identify an important missing PPV/project relationship, use `falkor_graph_link` with a clear reason and confidence. Do not mutate project fields through FalkorDB.

Present a project status report:
- **Overview**: Name, status, health, priority, client (if linked)
- **Phases**: Each phase with status and issue counts
- **Task Breakdown**: Count by status (backlog / todo / in_progress / in_review / done)
- **Urgent/Overdue**: Any urgent or overdue tasks
- **In Progress**: What's actively being worked on
- **Blockers**: Anything that looks stuck
- **Graph Context**: Any FalkorDB sidecar relationships that explain why this project matters or what it connects to

If no project is specified in $ARGUMENTS, call get_projects and list all active projects, then ask which one.
