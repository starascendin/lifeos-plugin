---
name: daily-plan
description: Plan the day in LifeOS and apply mutations to due dates, top priorities, current-cycle assignments, and the Daily Note
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
   - Schedule tasks by setting `dueDate`.
   - Pull relevant backlog work into the current cycle.
   - Update current cycle goals if the plan changes the cycle focus.
   - Keep the plan realistic against today's calendar and current cycle load.
3. Call `apply_planning_patch` with `mode="day"` and `dryRun=false`.

Useful `apply_planning_patch` operations:

- `create_issue` for new tasks.
- `schedule_issue` or `update_issue` for due date, status, priority, estimate, and title changes.
- `assign_issue_to_current_cycle` for work that belongs in the active cycle.
- `set_top_priority` for today's top 3.
- `update_cycle_goals` when the active cycle goal should change.
- `save_daily_note` to write the final readable day plan into the Agenda Daily Note.
- `add_issue_comment` for planning rationale that belongs on a task.
- `add_daily_ai_comment` for AI-only observations, planning rationale, risks, or coaching notes that should appear in Daily AI Comments.

Do not ask for confirmation after this skill is invoked. The user expects this workflow to mutate LifeOS.

After applying, report:

- Today's top 3.
- Tasks created, scheduled, or reassigned.
- Current cycle changes.
- The Daily Note that was saved or updated.
