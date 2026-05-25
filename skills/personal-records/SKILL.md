---
name: personal-records
description: Retrieve Personal Records from LifeOS and use them as private RAG context before answering, planning, or making decisions
---

Retrieve my Personal Records and use them as private source context. Use the LifeOS MCP tools.

Personal Records are atomic private records with editable TipTap markdown and optional attachments. They are the canonical place to check for saved preferences, decisions, principles, operating rules, notes, plans, and durable personal context.

**Default RAG flow:**

1. If the user asks a question, requests advice, asks for a plan, or refers to something that may be captured in my records, call `retrieve_personal_records` first.
   - Pass the user's topic or question as `query`.
   - Use `limit` 5 by default.
   - Use `maxSnippetChars` 1200 unless the answer needs denser context.
2. Read the returned `records`, `snippet`, `score`, `tags`, and `ragInstructions`.
3. If snippets are enough, answer using those records as source context.
4. If a matching record appears important but the snippet is incomplete, call `get_personal_record` with that record ID to fetch the full markdown and attachment metadata.
5. If the user is browsing records rather than asking a specific question:
   - Call `get_personal_records` for a recent/tag-filtered list.
   - Call `search_personal_records` for keyword discovery.

**Tool selection:**

- `retrieve_personal_records`: first choice for RAG, semantic-ish keyword retrieval, and question answering.
- `get_personal_record`: fetch one full record by ID, including attachment metadata and storage URLs.
- `search_personal_records`: keyword search over titles, tags, and markdown.
- `get_personal_records`: recent records list, optional `tag`, `includeArchived`, and `limit`.

**How to answer with retrieved records:**

- Treat retrieved records as private source context, not public web facts.
- Mention record titles or IDs when useful so the user can tell where the answer came from.
- Do not invent records or imply a record exists if retrieval returns no results.
- If records conflict, say which records disagree and prefer the newest updated record unless the user gives another priority.
- Use attachment metadata only as context unless the user asks for a specific file or attachment.
- Keep sensitive record contents out of external tools unless the user explicitly asks for that workflow.

**When to use this skill automatically:**

- Personal policies, preferences, operating principles, and recurring decisions.
- "What did I say about...", "what do I know about...", "based on my notes/records...", and similar questions.
- Planning or prioritization where durable personal context may change the answer.
- Agent handoffs where Codex, Hermes, or another assistant needs LifeOS private context before acting.

If `$ARGUMENTS` contains a topic, query, or record ID, start with that. Otherwise ask what records the user wants to retrieve or search.
