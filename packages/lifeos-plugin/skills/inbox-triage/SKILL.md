---
name: inbox-triage
description: Process captured notes and triage into actionable tasks, tags, and links
---

Process captured notes and triage into actionable items. Use the Bash tool to run lifeos CLI commands:

1. Run: `lifeos get_recent_notes limit=20` to get recent unprocessed captures
2. Run: `lifeos get_projects` to know available projects for assignment
3. Run: `lifeos get_people` to know contacts for linking

For each note, analyze and suggest:
- **Convert to task?** If it contains an action item, offer to create an issue
- **Link to person?** If it mentions someone, offer to link the note
- **Link to project?** If it relates to a project, suggest assignment
- **Add tags?** Suggest relevant tags based on content

Present as an interactive triage list:
- Show each note with its content summary
- Provide recommended action (task, tag, link, or archive)
- Ask for confirmation before making changes

After triage, use the appropriate commands:
- `lifeos create_issue title="..." projectIdOrKey=...` to convert notes to tasks
- `lifeos add_tags_to_note noteId=... tags=tag1,tag2` to categorize
- `lifeos link_memo_to_person personId=... voiceMemoId=...` to connect to people

If $ARGUMENTS contains "auto", process automatically with best-guess actions instead of asking.

Each lifeos command outputs JSON. Parse the results accordingly.
