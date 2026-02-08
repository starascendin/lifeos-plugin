---
name: relationship-pulse
description: Check on neglected relationships and suggest reconnection actions
---

Check on neglected relationships. Use the Bash tool to run lifeos CLI commands:

1. Run: `lifeos get_people` to get all contacts
2. Run: `lifeos get_person_timeline` to see interaction history
3. Run: `lifeos get_beeper_threads` to check message activity
4. Run: `lifeos get_granola_meetings` to see meeting history

Analyze each contact for:
- **Last interaction**: When did you last talk/meet?
- **Interaction frequency**: How often do you typically connect?
- **Relationship type**: Family, friend, colleague, mentor, etc.

Identify neglected relationships:
- **Family/Close friends**: No contact in 14+ days
- **Friends**: No contact in 30+ days
- **Colleagues/Mentors**: No contact in 60+ days
- **Acquaintances**: No contact in 90+ days (if you want to maintain)

Present as:
- **Reach out soon**: People you should contact (prioritized by relationship closeness)
- **Consider reconnecting**: People you might want to re-engage
- **Suggested touchpoints**: Quick ways to reconnect (reply to old thread, schedule catch-up, etc.)

If $ARGUMENTS contains a relationship type (e.g., "family", "friends"), filter to just that type (e.g. `lifeos get_people relationshipType=family`).

Each lifeos command outputs JSON. Parse the results accordingly.
