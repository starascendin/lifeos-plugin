---
name: surreal-graph
description: Query and link LifeOS data through the SurrealDB sidecar graph. Use when the user asks for graph traversal, cross-domain relationship discovery, or linking PPV, projects, people, chats, meetings, notes, and voice memos.
---

Use the LifeOS SurrealDB sidecar graph. This skill is for graph traversal and agent-owned relationship links, not canonical entity edits.

Use the LifeOS MCP tools:

1. Call `surreal_graph_schema` first.
   - Confirm SurrealDB is configured.
   - Review allowed table prefixes, relation tables, and examples.
   - Treat this as the contract for the graph sidecar.
2. Use `surreal_graph_query` for read-only SurrealQL.
   - Allowed statements are `SELECT`, `INFO`, and `EXPLAIN`.
   - Every `SELECT` must include `LIMIT` unless it is a count aggregate.
   - Prefer small, targeted traversals over whole-graph scans.
3. Use `surreal_graph_link` when a meaningful relationship exists but is not already represented.
   - Link only existing records.
   - Use exact table names and record ids from prior reads.
   - Include `kind`, `reason`, and `confidence`.
   - This writes only to `lifeos_agent_links`.
4. Use `surreal_graph_unlink` only for relationships previously created by `surreal_graph_link`.

Good uses:
- Trace PPV vision -> pillars -> projects -> related agent-created links.
- Link a chat, meeting, voice memo, or note to a project.
- Link a person/client to work they influence.
- Find projects connected to a theme, relationship, or PPV pillar.
- Inspect whether a new relationship already exists before creating it.

Rules:
- Convex remains canonical for entities: projects, issues, PPV records, people, clients, chats, meetings, notes, and voice memos.
- Do not use SurrealDB to edit canonical entity fields.
- Do not ask for raw credentials; the MCP server should already have them through env vars.
- Do not run mutation SQL through `surreal_graph_query`.
- Keep graph writes narrow, explainable, and reversible.

When reporting results:
- Include the key nodes and relationships found.
- Include any newly created `lifeos_agent_links` relationship id.
- Include the SurrealQL used when it helps future follow-up.
- Say clearly when the graph sidecar is missing data and a Convex sync may be needed.
