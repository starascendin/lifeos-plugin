---
name: voice-notes
description: Explore and work with voice notes interactively - review, analyze, and discuss your recorded thoughts
---

Explore and work with my voice notes interactively. Use the Bash tool to run lifeos CLI commands.

This is an interactive session to help you think through your voice notes, formulate plans, refine ideas, and review your journal entries.

**Getting Started - Understand what's available:**
1. Run: `lifeos get_voice_memo_labels` to see all topics/labels in your voice notes
2. Run: `lifeos get_recent_notes limit=10` to see recent entries
3. Ask the user what they want to explore or work on

**Exploration Commands based on user intent:**

**If user wants to review recent notes:**
- Run: `lifeos get_recent_notes` or `lifeos get_voice_memos_by_date startDate=... endDate=...`
- Present summaries and offer to dive deeper into specific memos

**If user wants to explore a topic:**
- Run: `lifeos get_voice_memos_by_labels labels=topic1,topic2`
- Or run: `lifeos search_notes query="..."`
- Present findings and discuss patterns/themes

**If user wants to review a specific time period:**
- Run: `lifeos get_voice_memos_by_date startDate=2024-01-01 endDate=2024-01-31`
- Summarize themes, sentiment patterns, and key points

**For deeper analysis of a single memo:**
- Run: `lifeos get_voice_memo memoId=...` to get full details including AI extraction

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

Each lifeos command outputs JSON. Parse the results accordingly.
