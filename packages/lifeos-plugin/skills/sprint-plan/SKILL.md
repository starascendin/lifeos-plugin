---
name: sprint-plan
description: Plan the current sprint by reviewing backlog, assigning tasks to cycle, and checking capacity
---

Help me plan my sprint. Use the LifeOS MCP tools:

1. Call `get_current_cycle` to see the active sprint and its current state
2. Call `get_tasks` with status "backlog" to see unplanned work
3. Call `get_tasks` with status "todo" to see already planned work
4. Call `get_projects` with status "in_progress" to see active projects

Then help me plan:
- Show current sprint capacity (what's already assigned vs. remaining)
- List backlog items by priority, grouped by project
- Suggest which backlog items to pull into the sprint based on priority
- If I provide specific tasks or descriptions in $ARGUMENTS, create issues and assign them to the current cycle

Ask me to confirm before creating or assigning any issues.
