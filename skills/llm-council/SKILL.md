---
name: llm-council
description: Run a generic local OpenCode LLM council and save every stage as LifeOS artifacts
---

Run a generic multi-model council for any question. This is not coding-task
specific.

## Workflow

1. Clarify the user's question only if the question itself is ambiguous.
2. Run the local council runner from the LifeOS plugin:

```bash
node packages/lifeos-plugin/scripts/run-llm-council.mjs --prompt "<question>"
```

Use `--title "<short title>"` when a clear artifact title is available.

To define a custom council, pass members explicitly. The number of council
members is the number of `--member` values, or the first `--council-size`
members when limiting a larger config.

```bash
node packages/lifeos-plugin/scripts/run-llm-council.mjs \
  --prompt "<question>" \
  --provider vercel \
  --member "openai/gpt-5.4|GPT 5.4|vercel|medium" \
  --member "moonshotai/kimi-k2.6|Kimi K2.6|vercel" \
  --member "deepseek/deepseek-v4-pro|DeepSeek V4 Pro|vercel" \
  --chairman "openai/gpt-5.4|GPT 5.4|vercel|medium"
```

The runner prefixes shorthand model IDs with `--provider`, which defaults to
`vercel`. For non-Vercel providers, either set `--provider` or include the
provider as the third `|` field.

3. The runner performs:
   - Stage 1: independent answers from every normal-tier model
   - Stage 2: anonymous peer review and ranking
   - Stage 3: chairman synthesis
   - Convex artifact writes after every stage

4. Return the final synthesis and the created `runId`.

## Normal Tier

Configured in `packages/lifeos-plugin/config/llm-council.normal.json`:

- GPT 5.4 via Vercel AI Gateway: `vercel/openai/gpt-5.4`, variant `medium`
- Kimi K2.6 via Vercel AI Gateway: `vercel/moonshotai/kimi-k2.6`
- DeepSeek V4 Pro via Vercel AI Gateway: `vercel/deepseek/deepseek-v4-pro`
- Qwen3.6 Plus via Vercel AI Gateway: `vercel/alibaba/qwen3.6-plus`

## Requirements

The local environment must have:

- `opencode` installed and authenticated for the configured providers
- `LIFEOS_CONVEX_URL` or `CONVEX_URL`
- `LIFEOS_USER_ID`
- `LIFEOS_API_KEY`

Use `--dry-run` to inspect the prompt, model roster, and Convex save plan without
calling models or writing artifacts.
