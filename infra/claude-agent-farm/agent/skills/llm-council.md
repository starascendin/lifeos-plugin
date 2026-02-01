LLM Council: multi-model deliberation with peer review and synthesis. $ARGUMENTS contains the question and optional flags.

## Parse Arguments

Parse `$ARGUMENTS` to extract:
- `--pro` flag: use pro-tier models instead of normal-tier
- `--providers <list>` : comma-separated custom provider list (e.g. `claude-pro,openai,gemini`)
- `--chairman <provider>` : which model synthesizes the final answer (default: first provider)
- Everything else is the **question**

**Normal-tier providers** (default):
| Key | Model ID |
|-----|----------|
| `claude` | `anthropic/claude-sonnet-4-5` |
| `openai` | `openai/gpt-5.1-codex-mini` |
| `gemini` | `google/gemini-2.5-flash` |

**Pro-tier providers** (`--pro`):
| Key | Model ID |
|-----|----------|
| `claude-pro` | `anthropic/claude-opus-4-5` |
| `openai` | `openai/gpt-5.2` |
| `gemini` | `google/gemini-2.5-pro` |

If `$ARGUMENTS` is empty, ask what question to deliberate on.

---

## Stage 1 — Deliberation

Write the question to a temp file, then run all providers in parallel using bash `&` + `wait`.

```bash
cat > /tmp/council_question.txt << 'QUESTION_EOF'
<the question goes here>
QUESTION_EOF
```

Then run all providers in a **single Bash command** (adjust model IDs based on tier/custom selection):

```bash
opencode run --model anthropic/claude-sonnet-4-5 --file /tmp/council_question.txt -- "Answer the following question thoroughly and thoughtfully. Provide your best, most complete answer." > /tmp/council_resp_claude.txt 2>&1 &
opencode run --model openai/gpt-5.1-codex-mini --file /tmp/council_question.txt -- "Answer the following question thoroughly and thoughtfully. Provide your best, most complete answer." > /tmp/council_resp_openai.txt 2>&1 &
opencode run --model google/gemini-2.5-flash --file /tmp/council_question.txt -- "Answer the following question thoroughly and thoughtfully. Provide your best, most complete answer." > /tmp/council_resp_gemini.txt 2>&1 &
wait
```

After `wait` completes, read each response file. Note which providers succeeded (non-empty file with substantive content) and which failed.

**Gate:** You need at least 2 successful responses to proceed. If fewer than 2 succeeded, present whatever you have and explain which providers failed.

---

## Stage 2 — Peer Review

Build an anonymized review prompt with all successful responses labeled as "Response A", "Response B", "Response C" (do NOT reveal which model wrote which).

Write this prompt to `/tmp/council_review_prompt.txt`:

```
You are reviewing answers to the following question:

<the question>

Here are the responses to evaluate:

=== Response A ===
<response A text>

=== Response B ===
<response B text>

=== Response C ===
<response C text>

Score each response on these criteria (1-5 scale):
- **Accuracy**: Are the facts correct?
- **Completeness**: Does it fully address the question?
- **Clarity**: Is it well-organized and easy to understand?
- **Insight**: Does it provide unique or valuable perspectives?

Output your review as JSON only, no other text:
{"A": {"accuracy": N, "completeness": N, "clarity": N, "insight": N, "total": N}, "B": {"accuracy": N, "completeness": N, "clarity": N, "insight": N, "total": N}, "C": {"accuracy": N, "completeness": N, "clarity": N, "insight": N, "total": N}}
```

Run all reviewers in parallel (same `&` + `wait` pattern), writing to `/tmp/council_review_claude.txt`, `/tmp/council_review_openai.txt`, `/tmp/council_review_gemini.txt`.

```bash
opencode run --model <model1> --file /tmp/council_review_prompt.txt -- "Review these responses. Output JSON scores only." > /tmp/council_review_claude.txt 2>&1 &
opencode run --model <model2> --file /tmp/council_review_prompt.txt -- "Review these responses. Output JSON scores only." > /tmp/council_review_gemini.txt 2>&1 &
opencode run --model <model3> --file /tmp/council_review_prompt.txt -- "Review these responses. Output JSON scores only." > /tmp/council_review_openai.txt 2>&1 &
wait
```

Read each review file and parse the JSON scores. Average the scores across reviewers for each response. Rank the responses by total average score.

**Gate:** Need at least 1 successful reviewer. Skip any that failed or returned invalid JSON.

---

## Stage 3 — Synthesis

Build a synthesis prompt that includes:
1. The original question
2. All successful responses (now revealed with their rankings)
3. The averaged peer review scores

Write to `/tmp/council_synthesis_prompt.txt`:

```
You are the chairman of an LLM council. Multiple AI models answered a question and peer-reviewed each other's responses. Your job is to synthesize the best possible answer.

## Original Question
<the question>

## Responses (ranked by peer review score)

### Rank 1 — <provider name> (avg score: X.X/20)
<response text>

### Rank 2 — <provider name> (avg score: X.X/20)
<response text>

### Rank 3 — <provider name> (avg score: X.X/20)
<response text>

## Your Task
Synthesize the best possible answer by:
- Taking the strongest points from each response
- Resolving any contradictions (favor the higher-ranked response unless clearly wrong)
- Adding any important context that was missed
- Presenting a clear, well-structured final answer

Write ONLY the synthesized answer. Do not mention the council process, rankings, or individual models.
```

Run the chairman model:

```bash
opencode run --model <chairman_model> --file /tmp/council_synthesis_prompt.txt -- "Synthesize the best answer from these council responses." > /tmp/council_synthesis.txt 2>&1
```

Read the synthesis result.

**Fallback:** If synthesis fails, present the highest-ranked individual response instead.

---

## Output

Present the result in this format:

### Council Answer

<synthesized answer>

<details>
<summary>Council Details</summary>

**Models used:** <list of providers and model IDs>
**Chairman:** <chairman provider>
**Tier:** <normal or pro>

#### Peer Review Scores

| Response | Accuracy | Completeness | Clarity | Insight | Total |
|----------|----------|--------------|---------|---------|-------|
| <provider> | X.X | X.X | X.X | X.X | X.X |
| <provider> | X.X | X.X | X.X | X.X | X.X |
| <provider> | X.X | X.X | X.X | X.X | X.X |

#### Individual Responses

<details>
<summary>Response from <provider> (Rank N)</summary>

<full response text>

</details>

</details>

---

## Cleanup

After presenting results, remove all temp files:

```bash
rm -f /tmp/council_*.txt
```
