---
name: relationship-pulse
description: Check on neglected relationships and suggest reconnection actions
---

Check on neglected relationships. Use the LifeOS MCP tools:

1. Call get_people to get all contacts
2. Call get_beeper_threads to check message activity
3. Call get_granola_meetings to see meeting history
4. Call `falkor_graph_schema`, then use `falkor_graph_query` when the user wants PPV/project graph context for a relationship.
5. Use `falkor_graph_link` only to remember meaningful PPV/project context with `reason` and `confidence`; do not edit contact records through FalkorDB.

Analyze each contact for:
- **Last interaction**: When did you last talk/meet?
- **Interaction frequency**: How often do you typically connect?
- **Relationship type**: Family, friend, colleague, mentor, etc.
- **Graph context**: Projects and PPV themes connected through the FalkorDB sidecar

Identify neglected relationships:
- **Family/Close friends**: No contact in 14+ days
- **Friends**: No contact in 30+ days
- **Colleagues/Mentors**: No contact in 60+ days
- **Acquaintances**: No contact in 90+ days (if you want to maintain)

Present as:
- **Reach out soon**: People you should contact (prioritized by relationship closeness)
- **Consider reconnecting**: People you might want to re-engage
- **Suggested touchpoints**: Quick ways to reconnect (reply to old thread, schedule catch-up, etc.)

If $ARGUMENTS contains a relationship type (e.g., "family", "friends"), filter to just that type.
