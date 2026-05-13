---
name: weekly-plan
description: Plan the week in LifeOS and apply mutations to due dates, current cycle goals, cycle assignments, priorities, and weekly/daily notes
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
   - Schedule work across the week using `dueDate`.
   - Set near-term top priorities.
   - Keep today concrete enough to execute from the Agenda Daily view.
3. Call `apply_planning_patch` with `mode="week"` and `dryRun=false`.

Useful `apply_planning_patch` operations:
- `create_issue` for new work.
- `schedule_issue` or `update_issue` for due date, status, priority, estimate, and title changes.
- `assign_issue_to_current_cycle` for work included in the active cycle.
- `set_top_priority` for immediate focus.
- `update_cycle_goals` for the current cycle.
- `save_weekly_note` for the readable weekly plan.
- `save_daily_note` when today needs a concrete execution plan.
- `add_issue_comment` for planning rationale that belongs on a task.

Do not ask for confirmation after this skill is invoked. The user expects this workflow to mutate LifeOS.

After applying, report:
- Current cycle goal and focus.
- The week-by-day task plan.
- Tasks created, scheduled, or reassigned.
- Notes saved or updated.
- Risks, overload, or unresolved ambiguity.
