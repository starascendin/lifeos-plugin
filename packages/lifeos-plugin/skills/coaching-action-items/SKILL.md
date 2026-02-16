---
name: coaching-action-items
description: Review and manage coaching action items across all coaches
---

Review my coaching action items. Use the LifeOS MCP tools:

1. Call get_coaching_action_items to get all action items
2. Call get_coaching_profiles to get coach names for grouping

Present action items grouped by coach:
- **Per Coach**: Show coach name, then list action items with status, priority, due date
- **Overdue**: Highlight any items past their due date
- **Summary**: Total pending, in-progress, completed counts
- **Suggestions**: Which items to prioritize next

If $ARGUMENTS contains "complete" or references a specific item, call update_coaching_action_item with status "completed" for that item.
