---
name: north-star
description: View and manage your North Star visions — the big compelling life directions
---

Show me my North Star visions. Use the LifeOS MCP tools:

1. Call get_north_stars to list all North Star visions (active, exploring, archived)

Present each North Star with:
- **Title & Status**: Name and whether it's active, exploring, or archived
- **Vision Narrative**: The vivid picture of what life looks like when living this vision
- **Why**: The emotional pull — why this vision matters
- **Linked Pillars**: Which life pillars this vision serves
- **Time Horizon**: When this could be realized

Highlight active visions prominently. For exploring visions, note what's being tested or validated.

If the user wants to create, update, or archive a North Star, use create_north_star, update_north_star, or update the status accordingly. Use get_north_star_revisions to show how a vision has evolved over time if asked.
