---
name: llm-council
description: Run a multi-model LLM Council deliberation with peer review and chairman synthesis (Karpathy's 3-stage process)
---

Run a full LLM Council deliberation on a question or topic. Multiple AI models answer independently, then anonymously peer-review each other's responses, and finally a chairman synthesizes the best answer.

## Step 1: Get the Question

Ask: "What question or topic do you want the council to deliberate on?"

If the user has already provided a question in their invocation, use that directly.

## Step 2: Choose Tier

Ask which tier to use:
- **Normal** (default): GPT-4o, Claude Sonnet 4, Gemini 2.5 Pro, Grok 3 — faster, cheaper
- **Pro**: GPT-5.2 Pro, Claude Opus 4.5, Gemini 3 Pro, Grok 4 — slower (5-10 min), most capable

If the user doesn't specify, default to **normal**.

## Step 3: Run the Council

Call the `llm_council_deliberate` MCP tool:

```
llm_council_deliberate({
  query: "<the user's question>",
  tier: "normal" or "pro"
})
```

Tell the user: "Council is deliberating — this takes 2-5 minutes for normal tier, 5-10 minutes for pro tier."

## Step 4: Present Results

When the result comes back, present it in 3 clear sections:

### Stage 1 — Individual Responses

For each council member, show:
- **Model name** and a brief summary (2-3 sentences) of their response
- Note any model that errored out

### Stage 2 — Peer Review & Rankings

Show the aggregate rankings table:
| Rank | Model | Avg Rank |
|------|-------|----------|
| 1 | ... | ... |

Highlight key points of agreement and disagreement from the evaluations.

### Stage 3 — Chairman's Synthesis

Present the chairman's synthesized answer in full. This is the council's final, authoritative answer.

## Step 5: Optional Follow-up

Ask: "Want me to save these insights? I can create an AI conversation summary."

If yes, call `create_ai_convo_summary` with:
- title: "LLM Council: <topic>"
- summary: the chairman's synthesis
- keyInsights: top 3-5 insights from the deliberation

## Style Notes
- Let the user see all 3 stages — the transparency is the whole point
- If a model errors, mention it but don't dwell on it
- The chairman's synthesis is the "answer" but the individual responses often have unique valuable perspectives worth highlighting
- For follow-up questions on the same topic, mention they can call this skill again
