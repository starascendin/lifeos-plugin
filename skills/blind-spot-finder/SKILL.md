---
name: blind-spot-finder
description: Multi-model council to find your blind spots, local maxima, and self-deceptions
---

Use multiple AI models to find what I'm NOT seeing. This is about the unknown unknowns.

## Step 1: Gather Context

Pull data in parallel using LifeOS MCP tools:
1. `get_working_memory` — ALL sections
2. `get_pillar_pulse_latest` — current ratings
3. `get_pillars` — full vision narratives and current reality
4. `get_curiosities` — what's captured but not acted on
5. `get_coaching_action_items` with status "pending" — incomplete homework
6. `get_habits` — habits and their completion rates
7. `get_screentime_summary` for the last 3 days
8. `get_health_sleep` for the last 14 days
9. `get_finance_net_worth` — financial position

## Step 2: Build the Blind Spot Brief

Compile a comprehensive brief of my current situation including:
- All pillar ratings with current reality vs desired feeling gaps
- Working memory patterns and triggers
- What I say I want vs what my data shows I actually do
- Curiosities that have been sitting in "captured" for weeks
- Action items I keep not completing
- Screen time vs stated priorities
- Any say-do gaps visible in the data

## Step 3: Multi-Model Council

Use the zen `consensus` tool with this prompt structure:

**Round 1 — Blind Spot Detection:**
"Here is a detailed profile of a person: [insert brief].

Identify the top 3-5 blind spots this person likely has. Focus on:
- Self-deceptions they're maintaining
- Local maxima they're stuck in
- Assumptions they haven't questioned
- Patterns they can't see because they're inside them
- Things they SAY they want but systematically avoid

Be brutally honest. This person explicitly wants to be challenged, not comforted."

**Round 2 — Pattern Challenge:**
Use the zen `challenge` tool:
"This person has identified these patterns about themselves: [insert patterns from working memory].

Challenge each pattern: Is their self-diagnosis accurate, or is THAT diagnosis itself a blind spot? What if the real issue is something they haven't named? Propose alternative framings that might unlock new action."

## Step 4: Synthesize

Present the findings organized as:

### Confirmed Blind Spots (models agree)
Things multiple models flagged — these are high-confidence insights.

### Contested Insights (models disagree)
Where models disagreed — present both sides. The disagreement itself is informative.

### The Uncomfortable Questions
Synthesize 3-5 questions that emerged from the analysis. These should be questions that make me squirm — that's how I know they're hitting something real.

### Reframes
For each major blind spot, offer an alternative way to see the situation. Not advice — just a different lens.

## Step 5: Choose One to Act On

Ask: "Which of these landed? Pick ONE blind spot to work on this week."

Then create a coaching action item with `create_coaching_action_item` — a specific experiment to test whether this blind spot is real.

Update working memory with `update_working_memory` if any genuinely new insight emerged.
