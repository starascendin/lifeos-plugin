# LifeOS Plugin

Universal skills and MCP integration for LifeOS — your personal productivity OS powered by Convex.

38 workflow skills for project management, contacts, agendas, voice notes, health (Oura Ring), finance, coaching, life direction, graph relationships, and more.

## Installation

### Claude Code

```bash
claude plugin add github:starascendin/lifeos-plugin
```

### OpenCode

OpenCode reads `.claude/skills/` natively. Copy or symlink the skills directory:

```bash
cp -r skills/ .claude/skills/lifeos/
```

Or symlink:

```bash
ln -s /path/to/lifeos-plugin/skills .claude/skills/lifeos
```

### Manual Setup

1. Copy the `skills/` directory to your agent's skills location
2. Configure the MCP server with your credentials:

```json
{
  "mcpServers": {
    "lifeos": {
      "command": "npx",
      "args": [
        "@starascendin/lifeos-mcp@latest",
        "--url",
        "YOUR_CONVEX_URL",
        "--user-id",
        "YOUR_USER_ID",
        "--api-key",
        "YOUR_API_KEY"
      ],
      "env": {
        "FALKOR_BROWSER_ENDPOINT": "https://falkordb.apps.rjlabs.dev",
        "FALKOR_GRAPH": "lifeos_ppv",
        "FALKOR_PASS": "YOUR_FALKOR_PASSWORD"
      }
    }
  }
}
```

Or use environment variables:

```bash
export LIFEOS_CONVEX_URL=https://your-app.convex.site
export LIFEOS_USER_ID=your-user-id
export LIFEOS_API_KEY=your-api-key
```

For FalkorDB sidecar graph tools, also set:

```bash
export FALKOR_BROWSER_ENDPOINT=https://falkordb.apps.rjlabs.dev
export FALKOR_GRAPH=lifeos_ppv
export FALKOR_PASS=your-falkor-password
```

## Skills

### Planning Calendar Blocks

The planning workflows treat non-ticket calendar time as a first-class LifeOS
calendar block. Use `create_calendar_block` when the user wants protected time
on the calendar but does not need a PM issue, such as dog walking, meals,
errands, personal appointments, focus blocks, travel, or tentative holds. The
payload requires `title`, `timezone`, and either `startAt`/`endAt` ISO datetimes
or `date` plus local `startTime`/`endTime`; supported optional fields include
`blockType`, `source`, and `isProtected`.

Task-backed work should still use `create_issue` for new execution work and
`schedule_issue` or `update_issue` for due dates and scheduled task time blocks.
Do not create a task just to reserve protected personal time.

### Daily Workflows

- **daily-standup** — Morning briefing with agenda, tasks, and sprint progress
- **daily-plan** — Plan today and apply due date, task schedule, protected
  calendar block, priority, cycle, and Daily Note changes
- **end-of-day** — EOD wrap-up with completion summary and tomorrow planning
- **capture** — Quick capture a thought, task, or note with auto-routing

### Reviews

- **weekly-review** — Completed work, in-progress items, sprint health
- **weekly-plan** — Plan the week and apply current cycle, due date, task
  schedule, protected calendar block, priority, and note changes
- **monthly-review** — Accomplishments, project progress, next month planning
- **cycle-review** — Sprint review with rollover options
- **initiative-review** — Yearly initiative progress by category

### Project & Client Management

- **project-status** — Phase breakdown, task stats, blockers
- **client-brief** — Full client briefing with projects and comms
- **client-health** — Health dashboard across all clients
- **sprint-plan** — Plan the current cycle and apply task/cycle mutations,
  including scheduled tasks and protected calendar blocks

### People & Relationships

- **contact-lookup** — Full contact dossier with AI insights
- **meeting-prep** — Prepare for meetings with full context
- **follow-ups** — Track follow-ups needed with people and clients
- **relationship-pulse** — Check on neglected relationships
- **context-switch** — Fast context loading for a client or project

### Task Management

- **inbox-triage** — Process notes into actionable tasks
- **overdue** — Surface overdue and slipping items

### Voice Notes

- **voice-notes** — Interactive voice memo exploration
- **voice-notes-crystallize** — Save conversation insights as crystallized summaries

### Health (Oura Ring)

- **health-check** — Quick health overview: sleep, activity, readiness scores and trends
- **health-weekly** — Weekly health review with workouts, recovery, and recommendations

### Screen Time

- **screentime-report** — Usage patterns, top time-sink apps, social media alerts, category breakdown

### Finance

- **finance-overview** — Net worth summary, account balances, and trend analysis
- **finance-spending** — Spending analysis with daily patterns and recent transactions

### Habits & Accountability

- **habit-check** — Daily habit check-in: review today's habits, mark completions, celebrate streaks, flag missed reps
- **daily-training-report** — Comprehensive daily training report: yesterday's results, today's focus, habit compliance, health data, ADHD focus management

### Coaching

- **coaching-overview** — Dashboard of coaching profiles, recent sessions, and pending action items
- **coaching-action-items** — Review and manage coaching action items across all coaches
- **coaching-session-review** — Review a coaching session's summary, key insights, and action items

### Coaching Memory

- **coach-memory** — View the AI coach's accumulated knowledge about you across 10 sections

### Life Direction

- **ppv** — Manage PPV vision, identity, pillars, existing project links, fears, inversions, and limiting-belief friction records
- **falkor-graph** — Query schema-aware PPV graph records and create agent-owned links through the FalkorDB sidecar graph

## MCP Server

The plugin uses `@starascendin/lifeos-mcp` — an npm package that exposes LifeOS tools and prompts via Model Context Protocol. Most tools call Convex. PPV friction records use `get_belief_reframes`, `create_belief_reframe`, and `update_belief_reframe` with `type` values of `fear`, `inversion`, or `limiting_belief`, and can link to `visionIds`, `projectIds`, or `issueIds`. The `falkor_graph_*` tools call the FalkorDB sidecar for guarded Cypher reads, a schema/query recipe contract, and agent-owned PPV graph links.

Install standalone:

```bash
npm install -g @starascendin/lifeos-mcp
lifeos-mcp --url https://your-app.convex.site --user-id xxx --api-key yyy
```

## License

MIT
