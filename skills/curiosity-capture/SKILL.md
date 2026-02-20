---
name: curiosity-capture
description: Quick capture a curiosity, idea, dream, or what-if
args: text to capture
---

Capture a new curiosity for me. Use the LifeOS MCP tools:

1. Parse the user's input to determine:
   - **title**: A concise name for the curiosity
   - **type**: One of: curiosity, hobby, dream, what_if, person, place, skill, experience
   - **description**: Any additional context from the input

2. Call create_curiosity with the parsed data (status should be "captured")

3. Confirm what was captured and suggest if it might relate to any life pillars (call get_pillars to check).

If the input is ambiguous about the type, default to "curiosity". Keep it quick — this is a low-friction capture tool.
