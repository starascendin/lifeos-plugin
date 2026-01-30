Get project status. $ARGUMENTS should be a project key like "ACME" or project name.

Use the Bash tool to run lifeos CLI commands:

1. Run: `lifeos get_project projectIdOrKey=$ARGUMENTS` with the project key/ID from $ARGUMENTS
2. Run: `lifeos get_phases projectId=<ID>` for the project to see phase breakdown
3. Run: `lifeos get_tasks projectId=<ID>` filtered by the project ID to see all issues

Present a project status report:
- **Overview**: Name, status, health, priority, client (if linked)
- **Phases**: Each phase with status and issue counts
- **Task Breakdown**: Count by status (backlog / todo / in_progress / in_review / done)
- **Urgent/Overdue**: Any urgent or overdue tasks
- **In Progress**: What's actively being worked on
- **Blockers**: Anything that looks stuck

If no project is specified in $ARGUMENTS, run `lifeos get_projects` and list all active projects, then ask which one.

Each lifeos command outputs JSON. Parse the results accordingly.
