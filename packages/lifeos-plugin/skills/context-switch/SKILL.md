---
name: context-switch
description: Quickly load context for a client or project for fast mental context switching
---

Quickly load context for a client or project. $ARGUMENTS should be the client or project name.

Use the Bash tool to run lifeos CLI commands:

**If $ARGUMENTS looks like a client name:**
1. Run: `lifeos get_clients` and find the matching client
2. Run: `lifeos get_client clientId=...` for details
3. Run: `lifeos get_projects_for_client clientId=...` to see their projects
4. Run: `lifeos get_beeper_threads_for_client clientId=...` for recent communications

**If $ARGUMENTS looks like a project name/key:**
1. Run: `lifeos get_project projectIdOrKey=...` with the project key/name
2. Run: `lifeos get_phases projectId=...` to see project phases
3. Run: `lifeos get_tasks projectId=...` to see active work
4. If project has a client, load client context too

Present a quick context brief:
- **Overview**: What this client/project is about
- **Current Status**: Active phase, health, completion %
- **Open Items**: Tasks in progress or todo (top 5)
- **Recent Activity**: Last meeting, last message (if available)
- **Blockers**: Anything stuck or overdue
- **Quick Actions**: Suggested next steps

Keep it scannable - this is for fast context loading, not deep analysis.

If $ARGUMENTS is empty, ask which client or project to load.

Each lifeos command outputs JSON. Parse the results accordingly.
