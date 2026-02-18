---
name: daily-training-report
description: Comprehensive daily training report - yesterday's results, today's focus, habit compliance, health data, ADHD focus management
---

Generate a comprehensive daily training report. This is your personal trainer's daily briefing.

Use the LifeOS MCP tools to gather ALL of this data:

1. **Yesterday's Habits**: Call `get_habits_for_date` with yesterday's date
2. **Today's Habits**: Call `get_habits_for_date` with today's date
3. **All Habits**: Call `get_habits` for streak overview
4. **Sleep**: Call `get_health_sleep` with days=1
5. **Readiness**: Call `get_health_readiness` with days=1
6. **Activity**: Call `get_health_activity` with days=1
7. **Today's Agenda**: Call `get_daily_agenda`
8. **Today's Tasks**: Call `get_todays_tasks`
9. **Initiatives**: Call `get_initiatives` for yearly goal progress
10. **Action Items**: Call `get_coaching_action_items` for pending coaching items

Synthesize into this report structure:

---

**YESTERDAY'S RESULTS**
- Habit scorecard: X/Y completed (list each habit with status)
- Streaks maintained or broken (call out any broken streaks explicitly)
- Health: Sleep score, Readiness score, Activity score from Oura
- Rate the day: Based on habit completion + health scores

**TODAY'S GAME PLAN**
- Top 3 priorities (from agenda + top priority tasks)
- Habits scheduled for today (with streak counts)
- Calendar events / meetings
- Overdue items that need attention

**ACCOUNTABILITY (No BS)**
- Any habits skipped or missed yesterday — call these out by name
- "Never skip a rep" — list any habits with active streaks that haven't been checked in yet today
- Streak warnings: habits approaching milestone streaks (7, 14, 21, 30 days)

**ADHD FOCUS CHECK**
- Look at today's tasks and compare against initiatives/yearly goals
- Flag tasks that are "busy work" (not linked to any initiative) vs "real progress" (linked to initiatives)
- If most tasks are client work with no personal goal work: flag it
- Suggest 1-2 focus blocks for deep work on personal goals/curiosities

**BODY CHECK** (from Oura data)
- Sleep quality: score + hours + any issues
- Recovery: readiness score + what it means for today
- Recommendation: Based on readiness, should today be a push day or recovery day?

---

Keep it direct and blunt. This is a personal trainer report — not a suggestion, it's marching orders.

If $ARGUMENTS contains a specific date, use that as "today" and the day before as "yesterday".
