Quick capture a thought, task, or note. $ARGUMENTS contains what to capture.

Analyze the input in $ARGUMENTS and determine what type of capture this is:

**If it's a task/action item** (contains action verbs, deadlines, assignments):
- Run: `lifeos create_issue title="Task title" priority=medium` to create the task
- Infer priority from urgency cues (e.g., "urgent", "ASAP" = urgent; "soon" = high; default = medium)
- If a project is mentioned, look it up with `lifeos get_projects` and assign it via `projectIdOrKey=PROJ`
- If a due date is mentioned, parse and set it via `dueDate=2025-01-15`

**If it's a thought/note** (observations, ideas, reminders):
- Run: `lifeos create_quick_note content="Note content"` to save it
- Extract tags from context (e.g., topic keywords)

**If ambiguous**, default to creating a quick note.

After creating, confirm what was captured with the ID/identifier.

If $ARGUMENTS is empty, ask what to capture.

Each lifeos command outputs JSON. Parse the results accordingly.
