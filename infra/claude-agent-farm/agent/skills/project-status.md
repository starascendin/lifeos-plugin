Get project status. $ARGUMENTS should be a project key like "ACME" or project name.

Use the lifeos-prod MCP tools:

1. Call `get_project` with the project key/ID from $ARGUMENTS
2. Call `get_phases` for the project to see phase breakdown
3. Call `get_tasks` filtered by the project ID to see all issues

Present a project status report:
- **Overview**: Name, status, health, priority, client (if linked)
- **Phases**: Each phase with status and issue counts
- **Task Breakdown**: Count by status (backlog / todo / in_progress / in_review / done)
- **Urgent/Overdue**: Any urgent or overdue tasks
- **In Progress**: What's actively being worked on
- **Blockers**: Anything that looks stuck

If no project is specified in $ARGUMENTS, call `get_projects` and list all active projects, then ask which one.
