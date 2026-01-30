---
name: sprint-plan
description: Plan the current sprint by reviewing backlog, assigning tasks to cycle, and checking capacity
---

Help me plan my sprint. Use the Bash tool to run lifeos CLI commands:

1. Run: `lifeos get_current_cycle` to see the active sprint and its current state
2. Run: `lifeos get_tasks status=backlog` to see unplanned work
3. Run: `lifeos get_tasks status=todo` to see already planned work
4. Run: `lifeos get_projects status=in_progress` to see active projects

Then help me plan:
- Show current sprint capacity (what's already assigned vs. remaining)
- List backlog items by priority, grouped by project
- Suggest which backlog items to pull into the sprint based on priority
- If I provide specific tasks or descriptions in $ARGUMENTS, create issues and assign them to the current cycle:
  - Run: `lifeos create_issue title="Task title" priority=high projectIdOrKey=PROJ`
  - Run: `lifeos assign_issue_to_cycle issueIdOrIdentifier=PROJ-123`

Ask me to confirm before creating or assigning any issues.

Each lifeos command outputs JSON. Parse the results accordingly.
