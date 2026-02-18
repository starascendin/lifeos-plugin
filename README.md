# LifeOS Plugin

Universal skills and MCP integration for LifeOS — your personal productivity OS powered by Convex.

27 workflow skills for project management, contacts, agendas, voice notes, health (Oura Ring), finance, coaching, and more.

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
        "--url", "YOUR_CONVEX_URL",
        "--user-id", "YOUR_USER_ID",
        "--api-key", "YOUR_API_KEY"
      ]
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

## Skills (30 total)

### Daily Workflows
- **daily-standup** — Morning briefing with agenda, tasks, and sprint progress
- **end-of-day** — EOD wrap-up with completion summary and tomorrow planning
- **capture** — Quick capture a thought, task, or note with auto-routing

### Reviews
- **weekly-review** — Completed work, in-progress items, sprint health
- **monthly-review** — Accomplishments, project progress, next month planning
- **cycle-review** — Sprint review with rollover options
- **initiative-review** — Yearly initiative progress by category

### Project & Client Management
- **project-status** — Phase breakdown, task stats, blockers
- **client-brief** — Full client briefing with projects and comms
- **client-health** — Health dashboard across all clients
- **sprint-plan** — Plan sprints by reviewing backlog and capacity

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

## MCP Server

The plugin uses `@starascendin/lifeos-mcp` — an npm package that exposes LifeOS tools and prompts via Model Context Protocol.

Install standalone:

```bash
npm install -g @starascendin/lifeos-mcp
lifeos-mcp --url https://your-app.convex.site --user-id xxx --api-key yyy
```

## License

MIT
