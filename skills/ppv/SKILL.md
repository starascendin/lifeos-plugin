---
name: ppv
description: Manage the PPV life design system in LifeOS: vision, identity, pillars, and existing projects
---

Manage my PPV life design system. This is a mutating workflow when the request implies creating, updating, linking, or changing lifecycle status.

Use the LifeOS MCP tools:

1. Call `get_ppv_workspace` first.
   - This returns the selected/current vision, identity, pillars, linked projects, and available existing LifeOS projects.
   - If the user asks to link projects, only use project IDs returned in `projects`.
   - Treat this as the canonical source for PPV record IDs before any PPV mutation.
2. When the user asks how a vision connects to execution, what a vision is currently driving, where something belongs, or how PPV relates to projects/issues/memos, call `get_active_vision_graph`.
   - This is the best default graph read for PPV work.
   - It returns a unified graph around the current or selected vision, including PPV nodes plus linked projects, issues, and recent voice memos.
   - Prefer this over the full graph when the question is about one vision or current direction.
3. Use graph neighborhood tools when the user is anchored on a non-PPV object:
   - `get_project_graph` for a project-centered neighborhood.
   - `get_initiative_graph` for an initiative-centered neighborhood.
   - `get_person_graph` for relationship/contact context.
   - `get_voice_memo_graph` for a memo-centered neighborhood.
   - `get_unified_life_graph` only for whole-system analysis or exports; it is much broader than the vision graph.
4. Use graph cache tools intentionally:
   - `get_cached_unified_graph` for a fast read of the last materialized projection.
   - `refresh_unified_graph_cache` after graph-affecting changes if the user needs a refreshed projection and the cached graph may be stale.
5. Use manual graph links when the relationship matters but is not inferred automatically.
   - Call `upsert_unified_graph_link` using `fromNodeId` and `toNodeId` taken from a graph response.
   - Valid link kinds are `contains`, `references`, `derived_from`, `supports`, and `related_to`.
   - Use `evidence` to explain why the link exists.
   - Call `delete_unified_graph_link` to remove a manual relationship.
6. Use the FalkorDB sidecar graph when the user wants Cypher traversal or richer PPV graph relationship linking.
   - Call `falkor_graph_schema` before Falkor work.
   - Use `falkor_graph_query` for read-only Cypher over PPV visions, identities, pillars, and projects.
   - Use `falkor_graph_link` for agent-owned `AGENT_LINK` relationships that should not mutate Convex canonical records.
   - Every Falkor link needs a concrete `reason` and `confidence`.
7. If there is no PPV vision:
   - If the user asks for the Beijing example, call `seed_ppv_beijing_workspace`.
   - Otherwise call `upsert_ppv_vision` with the new vision.
8. For vision edits, call `upsert_ppv_vision`.
   - Vision should be vivid, emotional, directional, and experiential.
   - Do not turn vision into tasks.
   - Use `status` for lifecycle: `ideation`, `todo`, `planned`, `in_progress`, or `done`.
   - To change only lifecycle, call `set_ppv_vision_status`.
9. For identity edits, call `upsert_ppv_identity`.
   - `coreIdentities`: who naturally lives the vision.
   - `beliefs`: statements the identity acts from.
   - `behaviors`: repeated observable behaviors.
10. For pillars, call `create_ppv_pillar`, `update_ppv_pillar`, or `delete_ppv_pillar`.
   - Pillars are ongoing systems, not temporary goals.
   - Link existing LifeOS projects through `projectIds`; do not create duplicate PPV projects.

PPV philosophy:
- Desired future should affect daily reality.
- Projects remain in the existing LifeOS project model.
- The graph is the bridge between desired future and lived execution.
- Keep it simple. Prefer one useful mutation over a sprawling plan.

After applying changes, report:
- What changed.
- IDs for any created or updated PPV records.
- Which existing LifeOS projects were linked.
- If graph tools were used, report the key relationships or node IDs that matter.
- If Falkor graph tools were used, report the relationship ids, reasons, confidence values, and Cypher when useful.
