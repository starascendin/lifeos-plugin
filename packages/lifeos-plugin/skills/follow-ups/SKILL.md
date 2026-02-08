---
name: follow-ups
description: Track follow-ups needed with people and clients
---

Track follow-ups needed with people and clients. Use the Bash tool to run lifeos CLI commands:

1. Run: `lifeos get_people` to get all contacts
2. Run: `lifeos get_clients` to get all clients
3. Run: `lifeos get_person_timeline` to see recent interactions
4. Run: `lifeos get_beeper_threads` to see recent message activity
5. Run: `lifeos get_granola_meetings` to see recent meetings

Analyze and identify:
- **People needing follow-up**: Contacts with no interaction in 7+ days who have open items or recent meetings
- **Client follow-ups**: Clients with stale threads or meetings that had action items
- **Promised callbacks**: Any meetings/messages where you said "I'll get back to you"

Present as:
- **Urgent** (14+ days): People/clients you really need to reach out to
- **Soon** (7-14 days): Worth a quick check-in
- **Suggested actions**: Specific follow-up actions for each

If $ARGUMENTS contains a person or client name, focus on just that entity.

Each lifeos command outputs JSON. Parse the results accordingly.
