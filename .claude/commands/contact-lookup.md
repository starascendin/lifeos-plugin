Look up everything about a contact. $ARGUMENTS should be a person's name.

Use the lifeos-prod MCP tools:

1. Call `get_contact_dossier` with nameQuery set to $ARGUMENTS to get the full profile
   - This returns: person info, AI profile, Beeper threads, Granola meetings (with AI notes and calendar events), and voice memos

Present the dossier in a structured format:
- **Profile**: Name, relationship type, contact info, notes
- **AI Insights**: Communication style, personality, relationship tips (if available)
- **Recent Interactions**: Last few voice memos, meetings, and messages — sorted by recency
- **Meeting History**: Granola meetings with key takeaways
- **Chat Threads**: Beeper conversation threads linked to this person

If no name is provided in $ARGUMENTS, ask for one.
