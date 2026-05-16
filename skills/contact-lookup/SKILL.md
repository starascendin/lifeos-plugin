---
name: contact-lookup
description: Full contact dossier with profile, AI insights, meetings, messages, and voice memos
---

Look up everything about a contact. $ARGUMENTS should be a person's name.

Use the LifeOS MCP tools:

1. Call get_contact_dossier with nameQuery set to $ARGUMENTS to get the full profile
   - This returns: person info, AI profile, Beeper threads, Granola meetings (with AI notes and calendar events), and voice memos
2. When the user asks how this person relates to projects, clients, PPV, chats, meetings, notes, or recurring themes, call `surreal_graph_schema`, then use `surreal_graph_query` to inspect the SurrealDB sidecar graph.
3. If a meaningful relationship is missing, use `surreal_graph_link` to create an agent-owned link with `reason` and `confidence`. Do not edit the person record through SurrealDB.

Present the dossier in a structured format:
- **Profile**: Name, relationship type, contact info, notes
- **AI Insights**: Communication style, personality, relationship tips (if available)
- **Recent Interactions**: Last few voice memos, meetings, and messages — sorted by recency
- **Meeting History**: Granola meetings with key takeaways
- **Chat Threads**: Beeper conversation threads linked to this person
- **Graph Links**: Relevant SurrealDB sidecar relationships and any newly created `lifeos_agent_links`

If no name is provided in $ARGUMENTS, ask for one.
