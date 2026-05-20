---
name: sprint-plan
description: Plan the current sprint/current cycle with tasks, protected calendar blocks, cycle goals, and priorities
---

Help me plan my sprint/current cycle in LifeOS and apply the resulting changes.
This is a mutating workflow.

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
   - Time-block task-backed work with `schedule_issue` or `update_issue` using
     `scheduledStartAt` and `scheduledEndAt` ISO datetimes, or
     `date`/`scheduledDate` plus `startTime` and `endTime`.
   - Create protected non-ticket calendar blocks with `create_calendar_block`
     for time that should shape cycle capacity but should not create a PM issue,
     such as dog walking, recurring focus blocks, appointments, travel, or holds.
   - Set top priorities for immediate focus.
   - Avoid overloading the active cycle.
3. Call `apply_planning_patch` with `mode="cycle"` and `dryRun=false`.

Useful `apply_planning_patch` operations:

- `create_issue` for new work.
- `create_calendar_block` for protected non-ticket calendar-only time. Payload
  must include `title`, `timezone`, and either `startAt`/`endAt` ISO datetimes
  or `date` plus local `startTime`/`endTime`; optional fields include
  `blockType`, `source`, and `isProtected`.
- `assign_issue_to_current_cycle` for selected cycle work.
- `schedule_issue` or `update_issue` for due date, scheduled start/end time,
  status, priority, estimate, and title changes.
- `set_top_priority` for immediate focus.
- `update_cycle_goals` for the active cycle.
- `save_weekly_note` or `save_daily_note` when useful as the readable plan
  artifact.

Calendar decision rule:

- Use `create_calendar_block` for protected personal or planning time that is not
  execution work and should not become a task: dog walking, commute buffers,
  appointments, recurring focus blocks, calendar holds, travel, or recovery time.
  Default to `isProtected=true`; use `blockType="focus"` for focus blocks,
  `blockType="personal"` for dog walking or personal care, `blockType="travel"`
  for travel, and `blockType="hold"` for tentative protected holds.
- Use `create_issue` for new execution work that needs task tracking, ownership,
  status, priority, project/cycle assignment, comments, or completion history.
- Use `schedule_issue` or `update_issue` when an existing or newly created
  task-backed item needs a due date or scheduled calendar time.

Do not ask for confirmation after this skill is invoked. The user expects this
workflow to mutate LifeOS.

After applying, report:

- Current cycle goal and capacity.
- Tasks assigned, created, or scheduled.
- Protected calendar blocks created.
- Top priorities.
- Any risks or overload.
