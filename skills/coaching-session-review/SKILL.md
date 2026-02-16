---
name: coaching-session-review
description: Review a coaching session's summary, key insights, and action items
---

Review a coaching session in depth. Use the LifeOS MCP tools:

1. Call get_coaching_sessions with limit=5 to find recent sessions
2. If $ARGUMENTS contains a session ID, use that directly. If it contains a coach name or slug, call get_coaching_profiles to find the coach, then get_coaching_sessions filtered by that coach's ID
3. Call get_coaching_session with the session ID for full details including summary and action items

Present a session review:
- **Session Info**: Coach name, date, duration, mood at start
- **Summary**: The session's AI-generated summary
- **Key Insights**: List all key insights from the session
- **Action Items**: All action items with their current status
- **Follow-up**: Suggest what to discuss in the next session based on insights and pending items

If no specific session is referenced, review the most recent completed session.
