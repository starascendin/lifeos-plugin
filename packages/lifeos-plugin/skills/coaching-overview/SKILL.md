---
name: coaching-overview
description: Dashboard of coaching profiles, recent sessions, and pending action items
---

Show me a coaching dashboard. Use the LifeOS MCP tools:

1. Call get_coaching_profiles to list all coach personas
2. Call get_coaching_sessions with limit=10 for recent sessions across all coaches
3. Call get_coaching_action_items with status "pending" for outstanding action items

Present a coaching overview:
- **Coaches**: List each coach profile with name, focus areas, and session cadence
- **Recent Sessions**: Show recent sessions grouped by coach, with title, date, and status
- **Pending Action Items**: Count of pending items per coach, with the top 3 most urgent items shown
- **Insights**: Which coaches are most active, any overdue action items, suggested next sessions

Keep it concise and actionable.
