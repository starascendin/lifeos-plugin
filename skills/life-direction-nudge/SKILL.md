---
name: life-direction-nudge
description: Proactive drift-detection check — are you drifting from what matters? Run daily or on-demand.
---

Run a quick life direction drift check. This is designed to run daily (via scheduled agent) or on-demand when you want a reality check.

## Step 1: Pull Drift Indicators

Gather data in parallel using LifeOS MCP tools:
1. `get_pillar_pulse_latest` — current pillar ratings
2. `get_working_memory` section "patterns" — known behavioral patterns
3. `get_working_memory` section "triggers" — known triggers
4. `get_habits_for_date` with today's date — did you do your habits today?
5. `get_coaching_action_items` with status "pending" — overdue action items
6. `get_screentime_summary` for yesterday — screen time breakdown
7. `get_health_sleep` for last 3 days — sleep trend
8. `get_health_readiness` for last 3 days — readiness trend
9. `get_curiosities` — any captured items older than 14 days that haven't been acted on

## Step 2: Drift Detection

Analyze for these drift signals:

### Red Flags (immediate attention)
- Any pillar rated 1 that hasn't improved
- Screen time >6 hours/day for 3+ consecutive days
- Sleep score declining 3 days in a row
- Zero social activities in the past week (check agenda/habits)
- Coaching action items overdue by >7 days
- All time spent on computer/coding, zero on identified hobbies

### Yellow Flags (worth noting)
- Screen time 4-6 hours
- Habits completion rate below 50%
- Curiosities sitting in "captured" for 14+ days
- No pillar pulse recorded in the past 7 days
- Readiness score trending down

### Green Signals (celebrate these)
- Any habit streak >7 days
- Social activity completed
- Curiosity moved from "captured" to "exploring"
- Pillar pulse improved from last check
- Screen time under 3 hours

## Step 3: The Nudge

Based on drift signals, deliver ONE focused nudge:

If red flags detected:
- Be direct: "You said you wanted X but your data shows Y. What's going on?"
- Surface the specific pattern from working memory that's playing out
- Propose one tiny action for TODAY (not this week — today)

If yellow flags:
- Gentle reminder: "Your [pillar] has been at [rating] for a while. What's one thing you could do today?"
- Surface a relevant curiosity: "You captured [curiosity] X days ago. Still interesting?"

If mostly green:
- Celebrate: "Your [habit] streak is at X days. Nice."
- Challenge to level up: "What's the next experiment you want to run?"

## Step 4: One Action

Create exactly ONE coaching action item with `create_coaching_action_item`:
- Must be completable TODAY
- Must address the most pressing drift signal
- Should be small enough that "I'm busy" isn't a valid excuse

If a curiosity was surfaced, mark it with `surface_curiosity`.

## Style
- Keep it SHORT. This is a daily nudge, not a full session.
- Be direct and specific — use actual numbers from the data.
- Don't lecture. One observation, one nudge, one action.
- If everything looks good, say so and keep it to 3 sentences.
