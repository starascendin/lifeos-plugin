---
name: weekly-plan
description: Plan the week in LifeOS with tasks, protected calendar blocks, cycle goals, priorities, and weekly/daily notes
---

Plan my week in LifeOS and apply the resulting changes. This is a mutating workflow.

Use the LifeOS MCP tools:

1. Call `get_planning_context` with:
   - `weekStartDate` from `$ARGUMENTS` when provided
   - `include.daily=true`
   - `include.weekly=true`
   - `include.currentCycle=true`
   - `include.backlog=true`
   - `include.habits=true`
   - `include.dailyFields=true`
   - `include.calendar=true`
   - `include.voiceMemos=true`
2. Build a week plan around the active current cycle:
   - Update the active cycle goals when needed.
   - Assign selected backlog tasks to the current cycle.
   - Assign work to days across the week using `dueDate`.
   - Time-block task-backed work with `schedule_issue` or `update_issue` using
     `scheduledStartAt` and `scheduledEndAt` ISO datetimes, or
     `date`/`scheduledDate` plus `startTime` and `endTime`.
   - Create protected non-ticket calendar blocks with `create_calendar_block`
     for time that belongs on the calendar but should not create a PM issue,
     such as dog walking, meals, errands, personal appointments, focus blocks,
     travel, or holds.
   - Set near-term top priorities.
   - Keep today concrete enough to execute from the Agenda Daily view.
3. Call `apply_planning_patch` with `mode="week"` and `dryRun=false`.

Useful `apply_planning_patch` operations:

- `create_issue` for new work.
- `create_calendar_block` for protected non-ticket calendar-only time. Payload
  must include `title`, `timezone`, and either `startAt`/`endAt` ISO datetimes
  or `date` plus local `startTime`/`endTime`; optional fields include
  `blockType`, `source`, and `isProtected`.
- `schedule_issue` or `update_issue` for due date, scheduled start/end time,
  status, priority, estimate, and title changes.
- `assign_issue_to_current_cycle` for work included in the active cycle.
- `set_top_priority` for immediate focus.
- `update_cycle_goals` for the current cycle.
- `save_weekly_note` for the readable weekly plan.
- `save_daily_note` when today needs a concrete execution plan.
- `add_issue_comment` for planning rationale that belongs on a task.
- `add_weekly_ai_comment` for AI-only weekly observations, planning rationale,
  risks, or coaching notes that should appear in Weekly AI Comments.

Calendar decision rule:

- Use `create_calendar_block` for protected personal or planning time that is not
  execution work and should not become a task: dog walking, lunch, commute
  buffers, medical appointments, focus blocks, calendar holds, or recovery time.
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

- Current cycle goal and focus.
- The week-by-day task plan.
- Tasks created, scheduled, or reassigned.
- Protected calendar blocks created.
- Notes saved or updated.
- Weekly AI Comments added.
- Risks, overload, or unresolved ambiguity.
