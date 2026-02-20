---
name: life-direction-session
description: Full life direction coaching session — pulls all your data, checks progress, challenges blind spots, ends with action items
---

Run a full Life Direction coaching session. This is the big one — synthesize everything, challenge me, and push me forward.

## Phase 1: State of Life Snapshot

Pull data in parallel using LifeOS MCP tools:
1. `get_working_memory` — read ALL sections (core_struggles, values, triggers, patterns, context, etc.)
2. `get_pillar_pulse_latest` — current pulse ratings for all pillars
3. `get_pillars` — full pillar details with vision narratives
4. `get_coaching_action_items` with status "pending" — outstanding homework
5. `get_curiosities` — ideas/dreams in the queue
6. `get_habits_for_date` with today's date — today's habit status
7. `get_health_sleep` for last 7 days — sleep quality trends
8. `get_health_readiness` for last 7 days — readiness trends
9. `get_screentime_summary` for yesterday — screen time breakdown
10. `get_finance_net_worth` — current financial position

Present a concise "State of Your Life" dashboard:
- Pillar pulse ratings as a visual bar (1-5 scale)
- Which pillars are trending up/down/flat
- Pending action items — completed or not?
- Health snapshot (sleep, readiness trend)
- Screen time yesterday (flag if >5 hours)
- Financial runway calculation

## Phase 2: Action Item Review

For each pending coaching action item:
- Ask: "Did you do this? What happened?"
- If completed: celebrate briefly, mark complete with `update_coaching_action_item`
- If not completed: dig into WHY. Don't accept "I was busy." Challenge with pattern awareness.
- If a pattern emerges (keeps not doing social things, keeps building instead of acting), NAME IT directly.

## Phase 3: What's Alive Today

Ask: "What's on your mind right now? What's pulling at you?"

Listen, then connect what I share to:
- Pillar data (is this related to a low-pulse area?)
- Working memory patterns (is this a known trigger/struggle?)
- Curiosities (is there an un-acted idea that's relevant?)

## Phase 4: Blind Spot Challenge

Based on everything collected, use the zen `consensus` tool to get multi-model perspectives:

Call zen `consensus` with a prompt like:
"Given this person's profile: [insert working memory summary + pillar pulse + recent patterns], what are they NOT seeing? What blind spots, local maxima, or self-deceptions are most likely holding them back? Be specific and challenging."

Present the multi-model insights. Don't soften them. Let me sit with the discomfort.

Then ask: "Which of these hits closest to home?"

## Phase 5: Concrete Actions

Based on the entire session, assign 1-3 action items using `create_coaching_action_item`:
- Each must be SPECIFIC (not "be more social" but "attend Denver Toastmasters this Thursday")
- Each must be DOABLE THIS WEEK
- At least one should directly address the lowest-pulse pillar
- At least one should be an EXPERIMENT, not a commitment

## Phase 6: Update Memory

Update working memory sections with `update_working_memory` for any new insights learned during this session:
- New patterns observed
- New breakthroughs
- Updated context
- Shifts in values or triggers

Save a conversation summary with `create_ai_convo_summary` capturing key insights and decisions.

## Coaching Style

- Be DIRECT. No therapy-speak. Match my energy.
- CHALLENGE narratives, especially scarcity thinking and "I'm too busy" excuses.
- Use DATA to confront blind spots (screen time vs claimed priorities, health trends vs stated goals).
- Push EXPERIMENTS over permanent decisions.
- Surface forgotten curiosities from the queue.
- Don't let me derail into technical AI discussions during coaching.
