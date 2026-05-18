---
name: sprint-plan
description: Plan the current sprint/current cycle and apply mutations to cycle goals, task assignments, priorities, and due dates
---

Help me plan my sprint/current cycle in LifeOS and apply the resulting changes. This is a mutating workflow.

Use the LifeOS MCP tools:

1. Call `get_planning_context` with:
   - `include.currentCycle=true`
   - `include.backlog=true`
   - `include.weekly=true`
   - `include.daily=true`
2. Build a cycle plan:
   - Update cycle goals when the focus needs to change.
   - Pull appropriate backlog work into the current cycle.
   - Assign near-term work to days with `dueDate`.
   - Time-block concrete work with `scheduledStartAt` and `scheduledEndAt` ISO datetimes, or `startTime` and `endTime` plus `scheduledDate` in `schedule_issue`.
   - Set top priorities for immediate focus.
   - Avoid overloading the active cycle.
3. Call `apply_planning_patch` with `mode="cycle"` and `dryRun=false`.

Useful `apply_planning_patch` operations:
- `create_issue` for new work.
- `assign_issue_to_current_cycle` for selected cycle work.
- `schedule_issue` or `update_issue` for due date, scheduled start/end time, status, priority, estimate, and title changes.
- `set_top_priority` for immediate focus.
- `update_cycle_goals` for the active cycle.
- `save_weekly_note` or `save_daily_note` when useful as the readable plan artifact.

Do not ask for confirmation after this skill is invoked. The user expects this workflow to mutate LifeOS.

After applying, report:
- Current cycle goal and capacity.
- Tasks assigned, created, or scheduled.
- Top priorities.
- Any risks or overload.
