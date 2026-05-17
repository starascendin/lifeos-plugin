---
name: contact-lookup
description: Full contact dossier with profile, AI insights, meetings, messages, and voice memos
---

Look up everything about a contact. $ARGUMENTS should be a person's name.

Use the LifeOS MCP tools:

1. Call get_contact_dossier with nameQuery set to $ARGUMENTS to get the full profile
   - This returns: person info, AI profile, Beeper threads, Granola meetings (with AI notes and calendar events), and voice memos
2. When the user asks how this person relates to PPV or projects, call `falkor_graph_schema`, then use `falkor_graph_query` to inspect the FalkorDB sidecar graph where available.
3. If a meaningful PPV/project relationship is missing and both endpoint nodes exist in Falkor, use `falkor_graph_link` to create an agent-owned link with `reason` and `confidence`. Do not edit the person record through FalkorDB.

Present the dossier in a structured format:
- **Profile**: Name, relationship type, contact info, notes
- **AI Insights**: Communication style, personality, relationship tips (if available)
- **Recent Interactions**: Last few voice memos, meetings, and messages — sorted by recency
- **Meeting History**: Granola meetings with key takeaways
- **Chat Threads**: Beeper conversation threads linked to this person
- **Graph Links**: Relevant FalkorDB sidecar relationships and any newly created `AGENT_LINK` relationships

If no name is provided in $ARGUMENTS, ask for one.
