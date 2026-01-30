Prepare for a meeting with someone. $ARGUMENTS should be the person's name.

Use the Bash tool to run lifeos CLI commands:

1. Run: `lifeos get_contact_dossier nameQuery="$ARGUMENTS"` for full context
2. Run: `lifeos get_granola_meetings_for_person personId=<ID>` for past meeting notes (use the personId from the dossier)
3. If person is linked to a client, run: `lifeos get_projects_for_client clientId=<ID>` for project status
4. Run: `lifeos get_beeper_threads_for_person personId=<ID>` and for the most recent thread, run: `lifeos get_beeper_thread_messages threadId=<ID>` to see latest messages

Compile a meeting prep brief:
- **About**: Who they are, relationship type, communication style (from AI profile)
- **Last Interaction**: When you last met/talked and what was discussed
- **Open Items**: Any action items or tasks related to them or their projects
- **Recent Messages**: Key points from recent Beeper conversations
- **Past Meetings**: Summary of last 3 meetings with key decisions/takeaways
- **Suggested Talking Points**: Based on open items and recent context

If no name is provided in $ARGUMENTS, ask for one.

Each lifeos command outputs JSON. Parse the results accordingly.
