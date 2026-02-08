---
name: voice-notes-crystallize
description: Save a crystallized summary of AI conversation about voice notes - preserve insights, plans, and ideas
---

Save a crystallized summary of our conversation about voice notes. Use the Bash tool to run lifeos CLI commands.

$ARGUMENTS may contain a title or topic for the summary. If not provided, generate one based on our conversation.

**Analyze the conversation and extract:**

1. **Title**: A descriptive title for this crystallization
2. **Summary**: The main insights, conclusions, or outcomes from our discussion (2-4 paragraphs)
3. **Key Insights**: 3-7 bullet points of the most important realizations or learnings
4. **Action Items**: Any tasks or actions that emerged from the discussion
5. **Ideas**: New ideas, plans, or directions formulated
6. **Tags**: 3-5 relevant tags for categorization

**Determine the summary type:**
- `reflection` - Processing past experiences or feelings
- `planning` - Creating plans or strategies
- `brainstorm` - Generating new ideas
- `journal_review` - Reviewing journal/diary entries
- `idea_refinement` - Developing and refining existing ideas

**If we discussed specific voice memos:**
- Note their IDs to link them to this summary

**Then save using:**
```bash
lifeos create_ai_convo_summary \
  title="..." \
  summary="..." \
  keyInsights=insight1,insight2,insight3 \
  actionItems=action1,action2 \
  ideas=idea1,idea2 \
  tags=tag1,tag2,tag3 \
  summaryType=reflection \
  conversationContext="..."
```

Note: For arrays, pass comma-separated values. For the summary text, use quotes.

**After saving:**
- Confirm success and show the summary ID
- Offer to view past crystallizations with `lifeos get_ai_convo_summaries`

This crystallization will be saved and can be retrieved later to review your insights and track how your thinking has evolved.

Each lifeos command outputs JSON. Parse the results accordingly.
