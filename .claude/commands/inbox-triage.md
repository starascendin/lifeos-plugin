Process captured notes and triage into actionable items. Use lifeos-prod MCP tools.

1. Call `get_recent_notes` with limit 20 to get recent unprocessed captures
2. Call `get_projects` to know available projects for assignment
3. Call `get_people` to know contacts for linking

For each note, analyze and suggest:
- **Convert to task?** If it contains an action item, offer to create an issue
- **Link to person?** If it mentions someone, offer to link the note
- **Link to project?** If it relates to a project, suggest assignment
- **Add tags?** Suggest relevant tags based on content

Present as an interactive triage list:
- Show each note with its content summary
- Provide recommended action (task, tag, link, or archive)
- Ask for confirmation before making changes

After triage, use the appropriate tools:
- `create_issue` to convert notes to tasks
- `add_tags_to_note` to categorize
- `link_memo_to_person` to connect to people

If $ARGUMENTS contains "auto", process automatically with best-guess actions instead of asking.
