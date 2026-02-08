Save a crystallized summary of our conversation about voice notes. Use lifeos-prod MCP tools.

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
```
create_ai_convo_summary with:
- title
- summary
- keyInsights (array)
- actionItems (array)
- ideas (array)
- tags (array)
- relatedMemoIds (array, if applicable)
- summaryType
- conversationContext (brief description of what prompted this conversation)
```

**After saving:**
- Confirm success and show the summary ID
- Offer to view past crystallizations with `get_ai_convo_summaries`

This crystallization will be saved and can be retrieved later to review your insights and track how your thinking has evolved.
