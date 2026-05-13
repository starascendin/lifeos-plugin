---
name: ppv
description: Manage the PPV life design system in LifeOS: vision, identity, pillars, existing projects, weekly actions, reflections, and adjustments
---

Manage my PPV life design system. This is a mutating workflow when the request implies creating, updating, linking, completing, reflecting, or adjusting.

Use the LifeOS MCP tools:

1. Call `get_ppv_workspace` first.
   - This returns the active vision, identity, pillars, linked projects, weekly actions, reflections, adjustments, and available existing LifeOS projects.
   - If the user asks to link projects, only use project IDs returned in `projects`.
2. If there is no PPV vision:
   - If the user asks for the Beijing example, call `seed_ppv_beijing_workspace`.
   - Otherwise call `upsert_ppv_vision` with the new vision.
3. For vision edits, call `upsert_ppv_vision`.
   - Vision should be vivid, emotional, directional, and experiential.
   - Do not turn vision into tasks.
4. For identity edits, call `upsert_ppv_identity`.
   - `coreIdentities`: who naturally lives the vision.
   - `beliefs`: statements the identity acts from.
   - `behaviors`: repeated observable behaviors.
5. For pillars, call `create_ppv_pillar`, `update_ppv_pillar`, or `delete_ppv_pillar`.
   - Pillars are ongoing systems, not temporary goals.
   - Link existing LifeOS projects through `projectIds`; do not create duplicate PPV projects.
6. For execution, call `create_ppv_weekly_action`, `update_ppv_weekly_action`, or `delete_ppv_weekly_action`.
   - Weekly actions should be small, concrete, and identity-aligned.
   - Link to `pillarId` and/or existing `projectId` when clear.
7. For learning loops:
   - Call `create_ppv_reflection` to capture weekly energy, resistance, alignment, and momentum.
   - Call `create_ppv_adjustment` when reflection or lived evidence changes identity, pillars, projects, or actions.

PPV philosophy:
- Desired future should affect daily reality.
- Projects remain in the existing LifeOS project model.
- Reflections produce adjustments; adjustments feed back into identity, pillars, projects, and actions.
- Keep it simple. Prefer one useful mutation over a sprawling plan.

After applying changes, report:
- What changed.
- IDs for any created or updated PPV records.
- Which existing LifeOS projects were linked.
- The next weekly action, if one is obvious.
