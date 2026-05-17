---
name: falkor-graph
description: Use when the user asks for FalkorDB, Cypher graph traversal, graph schema inspection, or agent-owned PPV relationship links over visions, pillars, identities, and projects.
---

Use the LifeOS FalkorDB sidecar graph. This skill is for graph traversal and agent-owned relationship links, not canonical entity edits.

Use the LifeOS MCP tools:

1. Call `falkor_graph_schema` first.
   - Confirm FalkorDB is configured.
   - Review allowed node labels, relationship types, fields, query recipes, and link flow.
   - Treat this as the contract for the Falkor sidecar.
2. Use `falkor_graph_query` for read-only Cypher.
   - Allowed query shapes are read-only `MATCH`, `WITH`, `RETURN`, `EXPLAIN`, and `PROFILE`.
   - Every `MATCH` or `WITH` query must include `LIMIT` unless it is a count aggregate.
   - Prefer the query recipes returned by `falkor_graph_schema` before inventing raw Cypher.
   - Prefer projected fields (`convexId`, `title`, `status`, `visionId`, `kind`, `reason`, `confidence`) over returning whole nodes.
   - Prefer small, targeted traversals over whole-graph scans.
3. Use `falkor_graph_link` when a meaningful relationship exists but is not already represented.
   - Link only existing nodes.
   - Use exact node labels and `convexId` values from prior reads.
   - Include `kind`, `reason`, and `confidence`.
   - This writes only `AGENT_LINK` relationships.
4. Use `falkor_graph_unlink` only for relationships previously created by `falkor_graph_link`.

Good uses:
- Trace PPV vision -> pillars -> projects.
- Inspect PPV graph neighborhoods with Cypher.
- Link a pillar, project, identity, or vision with agent-owned rationale.
- Explain why a project matters by traversing project -> pillar -> vision.
- Audit existing `AGENT_LINK` relationships before adding new ones.
- Compare Falkor graph output with Convex graph projections.
- Inspect whether a relationship already exists before creating it.

Rules:
- Convex remains canonical for entity data.
- `convexId` is the stable id shared between Convex and Falkor nodes.
- Do not use FalkorDB to edit canonical node fields.
- Do not mutate inferred PPV relationships such as `HAS_IDENTITY`, `HAS_PILLAR`, or `PILLAR_SUPPORTS_PROJECT`.
- Do not ask for raw credentials; the MCP server should already have them through env vars.
- Do not run mutation Cypher through `falkor_graph_query`.
- Keep graph writes narrow, explainable, and reversible.

When reporting results:
- Include the key nodes and relationships found.
- Include any newly created `AGENT_LINK` relationship id.
- Include the Cypher used when it helps future follow-up.
- Say clearly when the Falkor sidecar is missing data and a Convex sync may be needed.
