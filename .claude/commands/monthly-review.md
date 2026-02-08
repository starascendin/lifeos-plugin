Run my monthly review. Use lifeos-prod MCP tools.

1. Call `get_monthly_agenda` for this month's overview and AI summary
2. Call `get_cycles` to see all sprints this month and their completion rates
3. Call `get_tasks` with status "done" to see everything completed this month
4. Call `get_projects` to see project progress and health
5. Call `get_clients` to review client status
6. Call `get_recent_notes` with limit 20 to review captured thoughts

Present a monthly review:
- **Accomplishments**: Major wins and completed work this month
- **Projects Progress**: Status of each active project
- **Sprint Performance**: Average completion rate across cycles
- **Client Health**: How each client relationship is doing
- **Themes**: Patterns from notes and completed work
- **Carried Forward**: What's rolling into next month
- **Reflections**: What worked, what didn't
- **Next Month Focus**: Top 3 priorities for the coming month

If $ARGUMENTS contains a month (e.g., "january" or "2024-01"), use that month instead of current.
