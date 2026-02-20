---
name: pillar-pulse
description: Record or review pulse ratings for your life pillars
---

Help me do a pillar pulse check-in. Use the LifeOS MCP tools:

1. Call get_pillars to list all active pillars
2. Call get_pillar_pulse_latest to see the most recent ratings

Then guide me through rating each pillar:
- Show each pillar name and its last rating
- Ask me to rate each one 1-5 (1=dead, 5=thriving) with an optional note
- Call record_pillar_pulse for each rating I provide

After all ratings are recorded:
- Show a before/after comparison if previous ratings exist
- Highlight any big changes (±2 or more)
- Note any pillars trending down over time

Keep it conversational and non-judgmental. This is about awareness, not optimization.
