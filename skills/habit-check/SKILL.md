---
name: habit-check
description: Daily habit check-in - review today's habits, mark completions, celebrate streaks, flag missed reps
---

Run a daily habit check-in. Use the LifeOS MCP tools to:

1. Call `get_habits_for_date` with today's date (or $ARGUMENTS if a date is provided) to see all scheduled habits and their status
2. Call `get_habits` to see the full habit list with streak data

Present a clear habit dashboard:

**TODAY'S HABITS**
For each habit scheduled today, show:
- Icon + Name
- Status: completed / pending / skipped / incomplete
- Current streak (e.g., "🔥 12 days")

**COMPLETION RATE**
- X/Y habits completed today (percentage)

**STREAK ALERTS**
- Flag any habits with active streaks (3+ days) that are still pending — these are "streak at risk"
- Call out any streaks that were broken yesterday

**NEVER SKIP A REP**
- If any habits are pending, list them with direct accountability:
  - "You haven't done X yet today. Your streak is at Y days. Don't break it."
- If all habits are done, celebrate: "All habits completed. No reps skipped."

If $ARGUMENTS contains specific habit names or check-in instructions (e.g., "mark meditation done"), use `check_in_habit` to mark them completed for today's date.

Tone: Direct, like a personal trainer. No fluff. Celebrate wins, call out misses.
