---
name: daily-plan
description: Plan the day in LifeOS with tasks, protected calendar blocks, priorities, cycle assignments, and the Daily Note
---

Plan my day in LifeOS and apply the resulting changes. This is a mutating workflow.

Use the LifeOS MCP tools:

1. Call `get_planning_context` with:
   - `date` from `$ARGUMENTS` when provided
   - `include.daily=true`
   - `include.weekly=true`
   - `include.currentCycle=true`
   - `include.backlog=true`
   - `include.habits=true`
   - `include.dailyFields=true`
   - `include.calendar=true`
   - `include.voiceMemos=true`
2. Build a practical day plan:
   - Pick today's top 3.
   - Assign tasks to today by setting `dueDate`.
   - Time-block task-backed work by using `schedule_issue` or `update_issue`
     with `scheduledStartAt` and `scheduledEndAt` ISO datetimes, or with
     `date`/`scheduledDate` plus `startTime` and `endTime`.
   - Create protected non-ticket calendar blocks with `create_calendar_block`
     for time that should appear on the calendar but should not create a PM
     issue, such as dog walking, meals, errands, personal appointments, focus
     blocks, or holds.
   - Pull relevant backlog work into the current cycle.
   - Update current cycle goals if the plan changes the cycle focus.
   - Keep the plan realistic against today's calendar and current cycle load.
3. Call `apply_planning_patch` with `mode="day"` and `dryRun=false`.

Useful `apply_planning_patch` operations:

- `create_issue` for new tasks.
- `create_calendar_block` for protected non-ticket calendar-only time. Payload
  must include `title`, `timezone`, and either `startAt`/`endAt` ISO datetimes
  or `date` plus local `startTime`/`endTime`; optional fields include
  `blockType`, `source`, and `isProtected`.
- `schedule_issue` or `update_issue` for due date, scheduled start/end time,
  status, priority, estimate, and title changes.
- `assign_issue_to_current_cycle` for work that belongs in the active cycle.
- `set_top_priority` for today's top 3.
- `update_cycle_goals` when the active cycle goal should change.
- `save_daily_note` to write the final readable day plan into the Agenda Daily
  Note.
- `add_issue_comment` for planning rationale that belongs on a task.
- `add_daily_ai_comment` for AI-only observations, planning rationale, risks, or
  coaching notes that should appear in Daily AI Comments.

Calendar decision rule:

- Use `create_calendar_block` for protected personal or planning time that is not
  execution work and should not become a task: dog walking, lunch, commute
  buffers, medical appointments, focus blocks, calendar holds, or recovery time.
  Default to `isProtected=true`; use `blockType="focus"` for focus blocks,
  `blockType="personal"` for dog walking or personal care, and
  `blockType="hold"` for tentative protected holds.
- Use `create_issue` for new execution work that needs task tracking, ownership,
  status, priority, project/cycle assignment, comments, or completion history.
- Use `schedule_issue` or `update_issue` when an existing or newly created
  task-backed item needs a due date or scheduled calendar time.

Do not ask for confirmation after this skill is invoked. The user expects this
workflow to mutate LifeOS.

After applying, report:

- Today's top 3.
- Tasks created, scheduled, or reassigned.
- Protected calendar blocks created.
- Current cycle changes.
- The Daily Note that was saved or updated.
