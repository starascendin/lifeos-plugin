---
name: capture
description: Quick capture a thought, task, or note with auto-routing based on content
---

Quick capture a thought, task, or note. $ARGUMENTS contains what to capture.

Analyze the input in $ARGUMENTS and determine what type of capture this is:

**If it's a task/action item** (contains action verbs, deadlines, assignments):
- Use `create_issue` from LifeOS MCP tools
- Infer priority from urgency cues (e.g., "urgent", "ASAP" = urgent; "soon" = high; default = medium)
- If a project is mentioned, look it up with `get_projects` and assign it
- If a due date is mentioned, parse and set it

**If it's a thought/note** (observations, ideas, reminders):
- Use `create_quick_note` from LifeOS MCP tools
- Extract tags from context (e.g., topic keywords)

**If ambiguous**, default to creating a quick note.

After creating, confirm what was captured with the ID/identifier.

If $ARGUMENTS is empty, ask what to capture.
