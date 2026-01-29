Prepare for a meeting with someone. $ARGUMENTS should be the person's name.

Use the lifeos-prod MCP tools:

1. Call `get_contact_dossier` with nameQuery set to $ARGUMENTS for full context
2. Call `get_granola_meetings_for_person` for past meeting notes
3. If person is linked to a client, call `get_projects_for_client` for project status
4. Call `get_beeper_threads_for_person` and for the most recent thread, call `get_beeper_thread_messages` to see latest messages

Compile a meeting prep brief:
- **About**: Who they are, relationship type, communication style (from AI profile)
- **Last Interaction**: When you last met/talked and what was discussed
- **Open Items**: Any action items or tasks related to them or their projects
- **Recent Messages**: Key points from recent Beeper conversations
- **Past Meetings**: Summary of last 3 meetings with key decisions/takeaways
- **Suggested Talking Points**: Based on open items and recent context

If no name is provided in $ARGUMENTS, ask for one.
