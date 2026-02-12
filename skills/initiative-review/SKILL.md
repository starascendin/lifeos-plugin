---
name: initiative-review
description: Review yearly initiative progress with stats per category and highlight stalled initiatives
---

Review my yearly initiative progress. Use the LifeOS MCP tools:

1. Call get_initiative_yearly_rollup with the year to get all initiatives with aggregated stats
2. For any initiative with low progress or stalled status, call get_initiative_with_stats for deeper details

Present the review:
- **Year Overview**: Total initiatives, active vs completed, average progress
- **By Category**: Group initiatives by category (career, health, learning, etc.) and show progress
- **Each Initiative**: Title, status, progress %, tasks completed/total, linked projects, habits
- **Highlights**: Call out any initiatives at 80%+ progress (near completion)
- **Concerns**: Flag initiatives with 0% progress, no linked projects, or "paused" status
- **Recommendations**: Suggest next actions — which initiatives to focus on, which need attention

Be concise but thorough. Suggest linking unlinked projects/tasks if appropriate.

If $ARGUMENTS contains a year (e.g., "2025"), use that year. Otherwise default to the current year.
