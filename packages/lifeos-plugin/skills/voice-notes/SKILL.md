---
name: voice-notes
description: Explore and work with voice notes interactively - review, analyze, and discuss your recorded thoughts
---

Explore and work with my voice notes interactively. Use the LifeOS MCP tools.

This is an interactive session to help you think through your voice notes, formulate plans, refine ideas, and review your journal entries.

**Getting Started - Understand what's available:**
1. Call get_voice_memo_labels to see all topics/labels in your voice notes
2. Call get_recent_notes with limit 10 to see recent entries
3. Ask the user what they want to explore or work on

**Exploration based on user intent:**

**If user wants to review recent notes:**
- Call get_recent_notes or get_voice_memos_by_date with date range
- Present summaries and offer to dive deeper into specific memos

**If user wants to explore a topic:**
- Call get_voice_memos_by_labels with the relevant labels
- Or call search_notes with a query
- Present findings and discuss patterns/themes

**If user wants to review a specific time period:**
- Call get_voice_memos_by_date with startDate and endDate
- Summarize themes, sentiment patterns, and key points

**For deeper analysis of a single memo:**
- Call get_voice_memo with the memoId for full details including AI extraction

**During the conversation:**
- Help the user think through their notes
- Identify patterns and connections across memos
- Surface action items they may have forgotten
- Help formulate new plans or refine existing ideas
- Offer reflections on journal entries

**At the end of the session:**
- Offer to crystallize the conversation using `/crystallize`
- This saves the insights, plans, and ideas from your discussion

If $ARGUMENTS contains a topic or date range, start by exploring that specifically.
Otherwise, show recent activity and ask what the user wants to explore.
